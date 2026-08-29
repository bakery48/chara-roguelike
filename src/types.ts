import type { UpgradeId } from './config'

export type EventType = 'battle' | 'chest' | 'trap'

export type EventOutcome =
  | 'victory'      // 敵を撃破
  | 'disengage'    // 取り逃がして離脱
  | 'defeat'       // 敗北(=死亡)
  | 'loot'         // 宝箱を開けた
  | 'triggered'    // 罠にかかった
  | 'evaded'       // 罠を回避した
  | 'descend'      // 次の階層へ
  | 'retreat'      // 撤退開始
  | 'arrive'       // 帰還
  | 'depart'       // 出発

/** 遠征中の全イベントを残す構造化ログ。遠征記の素材になる。 */
export interface LogEntry {
  /** 遠征開始からの経過(ms)。 */
  t: number
  floor: number
  type: EventType | 'meta'
  outcome: EventOutcome
  enemy?: string
  item?: string
  damage?: number
  gold?: number
  hp: number
  maxHp: number
  /** 画面のリアルタイムログに出す整形済みテキスト。 */
  text: string
}

export type RetreatReason =
  | 'hp'          // HP撤退ライン到達
  | 'target'      // 目標階層に到達
  | 'clear'       // 最深階を踏破
  | 'death'       // 死亡

export interface Expedition {
  /** 第 n 次遠征。 */
  index: number
  seed: number
  floor: number
  /** その階で消化したイベント数 / その階のイベント総数。 */
  eventIndex: number
  eventCount: number
  hp: number
  maxHp: number
  atk: number
  def: number
  /** 遠征速度倍率(図書館)。 */
  speed: number
  gold: number
  /** 深度から積み上がる遺産ポイント(ペナルティ適用前)。 */
  depthLegacy: number
  kills: number
  treasures: string[]
  log: LogEntry[]
  phase: 'descending' | 'event' | 'returning' | 'done'
  /** 現在フェーズの残り時間(ms)。 */
  timer: number
  /** 遠征開始からの経過(ms)。 */
  elapsed: number
  deepestFloor: number
  outcome?: 'return' | 'death'
  retreatReason?: RetreatReason
  killedBy?: string
  /** この遠征に出た冒険者の表示名(二つ名込み)。代替わりしても記録は残る。 */
  heroName: string
  /** この遠征に出た冒険者の二つ名ID。 */
  epithet: string
  /** 二つ名を反映した、この遠征中の判定値。 */
  mods: ExpeditionMods
  /** 出発時の設定のスナップショット(遠征記で参照する)。 */
  settings: RetreatSettings
}

/**
 * 二つ名を織り込んだあとの、遠征中に参照される確定値。
 * 出発時に解決して遠征に焼き付けるので、途中で改名しても結果は変わらない。
 */
export interface ExpeditionMods {
  goldMul: number
  legacyMul: number
  critChance: number
  trapEvade: number
  trapDamageMul: number
  treasureChance: number
  /** 死亡時にロストするゴールドの割合。 */
  deathGoldLossRate: number
  maxRounds: number
}

export interface RetreatSettings {
  /** HPがこの%を下回ったら帰還。0 は「HPでは撤退しない」。 */
  hpPct: number
  /** この階に到達したら帰還。 */
  targetFloor: number
  /** 強欲: 撤退条件を無視して潜り続ける。 */
  greedy: boolean
  /** 帰還後に自動で次の遠征に出発する。 */
  autoRepeat: boolean
}

/** 遠征記(生成されたテキストと、その素材になった要約)。 */
export interface Chronicle {
  id: string
  index: number
  /** 生成時刻(epoch ms)。 */
  at: number
  text: string
  tags: ChronicleTag[]
  /** 使用したテンプレートID。次の遠征記で同じ文を続けないために残す。 */
  tpl?: string[]
  summary: {
    floor: number
    outcome: 'return' | 'death'
    gold: number
    legacy: number
    kills: number
    durationMs: number
    treasures: string[]
    killedBy?: string
    retreatReason?: RetreatReason
  }
  /** 殿堂入り(名場面)フラグ。 */
  hallOfFame?: HallOfFameKind
}

export type ChronicleTag =
  | 'death'          // 死因
  | 'firstKill'      // 初討伐
  | 'rareFind'       // レア入手
  | 'nearMiss'       // 惜しい撤退
  | 'greedPrice'     // 強欲の代償
  | 'greedReward'    // 強欲の実り
  | 'deepRun'        // 最深到達
  | 'safeReturn'     // 無事帰還
  | 'emptyHanded'    // 空手で帰還
  | 'shallowDeath'   // 浅い階での事故死
  | 'clear'          // 最深階踏破

export type HallOfFameKind = 'firstKill' | 'deepest' | 'strangeDeath' | 'firstClear'

export interface Stats {
  totalExpeditions: number
  returns: number
  deaths: number
  deepestFloor: number
  totalGold: number
  totalKills: number
  /** 初討伐済みの敵名。 */
  slain: string[]
  cleared: boolean
}

export interface GameState {
  version: number
  /** 最終セーブ時刻(epoch ms)。オフライン進行の基準。 */
  lastSaved: number
  legacy: number
  upgrades: Record<UpgradeId, number>
  /** 現在の冒険者の名(二つ名を含まない)。空文字なら未登録(初回起動時の命名待ち)。 */
  heroName: string
  /** 現在の冒険者の二つ名ID。抽選でのみ決まり、改名しても変わらない。 */
  heroEpithet: string
  /** 何人目の冒険者か。死亡して代替わりするたびに増える。 */
  heroGeneration: number
  /** 死亡したときに新しい冒険者を迎えるか。 */
  renameOnDeath: boolean
  settings: RetreatSettings
  expedition: Expedition | null
  /** 直近に完了した遠征のログ(待機中も画面に残すため)。 */
  lastLog: LogEntry[]
  /** 帰還後の待機残り時間(ms)。 */
  restockTimer: number
  status: 'idle' | 'expedition' | 'restock'
  chronicles: Chronicle[]
  stats: Stats
  nextIndex: number
  rngSeed: number
}

/** オフライン進行の結果サマリ。 */
export interface OfflineReport {
  elapsedMs: number
  expeditions: number
  legacyGained: number
  deepest: number
  deaths: number
}
