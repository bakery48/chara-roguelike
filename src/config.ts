/**
 * config.ts — 数値バランスの一元管理
 *
 * ゲームロジック側にマジックナンバーを置かず、調整はすべてこのファイルで完結させる。
 * ここを書き換えるだけでバランス調整ができる状態を保つこと。
 */

export const CONFIG = {
  /** セーブデータのスキーマバージョン。増やしたら save.ts にマイグレーションを足す。 */
  saveVersion: 3,

  /** 時間まわり */
  time: {
    /** ゲームループの刻み(ms)。表示更新の粒度。 */
    tickMs: 100,
    /** 1イベントの解決にかかる時間(ms)。 */
    eventDurationMs: 11000,
    /** 次の階層へ降りるのにかかる時間(ms)。 */
    descendMs: 7000,
    /** 帰路にかかる時間(ms) = この値 × 到達階層。 */
    returnMsPerFloor: 2500,
    /** 帰還後、次の遠征に自動出発するまでの待機(ms)。 */
    restockMs: 5000,
    /** オフライン進行の上限(時間)。これを超えた分は切り捨てる。 */
    offlineCapHours: 8,
    /** 1フレームで進めるシミュレーションの上限ステップ数(暴走防止)。 */
    maxStepsPerAdvance: 200000,
    /** 自動セーブ間隔(ms)。 */
    autoSaveMs: 5000
  },

  /** ダンジョン(MVPは1種類・10階まで) */
  dungeon: {
    id: 'ruins',
    name: '朽ちた地下遺構',
    maxFloor: 10,
    /** 各階で発生するイベント数の重み。index+1 が個数。 */
    eventCountWeights: [0.25, 0.5, 0.25],
    /**
     * イベント種別の出現重み。深度に応じて線形補間する。
     * shallow = 1階、deep = maxFloor 階での重み。
     */
    eventWeights: {
      shallow: { battle: 0.55, chest: 0.3, trap: 0.15 },
      deep: { battle: 0.62, chest: 0.16, trap: 0.22 }
    }
  },

  /** ヒーローの基礎能力 */
  hero: {
    /**
     * 旧セーブ(v1)の移行先として残している既定名。
     * 現在の遠征者の名前は GameState.heroName にあり、names.ts から引かれる。
     */
    legacyName: '名もなき遠征者',
    baseMaxHp: 70,
    baseAtk: 10,
    baseDef: 2,
    /** 命中ダメージの揺れ幅(0.85〜1.15倍)。 */
    damageVariance: 0.15,
    /** クリティカル率と倍率。 */
    critChance: 0.12,
    critMultiplier: 1.8
  },

  /** 敵(階層 f でのスケーリング。base × growth^(f-1)) */
  enemy: {
    hpBase: 20,
    hpGrowth: 1.26,
    atkBase: 5,
    atkGrowth: 1.235,
    /** 1戦闘のラウンド上限。超えたら「取り逃がし」扱いで離脱。 */
    maxRounds: 30,
    /** 取り逃がし時に追加で受けるダメージ倍率(敵ATK基準)。 */
    disengageDamageMul: 1.5
  },

  /** 報酬。設計指針どおり reward = base × 1.12^floor */
  rewards: {
    goldBase: 12,
    goldGrowth: 1.12,
    /** 戦闘勝利時の取得ゴールド倍率。 */
    battleGoldMul: 1.0,
    /** 宝箱の取得ゴールド倍率。 */
    chestGoldMul: 2.2,
    /** 宝箱から「お宝」(遠征記の彩り。ステータス効果なし)が出る確率。 */
    treasureChance: 0.28,
    /** お宝のゴールド価値倍率。 */
    treasureGoldMul: 3.0,
    /** 遺産ポイント: 到達階層ごとの獲得量 = base × growth^(floor-1) の総和。 */
    legacyPerFloorBase: 3,
    legacyPerFloorGrowth: 1.22,
    /** 持ち帰ったゴールドの遺産ポイント換算レート。 */
    goldToLegacy: 0.12
  },

  /** 罠 */
  trap: {
    damageBase: 9,
    damageGrowth: 1.16,
    /** 回避に成功する確率。 */
    evadeChance: 0.25,
    /** ダメージの揺れ幅。 */
    variance: 0.2
  },

  /** 撤退ライン(核となる意思決定) */
  retreat: {
    /** HP撤退ラインの選択肢(%)。 */
    hpOptions: [0, 15, 25, 35, 50, 65],
    defaultHpPct: 35,
    /** 目標階層の初期値。 */
    defaultTargetFloor: 5,
    /** 強欲設定の報酬倍率(撤退条件を無視して潜り続ける)。 */
    greedGoldMul: 1.7,
    greedLegacyMul: 1.6
  },

  /** 死亡ペナルティ */
  death: {
    /** ロストするゴールドの割合。 */
    goldLossRate: 0.8,
    /** 死亡時でも獲得できる遺産ポイントの割合。 */
    legacyKeepRate: 0.5
  },

  /**
   * 恒久強化(MVPは3種)。
   * cost = costBase × costGrowth^level(設計指針: 施設は 1.25〜1.5)
   */
  upgrades: {
    forge: {
      id: 'forge',
      name: '鍛冶屋',
      icon: '🔨',
      desc: '攻撃力 +{value}',
      costBase: 25,
      costGrowth: 1.28,
      maxLevel: 25,
      /** 1レベルあたりの攻撃力上昇。 */
      atkPerLevel: 3
    },
    tavern: {
      id: 'tavern',
      name: '酒場',
      icon: '🍺',
      desc: '最大HP +{value}',
      costBase: 20,
      costGrowth: 1.26,
      maxLevel: 25,
      /** 1レベルあたりの最大HP上昇。 */
      hpPerLevel: 16
    },
    library: {
      id: 'library',
      name: '図書館',
      icon: '📚',
      desc: '遠征速度 +{value}% / 遺産獲得 +{value2}%',
      costBase: 40,
      costGrowth: 1.35,
      maxLevel: 15,
      /** 1レベルあたりの遠征速度上昇率。 */
      speedPerLevel: 0.05,
      /** 1レベルあたりの遺産ポイント獲得上昇率。 */
      legacyPerLevel: 0.07,
      /** 遠征速度の上限倍率。 */
      maxSpeedMul: 2.5
    }
  },

  /**
   * 二つ名(＝冒険者の特性)の効果。
   *
   * 冒険者は「二つ名の抽選」と「名の抽選」で現れる。二つ名が能力を決め、
   * 名は表示だけなので、プレイヤーが改名しても有利不利は生まれない。
   *
   * 省略した項目は等倍(1)/加算なし(0)。ラベルと説明文は names.ts 側にあり、
   * 説明文はここの数値から自動生成されるので、文言と数値がずれることはない。
   */
  traits: {
    hayaashi:    { speedMul: 1.15 },
    ishiatama:   { trapDamageMul: 0.5, defAdd: 1 },
    yome:        { treasureChanceMul: 2.0, goldMul: 1.1 },
    chinoke:     { atkMul: 1.25, goldMul: 1.1, trapEvadeAdd: -0.15 },
    oogurai:     { maxHpMul: 1.25, goldMul: 0.92 },
    sandoshinda: { deathGoldLossMul: 0.4 },
    tessa:       { defAdd: 3, maxHpMul: 1.05 },
    nawanuke:    { trapEvadeAdd: 0.3 },
    kazoejouzu:  { goldMul: 1.3 },
    osozaki:     { speedMul: 0.85, legacyMul: 1.35 },
    katame:      { critChanceAdd: 0.2, goldMul: 1.05, atkMul: 0.95 },
    haikaburi:   { legacyMul: 1.2, maxHpMul: 0.9 },
    shakkin:     { goldMul: 1.5, legacyMul: 0.9 },
    kutsuoto:    { trapEvadeAdd: 0.15, treasureChanceMul: 1.5 },
    usurai:      { atkMul: 1.4, goldMul: 1.15, maxHpMul: 0.7 },
    ikigitanai:  { maxHpMul: 1.15, deathGoldLossMul: 0.7 },
    engi:        { critChanceAdd: 0.08, treasureChanceMul: 1.6, goldMul: 1.05 },
    juusan:      { legacyMul: 1.22, trapEvadeAdd: -0.1 },
    amefurashi:  { goldMul: 1.3, trapDamageMul: 1.3 },
    nemurizuki:  { maxHpMul: 1.3, speedMul: 0.95 },
    doromamire:  { trapDamageMul: 0.55, goldMul: 0.97 },
    nadate:      { atkMul: 1.15, goldMul: 1.2, legacyMul: 0.95 },
    yakedo:      { defAdd: 2, trapDamageMul: 0.7 },
    maigo:       { speedMul: 0.92, treasureChanceMul: 1.9 },
    sabi:        { atkMul: 0.92, defAdd: 4 },
    kamoku:      { maxHpMul: 1.05, defAdd: 2, legacyMul: 1.05 }
  } as Record<string, TraitMods>,

  /** 遠征記(記録庫) */
  chronicle: {
    /** 保持する遠征記の最大件数。古いものから捨てる。 */
    maxEntries: 200,
    /** ダイジェスト化のしきい値: これ以上連続で「平凡な」遠征が続いたらまとめる。 */
    digestThreshold: 3,
    /** 「深く潜れた」と判定する到達階層の割合(maxFloor 比)。 */
    deepRunRatio: 0.8,
    /** 惜しい撤退と判定する: 目標までの残り階層。 */
    nearMissFloors: 1
  }
} as const

export type Config = typeof CONFIG

/**
 * 二つ名が能力に与える修正。
 * 掛け算のものは等倍が 1、足し算のものは 0 が無修正。
 */
export interface TraitMods {
  /** 最大HP倍率。 */
  maxHpMul?: number
  /** 攻撃力倍率。 */
  atkMul?: number
  /** 防御力への加算。 */
  defAdd?: number
  /** 遠征速度倍率。 */
  speedMul?: number
  /** 獲得ゴールド倍率。 */
  goldMul?: number
  /** 遺産ポイント獲得倍率。 */
  legacyMul?: number
  /** 会心率への加算(0.15 = +15ポイント)。 */
  critChanceAdd?: number
  /** 罠回避率への加算。 */
  trapEvadeAdd?: number
  /** 罠ダメージ倍率。 */
  trapDamageMul?: number
  /** お宝出現率の倍率。 */
  treasureChanceMul?: number
  /** 死亡時にロストするゴールド割合への倍率。 */
  deathGoldLossMul?: number
  /** 1戦闘のラウンド上限への加算。 */
  maxRoundsAdd?: number
}

export type TraitId = string

/** 二つ名の効果。未定義の二つ名なら無修正を返す。 */
export function traitMods(id: TraitId): TraitMods {
  return CONFIG.traits[id] ?? {}
}

/** アップグレード ID の一覧(型安全なイテレーション用)。 */
export const UPGRADE_IDS = ['forge', 'tavern', 'library'] as const
export type UpgradeId = (typeof UPGRADE_IDS)[number]

/** level → 次のレベルの購入コスト。 */
export function upgradeCost(id: UpgradeId, level: number): number {
  const u = CONFIG.upgrades[id]
  return Math.ceil(u.costBase * Math.pow(u.costGrowth, level))
}

/** 階層 floor に到達したことで得られる遺産ポイント(その階の分のみ)。 */
export function floorLegacy(floor: number): number {
  const r = CONFIG.rewards
  return r.legacyPerFloorBase * Math.pow(r.legacyPerFloorGrowth, floor - 1)
}

/** 階層 floor の基準報酬ゴールド。 */
export function floorGold(floor: number): number {
  const r = CONFIG.rewards
  return r.goldBase * Math.pow(r.goldGrowth, floor - 1)
}
