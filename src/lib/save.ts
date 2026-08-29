/**
 * save.ts — 自動セーブ / ロード / マイグレーション。
 *
 * セーブデータは必ずバージョン番号を持つ。スキーマを変えたら
 * CONFIG.saveVersion を +1 し、MIGRATIONS に「n → n+1」の関数を足すこと。
 */
import { CONFIG } from '../config'
import { resolveMods } from './expedition'
import type { GameState } from '../types'
import { drawHero, drawGivenName } from './names'
import { Rng, newSeed } from './rng'

export const STORAGE_KEY = 'chara-roguelike.save'

export function defaultState(): GameState {
  return {
    version: CONFIG.saveVersion,
    lastSaved: Date.now(),
    legacy: 0,
    upgrades: { forge: 0, tavern: 0, library: 0 },
    // 空文字は「未登録」。初回起動時に命名画面を出すための印。
    heroName: '',
    heroEpithet: '',
    heroGeneration: 1,
    renameOnDeath: true,
    settings: {
      hpPct: CONFIG.retreat.defaultHpPct,
      targetFloor: CONFIG.retreat.defaultTargetFloor,
      greedy: false,
      autoRepeat: true
    },
    expedition: null,
    lastLog: [],
    restockTimer: 0,
    status: 'idle',
    chronicles: [],
    stats: {
      totalExpeditions: 0,
      returns: 0,
      deaths: 0,
      deepestFloor: 0,
      totalGold: 0,
      totalKills: 0,
      slain: [],
      cleared: false
    },
    nextIndex: 1,
    rngSeed: newSeed()
  }
}

/**
 * バージョン n のデータを n+1 に変換する関数。
 * 例) 2 を足すときは MIGRATIONS[1] = (s) => ({ ...s, newField: default })
 */
type AnySave = Record<string, unknown>
const MIGRATIONS: Record<number, (s: AnySave) => AnySave> = {
  /**
   * 1 → 2: 冒険者に名前を持たせた。
   * v1 の遠征者は固定名だったので、既存のセーブはその名前を引き継ぐ
   * (途中でいきなり別人になると、それまでの遠征記と噛み合わなくなるため)。
   * 進行中の遠征にも同じ名前を入れておく。
   */
  /**
   * 2 → 3: 二つ名が特性になった。
   * v2 の冒険者は二つ名を持たないので、ここで1つ引いて与える。
   * 進行中の遠征にも同じ特性と、そこから解決した判定値を入れる。
   */
  2: (s) => {
    const draw = drawHero(new Rng(newSeed()))
    const expedition = s.expedition as Record<string, unknown> | null
    return {
      ...s,
      heroEpithet: draw.epithet,
      expedition: expedition
        ? { ...expedition, epithet: draw.epithet, mods: resolveMods(draw.epithet) }
        : null
    }
  },

  1: (s) => {
    const legacyName = CONFIG.hero.legacyName
    const expedition = s.expedition as Record<string, unknown> | null
    return {
      ...s,
      heroName: legacyName,
      heroGeneration: 1,
      renameOnDeath: true,
      expedition: expedition ? { ...expedition, heroName: legacyName } : null
    }
  }
}

function migrate(raw: AnySave): AnySave {
  let version = typeof raw.version === 'number' ? raw.version : 0
  let data = raw
  while (version < CONFIG.saveVersion) {
    const step = MIGRATIONS[version]
    if (!step) {
      // 変換手段がない = 互換性なし。新規データで始める。
      throw new Error(`no migration from save version ${version}`)
    }
    data = step(data)
    version++
    data.version = version
  }
  return data
}

/** 欠けたフィールドを既定値で補う(前方互換の保険)。 */
function reconcile(data: AnySave): GameState {
  const base = defaultState()
  const s = data as Partial<GameState>
  return {
    ...base,
    ...s,
    upgrades: { ...base.upgrades, ...(s.upgrades ?? {}) },
    settings: { ...base.settings, ...(s.settings ?? {}) },
    stats: { ...base.stats, ...(s.stats ?? {}) },
    chronicles: Array.isArray(s.chronicles) ? s.chronicles : [],
    lastLog: Array.isArray(s.lastLog) ? s.lastLog : [],
    version: CONFIG.saveVersion
  }
}

/** 名だけを引き直す(命名画面の「名簿から引く」)。二つ名＝特性は変わらない。 */
export function suggestGivenName(): string {
  return drawGivenName(new Rng(newSeed()))
}

/** 冒険者を1人引く(初回登録・代替わり用)。 */
export function drawNewHero(): { epithet: string; given: string } {
  return drawHero(new Rng(newSeed()))
}

export function loadState(): { state: GameState; loaded: boolean } {
  if (typeof localStorage === 'undefined') return { state: defaultState(), loaded: false }
  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw) return { state: defaultState(), loaded: false }
  try {
    const parsed = JSON.parse(raw) as AnySave
    return { state: reconcile(migrate(parsed)), loaded: true }
  } catch (err) {
    console.warn('[save] セーブデータを読めなかったので新規で開始します:', err)
    return { state: defaultState(), loaded: false }
  }
}

export function saveState(state: GameState): void {
  if (typeof localStorage === 'undefined') return
  state.lastSaved = Date.now()
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch (err) {
    console.warn('[save] 保存に失敗しました:', err)
  }
}

export function clearState(): void {
  if (typeof localStorage === 'undefined') return
  localStorage.removeItem(STORAGE_KEY)
}
