/**
 * save.ts — 自動セーブ / ロード / マイグレーション。
 *
 * セーブデータは必ずバージョン番号を持つ。スキーマを変えたら
 * CONFIG.saveVersion を +1 し、MIGRATIONS に「n → n+1」の関数を足すこと。
 */
import { CONFIG } from '../config'
import type { GameState } from '../types'
import { newSeed } from './rng'

export const STORAGE_KEY = 'chara-roguelike.save'

export function defaultState(): GameState {
  return {
    version: CONFIG.saveVersion,
    lastSaved: Date.now(),
    legacy: 0,
    upgrades: { forge: 0, tavern: 0, library: 0 },
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
const MIGRATIONS: Record<number, (s: AnySave) => AnySave> = {}

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
