/**
 * names.ts — 冒険者の名簿。
 *
 * 冒険者は「二つ名の抽選」と「名の抽選」で現れる。
 *  - 二つ名 … 能力を決める特性。抽選でしか決まらない。
 *  - 名     … 表示だけ。プレイヤーが自由に改名できる。
 * こう分けているので、自分で命名しても有利不利は生まれない。
 *
 * 効果の数値は config.ts の CONFIG.traits にあり、説明文はそこから
 * 自動生成する(describeTrait)。文言と数値がずれることはない。
 */
import { CONFIG, traitMods, type TraitId, type TraitMods } from '../config'
import type { Rng } from './rng'

/** 名。二つ名の後ろに付いて表示名になる。 */
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

export interface Epithet {
  id: TraitId
  /** 表示名の頭に付く文字列。 */
  label: string
  /** その二つ名で呼ばれる由来。効果そのものは数値から自動生成する。 */
  lore: string
}

/** 二つ名＝特性。効果は CONFIG.traits[id]。 */
export const EPITHETS: Epithet[] = [
  { id: 'hayaashi', label: '足早の', lore: '同じ道を誰より早く抜ける' },
  { id: 'ishiatama', label: '石頭の', lore: '落石を頭で受けて笑っていた' },
  { id: 'yome', label: '夜目の利く', lore: '暗がりで光るものを見逃さない' },
  { id: 'chinoke', label: '血の気の多い', lore: '斬りかかる前に足元を見ない' },
  { id: 'oogurai', label: '大食らいの', lore: '蓄えは多いが、稼ぎは腹に消える' },
  { id: 'sandoshinda', label: '三度死んだ', lore: '三度担ぎ出され、三度戻ってきた' },
  { id: 'tessa', label: '鉄砂の', lore: '砂鉄を縫い込んだ外套を手放さない' },
  { id: 'nawanuke', label: '縄抜けの', lore: 'どんな仕掛けからも先に抜ける' },
  { id: 'kazoejouzu', label: '数え上手の', lore: '取り分の勘定でしくじらない' },
  { id: 'osozaki', label: '遅咲きの', lore: '歩みは遅いが、持ち帰るものは重い' },
  { id: 'katame', label: '片眼の', lore: '見える方の眼で急所だけを見る' },
  { id: 'haikaburi', label: '灰かぶりの', lore: '報われぬ仕事ばかり引き受けてきた' },
  { id: 'shakkin', label: '借金持ちの', lore: 'よく稼ぐが、手元には残らない' },
  { id: 'kutsuoto', label: '靴音のしない', lore: '踏んだ床が鳴らない' },
  { id: 'usurai', label: '薄氷の', lore: '一撃は重く、身は薄い' },
  { id: 'ikigitanai', label: '生き汚い', lore: '倒れてもなお袋を離さない' },
  { id: 'engi', label: '縁起担ぎの', lore: '出発前の験担ぎを欠かさない' },
  { id: 'juusan', label: '十三番目の', lore: '不吉と噂されるが、実入りはいい' },
  { id: 'amefurashi', label: '雨降らしの', lore: '行く先で必ず何かが起きる' },
  { id: 'nemurizuki', label: '眠り好きの', lore: 'よく寝るぶん、よく保つ' },
  { id: 'doromamire', label: '泥まみれの', lore: '汚れを厭わず這って進む' },
  { id: 'nadate', label: '名うての', lore: '名が売れた分、取り分も削られる' },
  { id: 'yakedo', label: '火傷の', lore: '痛みの通り道を知っている' },
  { id: 'maigo', label: '迷子の', lore: '道を外れた先で妙なものを拾う' },
  { id: 'sabi', label: '錆びついた', lore: '刃は鈍いが、鎧は厚い' },
  { id: 'kamoku', label: '寡黙な', lore: '黙って、そつなくこなす' }
]

const BY_ID = new Map(EPITHETS.map((e) => [e.id, e]))

export function findEpithet(id: TraitId): Epithet | undefined {
  return BY_ID.get(id)
}

/** 表示名。二つ名 + 名。 */
export function displayName(epithetId: TraitId, given: string): string {
  return `${findEpithet(epithetId)?.label ?? ''}${given}`
}

/* ── 効果の説明文(数値から自動生成) ─────────────────── */

type ModKey = keyof TraitMods

/** 掛け算の修正: ラベルと、「大きいほど良いか」。 */
const MUL_LABELS: { key: ModKey; label: string; higherIsBetter: boolean }[] = [
  { key: 'maxHpMul', label: '最大HP', higherIsBetter: true },
  { key: 'atkMul', label: '攻撃力', higherIsBetter: true },
  { key: 'speedMul', label: '遠征速度', higherIsBetter: true },
  { key: 'goldMul', label: '獲得ゴールド', higherIsBetter: true },
  { key: 'legacyMul', label: '遺産獲得', higherIsBetter: true },
  { key: 'trapDamageMul', label: '罠ダメージ', higherIsBetter: false },
  { key: 'treasureChanceMul', label: 'お宝率', higherIsBetter: true },
  { key: 'deathGoldLossMul', label: '死亡時ロスト', higherIsBetter: false }
]

/** 足し算の修正。 */
const ADD_LABELS: { key: ModKey; label: string; percent: boolean }[] = [
  { key: 'defAdd', label: '防御力', percent: false },
  { key: 'critChanceAdd', label: '会心率', percent: true },
  { key: 'trapEvadeAdd', label: '罠回避', percent: true },
  { key: 'maxRoundsAdd', label: '継戦', percent: false }
]

export interface TraitEffect {
  text: string
  /** その項目が有利か不利か(表示の色分けに使う)。 */
  good: boolean
}

/** 二つ名の効果を、config の数値から文章にする。 */
export function describeTrait(id: TraitId): TraitEffect[] {
  const mods = traitMods(id)
  const out: TraitEffect[] = []

  for (const { key, label, higherIsBetter } of MUL_LABELS) {
    const v = mods[key]
    if (v === undefined || v === 1) continue
    const pct = Math.round((v - 1) * 100)
    out.push({
      text: `${label} ${pct > 0 ? '+' : ''}${pct}%`,
      good: pct > 0 === higherIsBetter
    })
  }

  for (const { key, label, percent } of ADD_LABELS) {
    const v = mods[key]
    if (v === undefined || v === 0) continue
    const shown = percent ? Math.round(v * 100) : v
    out.push({
      text: `${label} ${shown > 0 ? '+' : ''}${shown}${percent ? 'pt' : ''}`,
      good: v > 0
    })
  }

  return out
}

/** 効果を1行にまとめる。 */
export function traitSummary(id: TraitId): string {
  const parts = describeTrait(id)
  return parts.length === 0 ? '特筆すべき癖はない' : parts.map((p) => p.text).join(' / ')
}

/* ── 抽選 ────────────────────────────────────────── */

export interface HeroDraw {
  /** 二つ名(特性)。抽選でしか決まらない。 */
  epithet: TraitId
  /** 名。改名で自由に変えられる。 */
  given: string
}

/** 冒険者を1人引く。二つ名と名を別々に抽選する。 */
export function drawHero(rng: Rng): HeroDraw {
  return { epithet: rng.pick(EPITHETS).id, given: rng.pick(GIVEN_NAMES) }
}

/** 名だけを引き直す(二つ名＝特性は変わらない)。 */
export function drawGivenName(rng: Rng): string {
  return rng.pick(GIVEN_NAMES)
}

/** 表示名の最大長。これを超える手入力は切り詰める。 */
export const MAX_NAME_LENGTH = 16

/**
 * 手入力の名前を整える。
 * 空白だけ・長すぎる入力を弾き、使えないなら null を返す(呼び出し側で引き直す)。
 */
export function sanitizeHeroName(input: string): string | null {
  const trimmed = input.replace(/\s+/g, ' ').trim()
  if (trimmed.length === 0) return null
  return [...trimmed].slice(0, MAX_NAME_LENGTH).join('')
}

/** 二つ名の一覧に、config 側の効果定義が揃っているか(テスト用)。 */
export function epithetsWithoutMods(): TraitId[] {
  return EPITHETS.filter((e) => CONFIG.traits[e.id] === undefined).map((e) => e.id)
}
