/**
 * store.svelte.ts — Svelte 5 runes によるリアクティブなゲーム状態。
 *
 * 純粋ロジック(game.ts / expedition.ts)は plain object を触るだけにして、
 * ここが「タイマー」「セーブ」「オフライン復帰」を担当する。
 */
import { CONFIG, type UpgradeId } from '../config'
import { buildTimeline } from './chronicle'
import { heroStats } from './expedition'
import {
  beginExpedition,
  buyUpgrade,
  catchUpOffline,
  normalizeUpgrades,
  stepGame
} from './game'
import { clearState, defaultState, loadState, saveState } from './save'
import type { GameState, OfflineReport, RetreatSettings } from '../types'

function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T
}

class Game {
  state = $state<GameState>(defaultState())
  offlineReport = $state<OfflineReport | null>(null)

  /** 時間の倍速。テストプレイ用パネルから変更する。通常は 1。 */
  speed = $state(1)

  #timer: ReturnType<typeof setInterval> | null = null
  #lastTick = 0
  #sinceSave = 0

  /** 恒久強化を反映した現在のヒーロー能力。 */
  hero = $derived(heroStats(this.state.upgrades))

  /** 記録庫の表示用(ダイジェスト化込み・新しい順)。 */
  timeline = $derived(buildTimeline(this.state.chronicles).slice().reverse())

  /** 殿堂入りの名場面。 */
  hallOfFame = $derived(this.state.chronicles.filter((c) => c.hallOfFame))

  init(): void {
    const { state, loaded } = loadState()
    normalizeUpgrades(state)
    if (loaded) {
      // オフライン進行は plain object 上で一気に消化する(プロキシ経由だと遅いため)。
      const plain = clone(state)
      const report = catchUpOffline(plain, Date.now())
      this.state = plain
      if (report.elapsedMs > 60_000 && report.expeditions > 0) this.offlineReport = report
    } else {
      this.state = state
    }
    this.#lastTick = Date.now()
    this.start()
  }

  start(): void {
    if (this.#timer !== null) return
    this.#lastTick = Date.now()
    this.#timer = setInterval(() => this.tick(), CONFIG.time.tickMs)
    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', this.#flush)
      document.addEventListener('visibilitychange', this.#onVisibility)
    }
  }

  stop(): void {
    if (this.#timer !== null) clearInterval(this.#timer)
    this.#timer = null
    if (typeof window !== 'undefined') {
      window.removeEventListener('beforeunload', this.#flush)
      document.removeEventListener('visibilitychange', this.#onVisibility)
    }
  }

  #flush = (): void => saveState(this.state)

  #onVisibility = (): void => {
    // タブが背面に回ると setInterval が絞られるため、戻ったときに差分を取り戻す。
    if (document.visibilityState === 'visible') this.tick()
    else this.#flush()
  }

  tick(): void {
    const now = Date.now()
    const delta = Math.max(0, now - this.#lastTick)
    this.#lastTick = now
    if (delta === 0) return
    const scaled = delta * this.speed

    if (scaled > CONFIG.time.tickMs * 50) {
      // 大きな飛び(スリープ復帰・倍速)は plain object でまとめて処理する。
      const plain = clone(this.state)
      stepGame(plain, scaled)
      this.state = plain
    } else {
      stepGame(this.state, scaled)
    }

    this.#sinceSave += delta
    if (this.#sinceSave >= CONFIG.time.autoSaveMs) {
      this.#sinceSave = 0
      this.#flush()
    }
  }

  /* ── プレイヤー操作 ───────────────────────────── */

  depart(): void {
    if (this.state.status === 'idle') beginExpedition(this.state)
  }

  buy(id: UpgradeId): void {
    if (buyUpgrade(this.state, id)) this.#flush()
  }

  updateSettings(patch: Partial<RetreatSettings>): void {
    Object.assign(this.state.settings, patch)
    // 自動連続遠征をONにした直後に待機中なら、そのまま出発させる。
    if (patch.autoRepeat && this.state.status === 'idle') this.depart()
    this.#flush()
  }

  /** 指定時間ぶんの進行を即座に消化する(テストプレイ用)。 */
  skip(ms: number): void {
    const plain = clone(this.state)
    stepGame(plain, ms)
    this.state = plain
    this.#flush()
  }

  dismissOfflineReport(): void {
    this.offlineReport = null
  }

  reset(): void {
    clearState()
    this.state = defaultState()
    this.offlineReport = null
    this.#lastTick = Date.now()
  }
}

export const game = new Game()
