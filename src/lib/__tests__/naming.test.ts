import { describe, expect, it } from 'vitest'
import { CONFIG } from '../../config'
import { composeChronicle } from '../chronicle'
import { advanceExpedition, createExpedition, settleExpedition } from '../expedition'
import { beginExpedition, stepGame } from '../game'
import { EPITHETS, GIVEN_NAMES, MAX_NAME_LENGTH, randomHeroName, sanitizeHeroName } from '../names'
import { Rng } from '../rng'
import { STORAGE_KEY, defaultState, loadState } from '../save'
import type { GameState } from '../../types'

function named(name = 'テスト遠征者'): GameState {
  return { ...defaultState(), heroName: name }
}

/** 死ぬまで遠征を繰り返し、死んだ直後の状態を返す。 */
function runUntilDeath(state: GameState, limitMs = 6 * 3600_000): boolean {
  beginExpedition(state)
  const step = 60_000
  for (let t = 0; t < limitMs; t += step) {
    const before = state.stats.deaths
    stepGame(state, step)
    if (state.stats.deaths > before) return true
  }
  return false
}

describe('名前DB', () => {
  it('名と二つ名が十分な数ある', () => {
    expect(GIVEN_NAMES.length).toBeGreaterThanOrEqual(40)
    expect(EPITHETS.length).toBeGreaterThanOrEqual(20)
  })

  it('重複がない', () => {
    expect(new Set(GIVEN_NAMES).size).toBe(GIVEN_NAMES.length)
    expect(new Set(EPITHETS).size).toBe(EPITHETS.length)
  })

  it('生成される名前は表示上限に収まる', () => {
    for (let seed = 0; seed < 300; seed++) {
      const name = randomHeroName(new Rng(seed))
      expect(name.length).toBeGreaterThan(0)
      expect(name.length).toBeLessThanOrEqual(MAX_NAME_LENGTH)
    }
  })

  it('同じ seed からは同じ名前が出る', () => {
    expect(randomHeroName(new Rng(777))).toBe(randomHeroName(new Rng(777)))
  })

  it('二つ名が付くものと付かないものの両方が出る', () => {
    const names = Array.from({ length: 200 }, (_, i) => randomHeroName(new Rng(i)))
    const withEpithet = names.filter((n) => EPITHETS.some((e) => n.startsWith(e)))
    expect(withEpithet.length).toBeGreaterThan(0)
    expect(withEpithet.length).toBeLessThan(names.length)
  })
})

describe('sanitizeHeroName', () => {
  it('前後の空白を落とす', () => {
    expect(sanitizeHeroName('  ユーリ  ')).toBe('ユーリ')
  })

  it('空白だけの入力は使えない', () => {
    expect(sanitizeHeroName('')).toBe(null)
    expect(sanitizeHeroName('   ')).toBe(null)
  })

  it('長すぎる入力は切り詰める', () => {
    const long = 'あ'.repeat(50)
    expect(sanitizeHeroName(long)?.length).toBe(MAX_NAME_LENGTH)
  })
})

describe('代替わり', () => {
  it('死亡すると名簿から新しい冒険者を迎え、代数が増える', () => {
    const state = named('先代')
    state.renameOnDeath = true
    expect(runUntilDeath(state)).toBe(true)
    expect(state.heroName).not.toBe('先代')
    expect(state.heroName.length).toBeGreaterThan(0)
    expect(state.heroGeneration).toBe(2)
  })

  it('設定がOFFなら死んでも同じ冒険者のまま', () => {
    const state = named('不死身')
    state.renameOnDeath = false
    expect(runUntilDeath(state)).toBe(true)
    expect(state.heroName).toBe('不死身')
    expect(state.heroGeneration).toBe(1)
  })

  it('帰還しただけでは代替わりしない', () => {
    const state = named('無事')
    state.settings = { ...state.settings, targetFloor: 1, hpPct: 0 }
    state.upgrades = { forge: 25, tavern: 25, library: 0 }
    beginExpedition(state)
    stepGame(state, 30 * 60_000)
    expect(state.stats.returns).toBeGreaterThan(0)
    expect(state.stats.deaths).toBe(0)
    expect(state.heroName).toBe('無事')
  })

  it('死んだ本人の遠征記には本人の名前が残る', () => {
    const state = named('先代')
    state.renameOnDeath = true
    expect(runUntilDeath(state)).toBe(true)

    const death = state.chronicles.filter((c) => c.summary.outcome === 'death').pop()
    expect(death).toBeDefined()
    expect(death!.text).toContain('先代')
    // 後任の名前が、先代の遠征記に混ざっていないこと
    expect(death!.text).not.toMatch(new RegExp(state.heroName))
  })

  it('遠征中に代替わりしても、進行中の遠征の名前は変わらない', () => {
    const state = named('先代')
    beginExpedition(state)
    const exp = state.expedition!
    expect(exp.heroName).toBe('先代')
    state.heroName = '後任'
    expect(exp.heroName).toBe('先代')
  })

  it('同じ遠征なら、刻み幅によらず同じ後任が選ばれる', () => {
    // 後任は遠征の seed から引くので、オフラインで一気に消化しても
    // 実時間で刻んでも、同じ遠征の死からは同じ名前が出るはず。
    const start = (seed: number): GameState => {
      const s = named('先代')
      s.renameOnDeath = true
      s.settings = { ...s.settings, autoRepeat: false } // 1遠征で止める
      beginExpedition(s)
      s.expedition!.seed = seed
      return s
    }

    // 死ぬ遠征をひとつ探す
    let deadly = -1
    for (let seed = 0; seed < 300 && deadly < 0; seed++) {
      const s = start(seed)
      stepGame(s, 3600_000)
      if (s.stats.deaths === 1) deadly = seed
    }
    expect(deadly).toBeGreaterThanOrEqual(0)

    const bulk = start(deadly)
    stepGame(bulk, 3600_000)

    const ticked = start(deadly)
    for (let i = 0; i < 36_000 && ticked.status === 'expedition'; i++) stepGame(ticked, 100)

    expect(ticked.stats.deaths).toBe(1)
    expect(ticked.heroName).not.toBe('先代')
    expect(ticked.heroName).toBe(bulk.heroName)
    expect(ticked.heroGeneration).toBe(bulk.heroGeneration)
  })
})

describe('遠征記の名前', () => {
  it('文中の {hero} が実際の名前に置き換わる', () => {
    const state = named('ユーリ')
    const exp = createExpedition(state)
    exp.seed = 1234
    advanceExpedition(exp, 3600_000)
    const c = composeChronicle(exp, settleExpedition(exp, state.upgrades), state)
    expect(c.text).not.toMatch(/[{}]/)
    expect(c.text).toContain('ユーリ')
  })
})

describe('セーブの移行 (v1 → v2)', () => {
  it('名前を持たない旧セーブは、旧来の固定名を引き継ぐ', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        version: 1,
        legacy: 120,
        stats: { totalExpeditions: 9, returns: 8, deaths: 1, deepestFloor: 4 },
        expedition: { index: 9, floor: 2, seed: 1 }
      })
    )
    const { state, loaded } = loadState()
    expect(loaded).toBe(true)
    expect(state.version).toBe(CONFIG.saveVersion)
    expect(state.legacy).toBe(120)
    expect(state.stats.totalExpeditions).toBe(9)
    expect(state.heroName).toBe(CONFIG.hero.legacyName)
    expect(state.heroGeneration).toBe(1)
    expect(state.renameOnDeath).toBe(true)
    // 進行中の遠征にも名前が入る(名無しのまま続きが始まらない)
    expect(state.expedition?.heroName).toBe(CONFIG.hero.legacyName)
  })

  it('新規データは未登録なので、命名待ちの印が立つ', () => {
    expect(defaultState().heroName).toBe('')
  })
})
