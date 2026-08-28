/**
 * 決定論的な擬似乱数(mulberry32)。
 * 遠征ごとに seed を持たせることで、オフライン進行と実時間進行の結果が一致する。
 */
export class Rng {
  private s: number

  constructor(seed: number) {
    this.s = seed >>> 0
  }

  /** 0 以上 1 未満。 */
  next(): number {
    this.s = (this.s + 0x6d2b79f5) >>> 0
    let t = this.s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }

  /** min 以上 max 未満の実数。 */
  range(min: number, max: number): number {
    return min + this.next() * (max - min)
  }

  /** min 以上 max 以下の整数。 */
  int(min: number, max: number): number {
    return Math.floor(this.range(min, max + 1))
  }

  /** 確率 p で true。 */
  chance(p: number): boolean {
    return this.next() < p
  }

  pick<T>(arr: readonly T[]): T {
    return arr[Math.floor(this.next() * arr.length)]
  }

  /** 重み付き抽選。weights は arr と同じ長さ。 */
  weighted<T>(arr: readonly T[], weights: readonly number[]): T {
    const total = weights.reduce((a, b) => a + b, 0)
    let r = this.next() * total
    for (let i = 0; i < arr.length; i++) {
      r -= weights[i]
      if (r <= 0) return arr[i]
    }
    return arr[arr.length - 1]
  }

  /** 現在の内部状態(セーブ用)。 */
  get state(): number {
    return this.s
  }
}

/** 新しい seed を作る。 */
export function newSeed(): number {
  return (Math.random() * 0xffffffff) >>> 0
}
