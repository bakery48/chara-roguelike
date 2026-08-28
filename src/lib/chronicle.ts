/**
 * chronicle.ts — 構造化ログから「遠征記」を合成する。
 *
 * 1. ログを走査してハイライト(facts)を抽出
 * 2. facts に合うテンプレートを 導入/中盤/結び の各プールから抽選
 * 3. スロットを埋めて 2〜4 文の文章にする
 */
import { CONFIG } from '../config'
import { TRAPS } from './content'
import { Rng } from './rng'
import { CLOSINGS, MIDDLES, OPENINGS, type Template } from './templates'
import type {
  Chronicle,
  ChronicleTag,
  Expedition,
  GameState,
  HallOfFameKind,
  RetreatReason
} from '../types'
import type { Settlement } from './expedition'

export interface ChronicleFacts {
  index: number
  hero: string
  dungeon: string
  floor: number
  outcome: 'return' | 'death'
  retreatReason?: RetreatReason
  greedy: boolean
  hpLine: number
  target: number
  forgeLevel: number
  previousOutcome?: 'return' | 'death'
  gold: number
  legacy: number
  kills: number
  disengages: number
  maxHp: number
  lowestHpPct: number
  firstKills: string[]
  firstKillFloor: number
  treasures: string[]
  treasureFloor: number
  trapCount: number
  worstTrap?: string
  trapFloor: number
  toughest?: string
  toughestDamage: number
  isDeepRun: boolean
  newRecord: boolean
  /** 初めて最深部を踏破した遠征か。 */
  firstClear: boolean
  killer?: string
  killerKind?: 'enemy' | 'trap'
  durationMs: number
}

/** 遠征ログとゲーム状態からハイライトを抽出する。 */
export function extractFacts(
  exp: Expedition,
  settlement: Settlement,
  state: GameState
): ChronicleFacts {
  const known = new Set(state.stats.slain)
  const firstKills: string[] = []
  let firstKillFloor = 0
  const treasures: string[] = []
  let treasureFloor = 0
  let trapCount = 0
  let worstTrap: string | undefined
  let worstTrapDamage = 0
  let trapFloor = 0
  let toughest: string | undefined
  let toughestDamage = 0
  let disengages = 0
  let lowestHp = exp.maxHp

  for (const e of exp.log) {
    if (e.hp < lowestHp && e.type !== 'meta') lowestHp = e.hp
    if (e.type === 'battle') {
      if (e.outcome === 'victory' && e.enemy && !known.has(e.enemy)) {
        known.add(e.enemy)
        firstKills.push(e.enemy)
        if (!firstKillFloor) firstKillFloor = e.floor
      }
      if (e.outcome === 'disengage') disengages++
      if (e.enemy && (e.damage ?? 0) > toughestDamage) {
        toughest = e.enemy
        toughestDamage = e.damage ?? 0
      }
    } else if (e.type === 'chest') {
      if (e.item) {
        treasures.push(e.item)
        if (!treasureFloor) treasureFloor = e.floor
      }
    } else if (e.type === 'trap' && e.outcome === 'triggered') {
      trapCount++
      if ((e.damage ?? 0) > worstTrapDamage) {
        worstTrapDamage = e.damage ?? 0
        worstTrap = e.item
        trapFloor = e.floor
      }
    }
  }

  const prev = state.chronicles[state.chronicles.length - 1]
  const killerKind = exp.killedBy
    ? TRAPS.includes(exp.killedBy)
      ? 'trap'
      : 'enemy'
    : undefined

  return {
    index: exp.index,
    hero: CONFIG.hero.name,
    dungeon: CONFIG.dungeon.name,
    floor: exp.deepestFloor,
    outcome: settlement.outcome,
    retreatReason: exp.retreatReason,
    greedy: exp.settings.greedy,
    hpLine: exp.settings.hpPct,
    target: exp.settings.targetFloor,
    forgeLevel: state.upgrades.forge,
    previousOutcome: prev?.summary.outcome,
    gold: settlement.gold,
    legacy: settlement.legacy,
    kills: exp.kills,
    disengages,
    maxHp: Math.round(exp.maxHp),
    lowestHpPct: Math.max(0, Math.round((lowestHp / exp.maxHp) * 100)),
    firstKills,
    firstKillFloor,
    treasures,
    treasureFloor,
    trapCount,
    worstTrap,
    trapFloor,
    toughest,
    toughestDamage: Math.round(toughestDamage),
    isDeepRun: exp.deepestFloor >= CONFIG.dungeon.maxFloor * CONFIG.chronicle.deepRunRatio,
    newRecord: exp.deepestFloor > state.stats.deepestFloor && exp.deepestFloor > 1,
    firstClear: exp.retreatReason === 'clear' && !state.stats.cleared,
    killer: exp.killedBy,
    killerKind,
    durationMs: Math.round(exp.elapsed)
  }
}

const SLOTS: Record<string, (f: ChronicleFacts) => string | number> = {
  index: (f) => f.index,
  hero: (f) => f.hero,
  dungeon: (f) => f.dungeon,
  floor: (f) => f.floor,
  gold: (f) => f.gold,
  legacy: (f) => f.legacy,
  kills: (f) => f.kills,
  target: (f) => f.target,
  hpLine: (f) => f.hpLine,
  remain: (f) => Math.max(1, f.target - f.floor),
  lowestHpPct: (f) => f.lowestHpPct,
  killer: (f) => f.killer ?? '何か',
  firstKill: (f) => f.firstKills[0] ?? '名も知れぬ何か',
  firstKillFloor: (f) => f.firstKillFloor,
  treasure: (f) => f.treasures[0] ?? '拾い物',
  treasureCount: (f) => f.treasures.length,
  floorOfTreasure: (f) => f.treasureFloor,
  trap: (f) => f.worstTrap ?? '仕掛け',
  trapFloor: (f) => f.trapFloor,
  trapCount: (f) => f.trapCount,
  toughest: (f) => f.toughest ?? '相手',
  toughestDamage: (f) => f.toughestDamage,
  maxHp: (f) => f.maxHp
}

function fill(text: string, f: ChronicleFacts): string {
  return text.replace(/\{(\w+)\}/g, (m, key: string) => {
    const fn = SLOTS[key]
    return fn ? String(fn(f)) : m
  })
}

/**
 * テンプレートを1つ選ぶ。
 * `exclude` は絶対に使わないもの、`avoid` は「他に選択肢があるなら避けたい」もの
 * (前回の遠征記と同じ文、他に見せ場があるときの「淡々としていた」など)。
 */
function choose(
  pool: Template[],
  f: ChronicleFacts,
  rng: Rng,
  exclude: Set<string>,
  avoid: Set<string> = new Set()
): Template | null {
  const eligible = pool.filter((t) => !exclude.has(t.id) && t.when(f))
  if (eligible.length === 0) return null
  const preferred = eligible.filter((t) => !avoid.has(t.id))
  const pick = preferred.length > 0 ? preferred : eligible
  return rng.weighted(pick, pick.map((t) => t.weight ?? 1))
}

/** 殿堂入り判定。 */
function hallOfFame(f: ChronicleFacts, state: GameState): HallOfFameKind | undefined {
  if (f.retreatReason === 'clear' && !state.stats.cleared) return 'firstClear'
  if (f.outcome === 'death' && f.floor <= 2) return 'strangeDeath'
  if (f.firstKills.length > 0 && state.stats.slain.length === 0) return 'firstKill'
  if (f.newRecord) return 'deepest'
  return undefined
}

/** 遠征記を1本生成する。 */
export function composeChronicle(
  exp: Expedition,
  settlement: Settlement,
  state: GameState
): Chronicle {
  const f = extractFacts(exp, settlement, state)
  // 同じ遠征からは常に同じ文章が出るよう、index と seed からシードを作る。
  const rng = new Rng((exp.index * 2654435761 + exp.seed) >>> 0)
  const used = new Set<string>()
  const parts: string[] = []
  const tags = new Set<ChronicleTag>()
  // 直前の遠征記と同じ文が並ばないようにする。
  const avoid = new Set(state.chronicles[state.chronicles.length - 1]?.tpl ?? [])

  const opening = choose(OPENINGS, f, rng, used, avoid)
  if (opening) {
    used.add(opening.id)
    parts.push(fill(opening.text, f))
    opening.tags.forEach((t) => tags.add(t))
  }

  // 中盤は 1〜2 文。見せ場が多いときだけ 2 文にする。
  const middleCount = f.firstKills.length + f.treasures.length + f.trapCount >= 3 ? 2 : 1
  for (let i = 0; i < middleCount; i++) {
    // 「道中は淡々としていた」は最後の受け皿。他に書けることがあるなら使わない。
    const m = choose(MIDDLES, f, rng, used, new Set([...avoid, 'mid.quiet']))
    if (!m) break
    used.add(m.id)
    // 受け皿しか残っていない状況で2文目を足すと矛盾するので打ち切る。
    if (m.id === 'mid.quiet' && parts.length > 1) break
    parts.push(fill(m.text, f))
    m.tags.forEach((t) => tags.add(t))
  }

  const closing = choose(CLOSINGS, f, rng, used, avoid)
  if (closing) {
    used.add(closing.id)
    parts.push(fill(closing.text, f))
    closing.tags.forEach((t) => tags.add(t))
  }

  // 文面の選ばれ方に関わらず、事実として成立するタグは必ず付ける。
  if (f.outcome === 'death') tags.add('death')
  if (f.newRecord) tags.add('deepRun')
  if (f.firstKills.length > 0) tags.add('firstKill')
  if (f.treasures.length > 0) tags.add('rareFind')

  return {
    id: `${exp.index}-${exp.seed.toString(36)}`,
    index: exp.index,
    at: Date.now(),
    text: parts.join(''),
    tags: [...tags],
    tpl: [...used],
    summary: {
      floor: f.floor,
      outcome: f.outcome,
      gold: f.gold,
      legacy: f.legacy,
      kills: f.kills,
      durationMs: f.durationMs,
      treasures: f.treasures,
      killedBy: f.killer,
      retreatReason: f.retreatReason
    },
    hallOfFame: hallOfFame(f, state)
  }
}

export interface DigestGroup {
  kind: 'digest'
  from: number
  to: number
  count: number
  deepest: number
  deaths: number
  gold: number
}

export type TimelineItem = { kind: 'entry'; chronicle: Chronicle } | DigestGroup

/**
 * 高速周回時のダイジェスト化。
 * 平凡(殿堂入りでもタグ無しでもない)な遠征が連続したらまとめる。
 */
export function buildTimeline(chronicles: Chronicle[]): TimelineItem[] {
  const notable = (c: Chronicle) =>
    !!c.hallOfFame ||
    c.tags.some((t) =>
      (['death', 'firstKill', 'rareFind', 'clear', 'deepRun', 'greedPrice'] as ChronicleTag[]).includes(t)
    )

  const items: TimelineItem[] = []
  let run: Chronicle[] = []

  const flush = () => {
    if (run.length === 0) return
    if (run.length < CONFIG.chronicle.digestThreshold) {
      for (const c of run) items.push({ kind: 'entry', chronicle: c })
    } else {
      items.push({
        kind: 'digest',
        from: run[0].index,
        to: run[run.length - 1].index,
        count: run.length,
        deepest: Math.max(...run.map((c) => c.summary.floor)),
        deaths: run.filter((c) => c.summary.outcome === 'death').length,
        gold: run.reduce((a, c) => a + c.summary.gold, 0)
      })
    }
    run = []
  }

  for (const c of chronicles) {
    if (notable(c)) {
      flush()
      items.push({ kind: 'entry', chronicle: c })
    } else {
      run.push(c)
    }
  }
  flush()
  return items
}
