/**
 * expedition.ts — 遠征シミュレーションの純粋ロジック。
 *
 * 実時間の進行もオフライン進行も同じ `advanceExpedition` を通す。
 * 乱数は遠征ごとの seed から決定論的に引くので、同じ入力からは同じ結末になる。
 */
import { CONFIG, floorGold, floorLegacy, traitMods, type TraitId, type UpgradeId } from '../config'
import { ENEMIES, TRAPS, TREASURES } from './content'
import { displayName } from './names'
import { Rng, newSeed } from './rng'
import type {
  EventType,
  Expedition,
  ExpeditionMods,
  GameState,
  LogEntry,
  RetreatSettings
} from '../types'

export interface HeroStats {
  maxHp: number
  atk: number
  def: number
  /** 遠征速度倍率(大きいほど速い)。 */
  speed: number
  /** 遺産ポイント獲得倍率。 */
  legacyMul: number
}

/** 恒久強化と二つ名を反映したヒーローの能力値。 */
export function heroStats(
  upgrades: Record<UpgradeId, number>,
  epithet: TraitId = ''
): HeroStats {
  const h = CONFIG.hero
  const u = CONFIG.upgrades
  const lib = upgrades.library
  const t = traitMods(epithet)
  return {
    maxHp: Math.round((h.baseMaxHp + upgrades.tavern * u.tavern.hpPerLevel) * (t.maxHpMul ?? 1)),
    atk: (h.baseAtk + upgrades.forge * u.forge.atkPerLevel) * (t.atkMul ?? 1),
    def: h.baseDef + (t.defAdd ?? 0),
    speed:
      Math.min(u.library.maxSpeedMul, 1 + lib * u.library.speedPerLevel) * (t.speedMul ?? 1),
    legacyMul: (1 + lib * u.library.legacyPerLevel) * (t.legacyMul ?? 1)
  }
}

/** 二つ名を織り込んだ、遠征中の判定値を解決する。 */
export function resolveMods(epithet: TraitId): ExpeditionMods {
  const t = traitMods(epithet)
  return {
    goldMul: t.goldMul ?? 1,
    legacyMul: t.legacyMul ?? 1,
    critChance: Math.max(0, CONFIG.hero.critChance + (t.critChanceAdd ?? 0)),
    trapEvade: Math.min(0.95, Math.max(0, CONFIG.trap.evadeChance + (t.trapEvadeAdd ?? 0))),
    trapDamageMul: t.trapDamageMul ?? 1,
    treasureChance: Math.min(1, CONFIG.rewards.treasureChance * (t.treasureChanceMul ?? 1)),
    deathGoldLossRate: Math.min(1, CONFIG.death.goldLossRate * (t.deathGoldLossMul ?? 1)),
    maxRounds: CONFIG.enemy.maxRounds + (t.maxRoundsAdd ?? 0)
  }
}

/** 階層 floor でのイベント種別の重み(浅い/深いを線形補間)。 */
function eventWeights(floor: number): Record<EventType, number> {
  const { shallow, deep } = CONFIG.dungeon.eventWeights
  const max = CONFIG.dungeon.maxFloor
  const t = max <= 1 ? 0 : (floor - 1) / (max - 1)
  return {
    battle: shallow.battle + (deep.battle - shallow.battle) * t,
    chest: shallow.chest + (deep.chest - shallow.chest) * t,
    trap: shallow.trap + (deep.trap - shallow.trap) * t
  }
}

function pickEnemy(rng: Rng, floor: number): string {
  const eligible = ENEMIES.filter((e) => e.minFloor <= floor)
  const table = eligible.length > 1 && rng.chance(0.3)
    ? rng.pick(eligible.slice(0, -1))
    : eligible[eligible.length - 1]
  return rng.pick(table.names)
}

/** 新しい遠征を作る。 */
export function createExpedition(state: GameState): Expedition {
  const stats = heroStats(state.upgrades, state.heroEpithet)
  return {
    index: state.nextIndex,
    seed: newSeed(),
    floor: 0,
    eventIndex: 0,
    eventCount: 0,
    hp: stats.maxHp,
    maxHp: stats.maxHp,
    atk: stats.atk,
    def: stats.def,
    speed: stats.speed,
    gold: 0,
    depthLegacy: 0,
    kills: 0,
    treasures: [],
    log: [],
    phase: 'descending',
    timer: CONFIG.time.descendMs / stats.speed,
    elapsed: 0,
    deepestFloor: 0,
    heroName: displayName(state.heroEpithet, state.heroName),
    epithet: state.heroEpithet,
    mods: resolveMods(state.heroEpithet),
    settings: { ...state.settings }
  }
}

function log(exp: Expedition, entry: Omit<LogEntry, 't' | 'hp' | 'maxHp'>): void {
  exp.log.push({
    ...entry,
    t: Math.round(exp.elapsed),
    hp: Math.max(0, Math.round(exp.hp)),
    maxHp: Math.round(exp.maxHp)
  })
}

/** 撤退すべきか判定する。強欲設定はHP/目標階層の条件を無視する。 */
function shouldRetreat(exp: Expedition, atFloorEnd: boolean): boolean {
  if (exp.floor >= CONFIG.dungeon.maxFloor && atFloorEnd) {
    exp.retreatReason = 'clear'
    return true
  }
  if (exp.settings.greedy) return false
  const s = exp.settings
  if (s.hpPct > 0 && exp.hp / exp.maxHp < s.hpPct / 100) {
    exp.retreatReason = 'hp'
    return true
  }
  if (atFloorEnd && exp.floor >= s.targetFloor) {
    exp.retreatReason = 'target'
    return true
  }
  return false
}

function beginReturn(exp: Expedition): void {
  exp.phase = 'returning'
  exp.timer = (CONFIG.time.returnMsPerFloor * Math.max(1, exp.floor)) / exp.speed
  const why =
    exp.retreatReason === 'clear'
      ? '最深部を踏破した。帰路につく。'
      : exp.retreatReason === 'hp'
        ? '撤退ラインに到達。踵を返す。'
        : '目標階層に到達。引き上げる。'
  log(exp, { floor: exp.floor, type: 'meta', outcome: 'retreat', text: why })
}

function die(exp: Expedition, killedBy: string): void {
  exp.hp = 0
  exp.phase = 'done'
  exp.outcome = 'death'
  exp.retreatReason = 'death'
  exp.killedBy = killedBy
}

/** 戦闘を1イベント分まとめて解決する。 */
function resolveBattle(exp: Expedition, rng: Rng): void {
  const c = CONFIG
  const f = exp.floor
  const name = pickEnemy(rng, f)
  let ehp = c.enemy.hpBase * Math.pow(c.enemy.hpGrowth, f - 1)
  const eatk = c.enemy.atkBase * Math.pow(c.enemy.atkGrowth, f - 1)
  let taken = 0

  for (let round = 0; round < exp.mods.maxRounds; round++) {
    const v = c.hero.damageVariance
    let dmg = exp.atk * rng.range(1 - v, 1 + v)
    if (rng.chance(exp.mods.critChance)) dmg *= c.hero.critMultiplier
    ehp -= dmg
    if (ehp <= 0) {
      exp.kills++
      const gold = Math.round(floorGold(f) * c.rewards.battleGoldMul * exp.mods.goldMul)
      exp.gold += gold
      log(exp, {
        floor: f,
        type: 'battle',
        outcome: 'victory',
        enemy: name,
        damage: Math.round(taken),
        gold,
        text: `${name}を撃破。${gold}Gを得た。（被ダメージ ${Math.round(taken)}）`
      })
      return
    }
    const hit = Math.max(1, eatk * rng.range(1 - v, 1 + v) - exp.def)
    exp.hp -= hit
    taken += hit
    if (exp.hp <= 0) {
      log(exp, {
        floor: f,
        type: 'battle',
        outcome: 'defeat',
        enemy: name,
        damage: Math.round(taken),
        text: `${name}に敗れた。`
      })
      die(exp, name)
      return
    }
  }

  // ラウンド上限: 倒しきれず離脱
  const parting = Math.max(1, eatk * c.enemy.disengageDamageMul - exp.def)
  exp.hp -= parting
  taken += parting
  if (exp.hp <= 0) {
    log(exp, {
      floor: f,
      type: 'battle',
      outcome: 'defeat',
      enemy: name,
      damage: Math.round(taken),
      text: `${name}を振り切れなかった。`
    })
    die(exp, name)
    return
  }
  log(exp, {
    floor: f,
    type: 'battle',
    outcome: 'disengage',
    enemy: name,
    damage: Math.round(taken),
    text: `${name}を倒しきれず離脱。（被ダメージ ${Math.round(taken)}）`
  })
}

function resolveChest(exp: Expedition, rng: Rng): void {
  const c = CONFIG
  const f = exp.floor
  let gold = Math.round(floorGold(f) * c.rewards.chestGoldMul * exp.mods.goldMul)
  let item: string | undefined
  if (rng.chance(exp.mods.treasureChance)) {
    item = rng.pick(TREASURES)
    gold += Math.round(floorGold(f) * c.rewards.treasureGoldMul * exp.mods.goldMul)
    exp.treasures.push(item)
  }
  exp.gold += gold
  log(exp, {
    floor: f,
    type: 'chest',
    outcome: 'loot',
    item,
    gold,
    text: item ? `宝箱から ${item} と ${gold}G。` : `宝箱から ${gold}G。`
  })
}

function resolveTrap(exp: Expedition, rng: Rng): void {
  const c = CONFIG
  const f = exp.floor
  const name = rng.pick(TRAPS)
  if (rng.chance(exp.mods.trapEvade)) {
    log(exp, {
      floor: f,
      type: 'trap',
      outcome: 'evaded',
      item: name,
      text: `${name}を回避した。`
    })
    return
  }
  const v = c.trap.variance
  const dmg =
    c.trap.damageBase *
    Math.pow(c.trap.damageGrowth, f - 1) *
    rng.range(1 - v, 1 + v) *
    exp.mods.trapDamageMul
  exp.hp -= dmg
  log(exp, {
    floor: f,
    type: 'trap',
    outcome: 'triggered',
    item: name,
    damage: Math.round(dmg),
    text: `${name}にかかり ${Math.round(dmg)} ダメージ。`
  })
  if (exp.hp <= 0) die(exp, name)
}

/**
 * 遠征を deltaMs だけ進める。
 * 経過時間が長い場合(オフライン進行)は内部でループして一気に消化する。
 */
export function advanceExpedition(exp: Expedition, deltaMs: number): void {
  // 乱数の消費状態は exp.seed に書き戻す。こうすることでセーブ/ロードを挟んでも、
  // またオフライン進行で一気に消化しても、結果が同じになる。
  const draw = <T>(fn: (r: Rng) => T): T => {
    const r = new Rng(exp.seed)
    const out = fn(r)
    exp.seed = r.state
    return out
  }

  let remaining = deltaMs
  let steps = 0
  while (remaining > 0 && exp.phase !== 'done') {
    if (steps++ > CONFIG.time.maxStepsPerAdvance) break
    if (remaining < exp.timer) {
      exp.timer -= remaining
      exp.elapsed += remaining
      remaining = 0
      break
    }
    remaining -= exp.timer
    exp.elapsed += exp.timer
    exp.timer = 0

    if (exp.phase === 'descending') {
      exp.floor++
      exp.deepestFloor = Math.max(exp.deepestFloor, exp.floor)
      exp.eventIndex = 0
      exp.eventCount = draw((r) =>
        r.weighted([1, 2, 3], CONFIG.dungeon.eventCountWeights as unknown as number[])
      )
      log(exp, {
        floor: exp.floor,
        type: 'meta',
        outcome: 'descend',
        text: `${exp.floor}階に到達。`
      })
      exp.phase = 'event'
      exp.timer = CONFIG.time.eventDurationMs / exp.speed
    } else if (exp.phase === 'event') {
      const w = eventWeights(exp.floor)
      const type = draw((r) =>
        r.weighted<EventType>(['battle', 'chest', 'trap'], [w.battle, w.chest, w.trap])
      )
      draw((r) => {
        if (type === 'battle') resolveBattle(exp, r)
        else if (type === 'chest') resolveChest(exp, r)
        else resolveTrap(exp, r)
        return null
      })

      if (exp.outcome === 'death') break // 死亡した時点で打ち切り

      exp.eventIndex++
      const floorDone = exp.eventIndex >= exp.eventCount
      if (floorDone) exp.depthLegacy += floorLegacy(exp.floor)

      if (shouldRetreat(exp, floorDone)) {
        beginReturn(exp)
      } else if (floorDone) {
        exp.phase = 'descending'
        exp.timer = CONFIG.time.descendMs / exp.speed
      } else {
        exp.timer = CONFIG.time.eventDurationMs / exp.speed
      }
    } else if (exp.phase === 'returning') {
      exp.phase = 'done'
      exp.outcome = 'return'
      log(exp, {
        floor: exp.floor,
        type: 'meta',
        outcome: 'arrive',
        text: `拠点に帰還した。戦利品 ${exp.gold}G。`
      })
    }
  }
}

export interface Settlement {
  outcome: 'return' | 'death'
  /** 実際に持ち帰ったゴールド。 */
  gold: number
  /** 失ったゴールド。 */
  goldLost: number
  /** 獲得した遺産ポイント。 */
  legacy: number
  floor: number
}

/** 遠征終了時の精算。死亡ペナルティ・強欲ボーナス・図書館補正をここで掛ける。 */
export function settleExpedition(exp: Expedition, upgrades: Record<UpgradeId, number>): Settlement {
  const c = CONFIG
  const died = exp.outcome === 'death'
  const greedy = exp.settings.greedy
  // 遺産倍率は出発時の二つ名で決まるので、遠征側の値を使う。
  const stats = heroStats(upgrades, exp.epithet)

  let gold = exp.gold
  if (greedy) gold = Math.round(gold * c.retreat.greedGoldMul)
  // ロスト率は二つ名で変わる(「三度死んだ」など)。
  const goldLost = died ? Math.round(gold * exp.mods.deathGoldLossRate) : 0
  gold -= goldLost

  let legacy = exp.depthLegacy
  if (greedy) legacy *= c.retreat.greedLegacyMul
  if (died) legacy *= c.death.legacyKeepRate
  legacy += gold * c.rewards.goldToLegacy
  legacy *= stats.legacyMul

  return {
    outcome: died ? 'death' : 'return',
    gold,
    goldLost,
    legacy: Math.max(0, Math.round(legacy)),
    floor: exp.deepestFloor
  }
}

/** 出発ログを積む(遠征記の書き出しに使う)。 */
export function logDeparture(exp: Expedition, settings: RetreatSettings): void {
  const line = settings.greedy
    ? '撤退線を捨て、深部だけを見据えて出発。'
    : settings.hpPct > 0
      ? `HP${settings.hpPct}%・${settings.targetFloor}階を目安に出発。`
      : `${settings.targetFloor}階を目安に出発。`
  exp.log.push({
    t: 0,
    floor: 0,
    type: 'meta',
    outcome: 'depart',
    hp: Math.round(exp.hp),
    maxHp: Math.round(exp.maxHp),
    text: `第${exp.index}次遠征 — ${exp.heroName}、${line}`
  })
}
