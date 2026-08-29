import { describe, expect, it } from 'vitest'
import { CONFIG } from '../../config'
import { advanceExpedition, createExpedition, heroStats, settleExpedition } from '../expedition'
import { beginExpedition, buyUpgrade, catchUpOffline, stepGame } from '../game'
import { defaultState } from '../save'
import { Rng } from '../rng'
import type { GameState } from '../../types'

function freshState(patch: Partial<GameState> = {}): GameState {
  return { ...defaultState(), heroName: 'テスト遠征者', ...patch }
}

/** 遠征が終わるまで進める。 */
function runToEnd(state: GameState): void {
  beginExpedition(state)
  for (let i = 0; i < 500 && state.status === 'expedition'; i++) {
    stepGame(state, 5000)
  }
}

describe('Rng', () => {
  it('同じ seed からは同じ列が出る', () => {
    const a = new Rng(12345)
    const b = new Rng(12345)
    expect([a.next(), a.next(), a.next()]).toEqual([b.next(), b.next(), b.next()])
  })
})

describe('advanceExpedition', () => {
  it('必ず終了状態に到達する', () => {
    for (let seed = 0; seed < 50; seed++) {
      const state = freshState()
      const exp = createExpedition(state)
      exp.seed = seed
      advanceExpedition(exp, 60 * 60 * 1000)
      expect(exp.phase).toBe('done')
      expect(exp.outcome).toBeDefined()
    }
  })

  it('刻み幅を変えても結果が一致する(オフライン進行と実時間進行の同一性)', () => {
    for (let seed = 0; seed < 20; seed++) {
      const state = freshState()
      const bulk = createExpedition(state)
      bulk.seed = seed
      advanceExpedition(bulk, 60 * 60 * 1000)

      const ticked = createExpedition(state)
      ticked.seed = seed
      for (let i = 0; i < 20000 && ticked.phase !== 'done'; i++) advanceExpedition(ticked, 100)

      expect(ticked.phase).toBe('done')
      expect(ticked.outcome).toBe(bulk.outcome)
      expect(ticked.deepestFloor).toBe(bulk.deepestFloor)
      expect(ticked.gold).toBe(bulk.gold)
      expect(ticked.log.length).toBe(bulk.log.length)
    }
  })

  it('maxFloor を超えて潜らない', () => {
    const state = freshState()
    state.settings = { ...state.settings, greedy: true }
    // 死なないように強化しきったヒーローで確認する。
    state.upgrades = { forge: 25, tavern: 25, library: 0 }
    for (let seed = 0; seed < 30; seed++) {
      const exp = createExpedition(state)
      exp.seed = seed
      exp.settings = { ...state.settings }
      advanceExpedition(exp, 60 * 60 * 1000)
      expect(exp.deepestFloor).toBeLessThanOrEqual(CONFIG.dungeon.maxFloor)
    }
  })

  it('目標階層に到達したら撤退する', () => {
    const state = freshState()
    state.settings = { ...state.settings, targetFloor: 3, hpPct: 0, greedy: false }
    state.upgrades = { forge: 25, tavern: 25, library: 0 }
    for (let seed = 0; seed < 30; seed++) {
      const exp = createExpedition(state)
      exp.seed = seed
      exp.settings = { ...state.settings }
      advanceExpedition(exp, 60 * 60 * 1000)
      if (exp.outcome === 'return') {
        expect(exp.deepestFloor).toBe(3)
        expect(exp.retreatReason).toBe('target')
      }
    }
  })

  it('HP撤退ラインを下回ったら帰還を始める', () => {
    const state = freshState()
    state.settings = { ...state.settings, hpPct: 65, targetFloor: 10, greedy: false }
    let sawHpRetreat = false
    for (let seed = 0; seed < 60; seed++) {
      const exp = createExpedition(state)
      exp.seed = seed
      exp.settings = { ...state.settings }
      advanceExpedition(exp, 60 * 60 * 1000)
      if (exp.retreatReason === 'hp') {
        sawHpRetreat = true
        // 撤退開始時点で HP はラインを割っている
        expect(exp.hp / exp.maxHp).toBeLessThan(0.65)
      }
    }
    expect(sawHpRetreat).toBe(true)
  })

  it('強欲設定はHP撤退ラインを無視する', () => {
    const state = freshState()
    state.settings = { hpPct: 65, targetFloor: 2, greedy: true, autoRepeat: false }
    for (let seed = 0; seed < 30; seed++) {
      const exp = createExpedition(state)
      exp.seed = seed
      exp.settings = { ...state.settings }
      advanceExpedition(exp, 60 * 60 * 1000)
      expect(exp.retreatReason === 'hp' || exp.retreatReason === 'target').toBe(false)
    }
  })
})

describe('settleExpedition', () => {
  it('死亡時はゴールドの8割を失い、遺産は半分だけ入る', () => {
    const state = freshState()
    const exp = createExpedition(state)
    exp.gold = 1000
    exp.depthLegacy = 100
    exp.outcome = 'death'
    exp.deepestFloor = 5
    const s = settleExpedition(exp, state.upgrades)
    expect(s.gold).toBe(200)
    expect(s.goldLost).toBe(800)
    // 深度分の半分 + 持ち帰りゴールドからの換算
    expect(s.legacy).toBe(Math.round(100 * 0.5 + 200 * CONFIG.rewards.goldToLegacy))
  })

  it('帰還時は全額持ち帰る', () => {
    const state = freshState()
    const exp = createExpedition(state)
    exp.gold = 1000
    exp.depthLegacy = 100
    exp.outcome = 'return'
    const s = settleExpedition(exp, state.upgrades)
    expect(s.gold).toBe(1000)
    expect(s.goldLost).toBe(0)
  })
})

describe('heroStats / upgrades', () => {
  it('恒久強化が能力値に反映される', () => {
    const base = heroStats({ forge: 0, tavern: 0, library: 0 })
    const up = heroStats({ forge: 2, tavern: 3, library: 4 })
    expect(up.atk).toBe(base.atk + 2 * CONFIG.upgrades.forge.atkPerLevel)
    expect(up.maxHp).toBe(base.maxHp + 3 * CONFIG.upgrades.tavern.hpPerLevel)
    expect(up.speed).toBeGreaterThan(base.speed)
    expect(up.legacyMul).toBeGreaterThan(base.legacyMul)
  })

  it('遺産ポイントが足りなければ買えない', () => {
    const state = freshState()
    state.legacy = 0
    expect(buyUpgrade(state, 'forge')).toBe(false)
    state.legacy = 99999
    expect(buyUpgrade(state, 'forge')).toBe(true)
    expect(state.upgrades.forge).toBe(1)
  })

  it('コスト曲線は指数的に増える', () => {
    const state = freshState()
    state.legacy = 10 ** 9
    const costs: number[] = []
    for (let i = 0; i < 5; i++) {
      const before = state.legacy
      buyUpgrade(state, 'forge')
      costs.push(before - state.legacy)
    }
    for (let i = 1; i < costs.length; i++) expect(costs[i]).toBeGreaterThan(costs[i - 1])
  })
})

describe('stepGame / オフライン進行', () => {
  it('自動連続遠征が回り、遠征記が積まれる', () => {
    const state = freshState()
    state.settings = { ...state.settings, autoRepeat: true }
    beginExpedition(state)
    stepGame(state, 30 * 60 * 1000)
    expect(state.stats.totalExpeditions).toBeGreaterThan(2)
    expect(state.chronicles.length).toBe(state.stats.totalExpeditions)
    expect(state.nextIndex).toBe(state.stats.totalExpeditions + 1)
  })

  it('自動連続遠征がOFFなら1回で待機に戻る', () => {
    const state = freshState()
    state.settings = { ...state.settings, autoRepeat: false }
    runToEnd(state)
    expect(state.status).toBe('idle')
    expect(state.stats.totalExpeditions).toBe(1)
    stepGame(state, 60 * 60 * 1000)
    expect(state.stats.totalExpeditions).toBe(1) // 待機中は時間が進まない
  })

  it('オフライン進行は上限時間で頭打ちになる', () => {
    const state = freshState()
    beginExpedition(state)
    state.lastSaved = Date.now() - 100 * 3600_000
    const report = catchUpOffline(state, Date.now())
    expect(report.elapsedMs).toBe(CONFIG.time.offlineCapHours * 3600_000)
    expect(report.expeditions).toBeGreaterThan(0)
  })

  it('遠征記は上限件数を超えない', () => {
    const state = freshState()
    beginExpedition(state)
    stepGame(state, 8 * 3600_000)
    expect(state.chronicles.length).toBeLessThanOrEqual(CONFIG.chronicle.maxEntries)
  })

  it('上限を超えても殿堂入りの遠征記は捨てられない', () => {
    const state = freshState()
    beginExpedition(state)
    // 上限に達するまで回してから、殿堂入りが失われていないか見る
    stepGame(state, 3600_000)
    const fameBefore = state.chronicles.filter((c) => c.hallOfFame)
    expect(fameBefore.length).toBeGreaterThan(0)

    stepGame(state, 8 * 3600_000)
    expect(state.chronicles.length).toBe(CONFIG.chronicle.maxEntries)

    const fameAfter = state.chronicles.filter((c) => c.hallOfFame)
    for (const c of fameBefore) {
      expect(fameAfter.some((f) => f.id === c.id)).toBe(true)
    }
  })
})
