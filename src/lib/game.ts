/**
 * game.ts — ゲーム全体の進行(純粋関数)。
 *
 * 実時間のティックもオフライン進行も `stepGame` を通すので、
 * 「閉じていた間の進行」と「開いたまま待った場合」の結果は同じ規則に従う。
 */
import { CONFIG, UPGRADE_IDS, upgradeCost, type UpgradeId } from '../config'
import { composeChronicle } from './chronicle'
import {
  advanceExpedition,
  createExpedition,
  logDeparture,
  settleExpedition
} from './expedition'
import type { GameState, OfflineReport } from '../types'

/** 進行ループの安全上限(暴走防止)。 */
const MAX_LOOPS = 20000

export function beginExpedition(state: GameState): void {
  const exp = createExpedition(state)
  logDeparture(exp, state.settings)
  state.expedition = exp
  state.status = 'expedition'
  state.restockTimer = 0
}

function finishExpedition(state: GameState, report?: OfflineReport): void {
  const exp = state.expedition
  if (!exp) return

  const settlement = settleExpedition(exp, state.upgrades)
  // 遠征記は stats を更新する前に作る(初討伐・最深記録の判定に旧 stats を使うため)。
  const chronicle = composeChronicle(exp, settlement, state)

  state.legacy += settlement.legacy
  state.stats.totalExpeditions++
  state.stats.totalGold += settlement.gold
  state.stats.totalKills += exp.kills
  state.stats.deepestFloor = Math.max(state.stats.deepestFloor, exp.deepestFloor)
  if (settlement.outcome === 'death') state.stats.deaths++
  else state.stats.returns++
  if (exp.retreatReason === 'clear') state.stats.cleared = true

  for (const e of exp.log) {
    if (e.type === 'battle' && e.outcome === 'victory' && e.enemy && !state.stats.slain.includes(e.enemy)) {
      state.stats.slain.push(e.enemy)
    }
  }

  state.chronicles.push(chronicle)
  const over = state.chronicles.length - CONFIG.chronicle.maxEntries
  if (over > 0) state.chronicles.splice(0, over)

  state.nextIndex++
  state.lastLog = exp.log
  state.expedition = null

  if (report) {
    report.expeditions++
    report.legacyGained += settlement.legacy
    report.deepest = Math.max(report.deepest, exp.deepestFloor)
    if (settlement.outcome === 'death') report.deaths++
  }

  if (state.settings.autoRepeat) {
    state.status = 'restock'
    state.restockTimer = CONFIG.time.restockMs
  } else {
    state.status = 'idle'
    state.restockTimer = 0
  }
}

/**
 * ゲームを deltaMs だけ進める。
 * `report` を渡すとオフライン進行のサマリを積み上げる。
 */
export function stepGame(state: GameState, deltaMs: number, report?: OfflineReport): void {
  let remaining = Math.max(0, deltaMs)
  let loops = 0

  while (remaining > 0 && loops++ < MAX_LOOPS) {
    if (state.status === 'idle') break // 出発指示待ち。時間は消費しない。

    if (state.status === 'restock') {
      if (remaining < state.restockTimer) {
        state.restockTimer -= remaining
        return
      }
      remaining -= state.restockTimer
      state.restockTimer = 0
      beginExpedition(state)
      continue
    }

    const exp = state.expedition
    if (!exp) {
      state.status = 'idle'
      break
    }
    const before = exp.elapsed
    advanceExpedition(exp, remaining)
    remaining -= exp.elapsed - before
    if (exp.phase === 'done') finishExpedition(state, report)
    else return // 与えられた時間を使い切った
  }
}

/** オフライン経過分をまとめて消化する。上限は CONFIG.time.offlineCapHours。 */
export function catchUpOffline(state: GameState, now: number): OfflineReport {
  const capMs = CONFIG.time.offlineCapHours * 3600_000
  const elapsed = Math.min(Math.max(0, now - state.lastSaved), capMs)
  const report: OfflineReport = {
    elapsedMs: elapsed,
    expeditions: 0,
    legacyGained: 0,
    deepest: 0,
    deaths: 0
  }
  if (elapsed > 0) stepGame(state, elapsed, report)
  return report
}

export function canAfford(state: GameState, id: UpgradeId): boolean {
  const level = state.upgrades[id]
  if (level >= CONFIG.upgrades[id].maxLevel) return false
  return state.legacy >= upgradeCost(id, level)
}

/** 恒久強化を1レベル購入する。買えたら true。 */
export function buyUpgrade(state: GameState, id: UpgradeId): boolean {
  if (!canAfford(state, id)) return false
  state.legacy -= upgradeCost(id, state.upgrades[id])
  state.upgrades[id]++
  return true
}

/** 未初期化のアップグレードキーを埋める(セーブ互換の保険)。 */
export function normalizeUpgrades(state: GameState): void {
  for (const id of UPGRADE_IDS) {
    if (typeof state.upgrades[id] !== 'number') state.upgrades[id] = 0
  }
}
