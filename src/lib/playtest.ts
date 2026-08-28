/**
 * playtest.ts — テストプレイ用の操作。
 *
 * このモジュールは PlaytestPanel.svelte からしか import されず、
 * そのパネルは __PLAYTEST__ ビルドでのみ描画される。
 * 通常のゲームビルドにはバンドルされない。
 */
import { stepGame } from './game'
import { game } from './store.svelte'
import { newSeed } from './rng'

/** 倍速の選択肢。 */
export const SPEEDS = [1, 5, 20, 100, 500] as const

/** 時間スキップの選択肢(ラベルとミリ秒)。 */
export const SKIPS: { label: string; ms: number }[] = [
  { label: '+10分', ms: 10 * 60_000 },
  { label: '+1時間', ms: 3600_000 },
  { label: '+8時間', ms: 8 * 3600_000 }
]

/** 遺産ポイントの付与量。 */
export const GRANTS = [100, 1000, 10000] as const

export function setSpeed(v: number): void {
  game.speed = v
}

export function skip(ms: number): void {
  game.skip(ms)
}

export function grantLegacy(n: number): void {
  game.state.legacy += n
}

/**
 * 進行中の遠征を今すぐ終わらせる。
 * 精算・遠征記の生成は通常どおり stepGame → finishExpedition が行うので、
 * 帰還と死亡の両方の結末をすぐ確認できる。
 */
export function endExpedition(outcome: 'return' | 'death'): void {
  const exp = game.state.expedition
  if (!exp) return
  exp.phase = 'done'
  exp.outcome = outcome
  if (outcome === 'death') {
    exp.hp = 0
    exp.retreatReason = 'death'
    exp.killedBy = exp.killedBy ?? '検証用の強制終了'
  } else {
    exp.retreatReason = exp.retreatReason ?? 'target'
  }
  stepGame(game.state, 1)
}

/** 進行中の遠征を捨てて、同じ設定で引き直す(運の偏りを見たいとき用)。 */
export function rerollExpedition(): void {
  const exp = game.state.expedition
  if (!exp) return
  exp.seed = newSeed()
}

export function reset(): void {
  game.reset()
}
