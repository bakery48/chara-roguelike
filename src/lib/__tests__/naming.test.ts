import { describe, expect, it } from 'vitest'
import { CONFIG } from '../../config'
import { composeChronicle } from '../chronicle'
import { advanceExpedition, createExpedition, settleExpedition } from '../expedition'
import { beginExpedition, stepGame } from '../game'
import {
  EPITHETS,
  GIVEN_NAMES,
  MAX_NAME_LENGTH,
  describeTrait,
  displayName,
  drawGivenName,
  drawHero,
  epithetsWithoutMods,
  findEpithet,
  sanitizeHeroName
} from '../names'
import { Rng } from '../rng'
import { STORAGE_KEY, defaultState, loadState } from '../save'
import { heroStats, resolveMods } from '../expedition'
import type { GameState } from '../../types'

function named(name = 'テスト遠征者', epithet = 'kamoku'): GameState {
  return { ...defaultState(), heroName: name, heroEpithet: epithet }
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

describe('名簿', () => {
  it('名と二つ名が十分な数ある', () => {
    expect(GIVEN_NAMES.length).toBeGreaterThanOrEqual(40)
    expect(EPITHETS.length).toBeGreaterThanOrEqual(20)
  })

  it('重複がない', () => {
    expect(new Set(GIVEN_NAMES).size).toBe(GIVEN_NAMES.length)
    const ids = EPITHETS.map((e) => e.id)
    expect(new Set(ids).size).toBe(ids.length)
    const labels = EPITHETS.map((e) => e.label)
    expect(new Set(labels).size).toBe(labels.length)
  })

  it('すべての二つ名に config 側の効果定義がある', () => {
    expect(epithetsWithoutMods()).toEqual([])
  })

  it('効果のない二つ名がない(全部が何かしら能力を動かす)', () => {
    for (const e of EPITHETS) {
      expect(describeTrait(e.id).length).toBeGreaterThan(0)
    }
  })

  it('同じ seed からは同じ冒険者が出る', () => {
    expect(drawHero(new Rng(777))).toEqual(drawHero(new Rng(777)))
  })

  it('二つ名と名は別々に抽選される', () => {
    // 同じ二つ名でも名が割れる/同じ名でも二つ名が割れることを確認する
    const draws = Array.from({ length: 300 }, (_, i) => drawHero(new Rng(i)))
    const byEpithet = new Map<string, Set<string>>()
    for (const d of draws) {
      if (!byEpithet.has(d.epithet)) byEpithet.set(d.epithet, new Set())
      byEpithet.get(d.epithet)!.add(d.given)
    }
    const varied = [...byEpithet.values()].filter((s) => s.size > 1)
    expect(varied.length).toBeGreaterThan(0)
    expect(byEpithet.size).toBeGreaterThan(1)
  })

  it('表示名は二つ名 + 名になる', () => {
    expect(displayName('hayaashi', 'ユーリ')).toBe('足早のユーリ')
    // 未知の二つ名でも名は消えない
    expect(displayName('存在しない', 'ユーリ')).toBe('ユーリ')
  })

  it('名の引き直しは名だけを返す(二つ名を含まない)', () => {
    for (let seed = 0; seed < 100; seed++) {
      expect(GIVEN_NAMES).toContain(drawGivenName(new Rng(seed)))
    }
  })
})

describe('二つ名の効果', () => {
  it('能力値に反映される', () => {
    const plain = heroStats({ forge: 0, tavern: 0, library: 0 }, '')
    const glass = heroStats({ forge: 0, tavern: 0, library: 0 }, 'usurai')
    const iron = heroStats({ forge: 0, tavern: 0, library: 0 }, 'tessa')
    const fast = heroStats({ forge: 0, tavern: 0, library: 0 }, 'hayaashi')

    expect(glass.atk).toBeGreaterThan(plain.atk)
    expect(glass.maxHp).toBeLessThan(plain.maxHp)
    expect(iron.def).toBeGreaterThan(plain.def)
    expect(fast.speed).toBeGreaterThan(plain.speed)
  })

  it('遠征中の判定値に反映される', () => {
    const plain = resolveMods('')
    expect(resolveMods('nawanuke').trapEvade).toBeGreaterThan(plain.trapEvade)
    expect(resolveMods('ishiatama').trapDamageMul).toBeLessThan(plain.trapDamageMul)
    expect(resolveMods('yome').treasureChance).toBeGreaterThan(plain.treasureChance)
    expect(resolveMods('kazoejouzu').goldMul).toBeGreaterThan(plain.goldMul)
    expect(resolveMods('sandoshinda').deathGoldLossRate).toBeLessThan(plain.deathGoldLossRate)
    expect(resolveMods('katame').critChance).toBeGreaterThan(plain.critChance)
  })

  it('確率は 0〜1 の範囲を外れない', () => {
    for (const e of EPITHETS) {
      const m = resolveMods(e.id)
      for (const v of [m.critChance, m.trapEvade, m.treasureChance, m.deathGoldLossRate]) {
        expect(v).toBeGreaterThanOrEqual(0)
        expect(v).toBeLessThanOrEqual(1)
      }
    }
  })

  it('説明文は config の数値から生成される', () => {
    // 数値はバランス調整で動くので、config から期待値を導く
    const speedPct = Math.round((CONFIG.traits.hayaashi.speedMul! - 1) * 100)
    expect(describeTrait('hayaashi')).toContainEqual({
      text: `遠征速度 +${speedPct}%`,
      good: true
    })
  })

  it('「下がるほど良い」項目は、マイナスが有利側として表示される', () => {
    // 罠ダメージ減は有利、罠ダメージ増は不利
    const hard = describeTrait('ishiatama').find((e) => e.text.startsWith('罠ダメージ'))
    expect(hard?.text.includes('-')).toBe(true)
    expect(hard?.good).toBe(true)

    const rain = describeTrait('amefurashi').find((e) => e.text.startsWith('罠ダメージ'))
    expect(rain?.text.includes('+')).toBe(true)
    expect(rain?.good).toBe(false)
  })

  it('諸刃の二つ名は有利・不利が両方出る', () => {
    const glass = describeTrait('usurai')
    expect(glass.some((e) => e.good)).toBe(true)
    expect(glass.some((e) => !e.good)).toBe(true)
  })

  it('未知の二つ名は無修正として扱う', () => {
    expect(describeTrait('存在しない')).toEqual([])
    expect(resolveMods('存在しない')).toEqual(resolveMods(''))
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
    // 二つ名も引き直され、既知のものになっている
    expect(findEpithet(state.heroEpithet)).toBeDefined()
  })

  it('改名しても二つ名(＝特性)は変わらない', () => {
    const state = named('先代', 'hayaashi')
    const before = heroStats(state.upgrades, state.heroEpithet)
    state.heroName = '好きな名前'
    expect(state.heroEpithet).toBe('hayaashi')
    expect(heroStats(state.upgrades, state.heroEpithet)).toEqual(before)
    expect(displayName(state.heroEpithet, state.heroName)).toBe('足早の好きな名前')
  })

  it('遠征中に改名しても、その遠征の能力と表示名は変わらない', () => {
    const state = named('先代', 'usurai')
    beginExpedition(state)
    const exp = state.expedition!
    const atk = exp.atk
    state.heroName = '別名'
    state.heroEpithet = 'tessa'
    expect(exp.atk).toBe(atk)
    expect(exp.epithet).toBe('usurai')
    expect(exp.heroName).toBe('薄氷の先代')
  })

  it('設定がOFFなら死んでも同じ冒険者のまま', () => {
    const state = named('不死身')
    state.renameOnDeath = false
    expect(runUntilDeath(state)).toBe(true)
    expect(state.heroName).toBe('不死身')
    expect(state.heroEpithet).toBe('kamoku')
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
    expect(exp.heroName).toBe('寡黙な先代')
    state.heroName = '後任'
    expect(exp.heroName).toBe('寡黙な先代')
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
  it('文中の {hero} が二つ名込みの表示名に置き換わる', () => {
    const state = named('ユーリ', 'hayaashi')
    const exp = createExpedition(state)
    exp.seed = 1234
    advanceExpedition(exp, 3600_000)
    const c = composeChronicle(exp, settleExpedition(exp, state.upgrades), state)
    expect(c.text).not.toMatch(/[{}]/)
    expect(c.text).toContain('足早のユーリ')
  })
})

describe('セーブの移行', () => {
  it('v1: 名前を持たない旧セーブは、旧来の固定名と二つ名を得る', () => {
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
    // v3 で二つ名も付く
    expect(findEpithet(state.heroEpithet)).toBeDefined()
    expect(state.expedition?.epithet).toBe(state.heroEpithet)
    expect(state.expedition?.mods).toEqual(resolveMods(state.heroEpithet))
  })

  it('v2: 二つ名を持たないセーブには、名前を保ったまま二つ名を与える', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        version: 2,
        legacy: 55,
        heroName: 'ハルカ',
        heroGeneration: 3,
        renameOnDeath: false,
        expedition: { index: 4, floor: 2, seed: 7, heroName: 'ハルカ' }
      })
    )
    const { state, loaded } = loadState()
    expect(loaded).toBe(true)
    expect(state.heroName).toBe('ハルカ')
    expect(state.heroGeneration).toBe(3)
    expect(state.renameOnDeath).toBe(false)
    expect(findEpithet(state.heroEpithet)).toBeDefined()
    expect(state.expedition?.epithet).toBe(state.heroEpithet)
  })

  it('新規データは未登録なので、命名待ちの印が立つ', () => {
    expect(defaultState().heroName).toBe('')
    expect(defaultState().heroEpithet).toBe('')
  })
})
