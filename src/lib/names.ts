/**
 * names.ts — 冒険者の名前DB。
 *
 * 遠征者は死ぬと入れ替わるので、この表から次の遠征者が引かれる。
 * 数値バランスではないため config.ts ではなくこちら側に置く
 * (出現確率だけは CONFIG.naming にある)。
 *
 * 名前は遠征記の本文に何度も出るので、短く読みやすいものを選んでいる。
 */
import { CONFIG } from '../config'
import type { Rng } from './rng'

/** 名。二つ名が付かないときはこれだけが表示名になる。 */
export const GIVEN_NAMES: string[] = [
  'ユーリ', 'セルカ', 'ミレイ', 'ノア', 'リーヴ', 'アイナ',
  'クレイ', 'ソラン', 'ヴェル', 'ミナ', 'テオ', 'ルカ',
  'サーシャ', 'イーリス', 'ハル', 'ネリ', 'オルガ', 'ジン',
  'フィン', 'カイ', 'レナ', 'トビ', 'シオン', 'アリカ',
  'ベル', 'ドナ', 'エリク', 'マチカ', 'ヨナ', 'ロイ',
  'ステラ', 'グレン', 'ニケ', 'リタ', 'セイ', 'アズサ',
  'ラウ', 'ミハイ', 'コウ', 'エマ', 'ヴィト', 'サキ',
  'ノエル', 'ダン', 'リリ', 'ツバキ', 'ガイ', 'ユキ',
  'レイラ', 'ボリス', 'アカネ', 'パーシ', 'スイ', 'マルコ',
  'ヒナ', 'オーウェン', 'シズ', 'ラナ', 'クロト', 'ミオ'
]

/**
 * 二つ名。ギルドで呼ばれている渾名という体裁で、名の前に付く。
 * 「なぜそう呼ばれているのか」が想像できるものにしてある。
 */
export const EPITHETS: string[] = [
  '灰かぶりの', '三度死んだ', '片眼の', '鉄砂の', '泥まみれの',
  '遅咲きの', '無口な', '名うての', '借金持ちの', '石頭の',
  '夜目の利く', '縄抜けの', '火傷の', '大食らいの', '足早の',
  '眠り好きの', '数え上手の', '縁起担ぎの', '血の気の多い', '薄氷の',
  '靴音のしない', '十三番目の', '迷子の', '錆びついた', '二枚舌の',
  '雨降らしの', '寡黙な', '生き汚い'
]

/** 表示名の最大長。これを超える手入力は切り詰める。 */
export const MAX_NAME_LENGTH = 16

/** DBから1人ぶんの名前を引く。一定確率で二つ名が付く。 */
export function randomHeroName(rng: Rng): string {
  const given = rng.pick(GIVEN_NAMES)
  if (!rng.chance(CONFIG.naming.epithetChance)) return given
  return `${rng.pick(EPITHETS)}${given}`
}

/**
 * 手入力の名前を整える。
 * 空白だけ・長すぎる入力を弾き、使えないなら null を返す(呼び出し側で引き直す)。
 */
export function sanitizeHeroName(input: string): string | null {
  const trimmed = input.replace(/\s+/g, ' ').trim()
  if (trimmed.length === 0) return null
  return [...trimmed].slice(0, MAX_NAME_LENGTH).join('')
}
