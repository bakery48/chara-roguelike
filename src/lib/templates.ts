/**
 * templates.ts — 遠征記のテンプレート集(LLMは使わない)。
 *
 * 「導入」「中盤の見せ場」「結び」の3プールから、状況タグに合うものを抽選して合成する。
 * 同じ状況でも文面が揺れるよう、各状況につき複数の候補を用意している。
 * プール合計で 30 種以上。追加はこのファイルだけで完結する。
 */
import type { ChronicleFacts } from './chronicle'
import { CONFIG } from '../config'
import type { ChronicleTag } from '../types'

/** 惜しい撤退とみなす、目標までの残り階層。 */
const CONFIG_NEAR_MISS = CONFIG.chronicle.nearMissFloors

export interface Template {
  id: string
  /** この文が主張するタグ(遠征記のタグ表示に使う)。 */
  tags: ChronicleTag[]
  /** 採用条件。 */
  when: (f: ChronicleFacts) => boolean
  /** 重み(大きいほど選ばれやすい)。既定 1。 */
  weight?: number
  /** {slot} を含む本文。 */
  text: string
}

/* ── 導入 ───────────────────────────────────────────── */
export const OPENINGS: Template[] = [
  {
    id: 'open.first',
    tags: [],
    when: (f) => f.index === 1,
    weight: 10,
    text: '記録簿の最初の頁。{hero}は地図もないまま{dungeon}の口に立った。'
  },
  {
    id: 'open.greedy',
    tags: [],
    when: (f) => f.greedy,
    weight: 3,
    text: '撤退線を破り捨て、{hero}は帰り道を数えぬまま潜っていった。'
  },
  {
    id: 'open.greedy2',
    tags: [],
    when: (f) => f.greedy,
    weight: 2,
    text: '「今回は底まで」——そう言い残して{hero}は{dungeon}へ降りた。'
  },
  {
    id: 'open.afterDeath',
    tags: [],
    when: (f) => f.previousOutcome === 'death',
    weight: 3,
    text: '前回の失敗を舐めるように確かめてから、{hero}は再び{dungeon}へ向かった。'
  },
  {
    id: 'open.cautious',
    tags: [],
    when: (f) => !f.greedy && f.hpLine >= 50,
    weight: 2,
    text: '深入りはしないと決め、HP{hpLine}%を撤退の合図に{hero}は出発した。'
  },
  {
    id: 'open.target',
    tags: [],
    when: (f) => !f.greedy,
    text: '{target}階までと定め、{hero}は静かに階段を降りていった。'
  },
  {
    id: 'open.plain',
    tags: [],
    when: () => true,
    text: '第{index}次遠征。{hero}はいつもの装いで{dungeon}へ発った。'
  },
  {
    id: 'open.veteran2',
    tags: [],
    when: (f) => f.index >= 50,
    weight: 2,
    text: '出発の記帳ももはや形式でしかない。{hero}は署名だけ残して降りていった。'
  },
  {
    id: 'open.cleared',
    tags: [],
    when: (f) => f.index >= 30 && f.forgeLevel >= 8,
    weight: 2,
    text: '磨き上げた装備と、通い慣れた道。{hero}にとって{dungeon}はもう庭に近い。'
  },
  {
    id: 'open.veteran',
    tags: [],
    when: (f) => f.index >= 20,
    weight: 2,
    text: '{index}度目ともなれば{dungeon}の湿った匂いにも慣れる。{hero}は迷わず降りた。'
  },
  {
    id: 'open.forged',
    tags: [],
    when: (f) => f.forgeLevel >= 3,
    weight: 2,
    text: '鍛冶場で研ぎ直した刃を手に、{hero}は意気揚々と出発した。'
  }
]

/* ── 中盤の見せ場 ───────────────────────────────────── */
export const MIDDLES: Template[] = [
  {
    id: 'mid.firstKill',
    tags: ['firstKill'],
    when: (f) => f.firstKills.length > 0,
    weight: 6,
    text: '{firstKill}を初めて討ち取ったのは{firstKillFloor}階のことだった。'
  },
  {
    id: 'mid.firstKill2',
    tags: ['firstKill'],
    when: (f) => f.firstKills.length > 0,
    weight: 4,
    text: '{firstKillFloor}階で見慣れぬ{firstKill}と出くわし、これを退けた。'
  },
  {
    id: 'mid.rareFind',
    tags: ['rareFind'],
    when: (f) => f.treasures.length > 0,
    weight: 5,
    text: '{floorOfTreasure}階の宝箱からは{treasure}が出た。'
  },
  {
    id: 'mid.rareFind2',
    tags: ['rareFind'],
    when: (f) => f.treasures.length > 0,
    weight: 4,
    text: '埃をかぶった{treasure}を拾い上げ、しばらく手のなかで転がしていたという。'
  },
  {
    id: 'mid.manyTreasure',
    tags: ['rareFind'],
    when: (f) => f.treasures.length >= 3,
    weight: 6,
    text: '{treasureCount}点もの品を抱え、背嚢はすっかり重くなった。'
  },
  {
    id: 'mid.trap',
    tags: [],
    when: (f) => f.worstTrap !== undefined,
    weight: 4,
    text: '{trapFloor}階の{trap}で大きく消耗し、以降は足取りが重かった。'
  },
  {
    id: 'mid.trapMany',
    tags: [],
    when: (f) => f.trapCount >= 3,
    weight: 5,
    text: '仕掛けは{trapCount}度も牙を剥き、そのたびに血が石畳に落ちた。'
  },
  {
    id: 'mid.slaughter',
    tags: [],
    when: (f) => f.kills >= 6,
    weight: 4,
    text: '{kills}体を斬り伏せ、通路には引きずった跡だけが残った。'
  },
  {
    id: 'mid.tough',
    tags: [],
    when: (f) => f.toughest !== undefined && f.toughestDamage >= f.maxHp * 0.4,
    weight: 5,
    text: '{toughest}との組み合いは長引き、{toughestDamage}もの傷を負わされた。'
  },
  {
    id: 'mid.barely',
    tags: [],
    when: (f) => f.lowestHpPct <= 20 && f.outcome === 'return',
    weight: 5,
    text: '一度は膝をつきかけたが、残りHP{lowestHpPct}%で踏みとどまった。'
  },
  {
    id: 'mid.disengage',
    tags: [],
    when: (f) => f.disengages > 0,
    weight: 3,
    text: '倒しきれぬ相手には背を向けた。恥ではなく、生き延びるための算段だった。'
  },
  {
    id: 'mid.empty',
    tags: ['emptyHanded'],
    when: (f) => f.gold <= 0,
    weight: 5,
    text: '拾えるものは何もなく、空の袋が腰で鳴り続けた。'
  },
  {
    id: 'mid.deep',
    tags: ['deepRun'],
    when: (f) => f.isDeepRun,
    weight: 5,
    text: '空気が変わったのは{floor}階。灯りの届く範囲がひどく狭くなった。'
  },
  {
    id: 'mid.quiet',
    tags: [],
    when: () => true,
    text: '道中は淡々としていた。石を踏む音だけが記録に残っている。'
  },
  {
    id: 'mid.gold',
    tags: [],
    when: (f) => f.gold >= 200,
    weight: 3,
    text: '{gold}Gぶんの戦利品が、ひとつずつ袋に積み上がっていった。'
  }
]

/* ── 結び ───────────────────────────────────────────── */
export const CLOSINGS: Template[] = [
  {
    id: 'close.deathEnemy',
    tags: ['death'],
    when: (f) => f.outcome === 'death' && f.killerKind === 'enemy',
    weight: 5,
    text: '{floor}階、{killer}の一撃で記録は途切れている。'
  },
  {
    id: 'close.deathEnemy2',
    tags: ['death'],
    when: (f) => f.outcome === 'death' && f.killerKind === 'enemy',
    weight: 4,
    text: '{killer}に敗れ、{hero}は{floor}階から戻らなかった。戦利品の八割は闇に消えた。'
  },
  {
    id: 'close.deathTrap',
    tags: ['death'],
    when: (f) => f.outcome === 'death' && f.killerKind === 'trap',
    weight: 5,
    text: '最期は剣ではなく{killer}だった。{floor}階、あっけない幕切れ。'
  },
  {
    id: 'close.shallowDeath',
    tags: ['death', 'shallowDeath'],
    when: (f) => f.outcome === 'death' && f.floor <= 2,
    weight: 8,
    text: 'まだ地上の光が届く{floor}階での死。記録係は筆を止め、しばらく何も書けなかった。'
  },
  {
    id: 'close.greedPrice',
    tags: ['death', 'greedPrice'],
    when: (f) => f.outcome === 'death' && f.greedy,
    weight: 9,
    text: '引き際を捨てた代償は{floor}階で支払われた。持ち帰れたのはこの一行だけである。'
  },
  {
    id: 'close.greedPrice2',
    tags: ['death', 'greedPrice'],
    when: (f) => f.outcome === 'death' && f.greedy,
    weight: 6,
    text: 'あと一階、あと一箱——その欲が{floor}階で足を掬った。'
  },
  {
    id: 'close.greedReward',
    tags: ['greedReward'],
    when: (f) => f.outcome === 'return' && f.greedy,
    weight: 8,
    text: '強欲は今回に限って報われた。{floor}階からの帰り道、袋は{gold}Gで膨らんでいた。'
  },
  {
    id: 'close.nearMiss',
    tags: ['nearMiss'],
    when: (f) =>
      f.outcome === 'return' && f.retreatReason === 'hp' && f.floor < f.target && f.floor >= f.target - CONFIG_NEAR_MISS,
    weight: 8,
    text: '目標まであと{remain}階。HPが撤退ラインを割り、{hero}は唇を噛んで引き返した。'
  },
  {
    id: 'close.retreatHp',
    tags: [],
    when: (f) => f.outcome === 'return' && f.retreatReason === 'hp',
    weight: 4,
    text: '{floor}階で撤退ラインに触れ、深追いはしなかった。{gold}Gを持ち帰る。'
  },
  {
    id: 'close.target',
    tags: ['safeReturn'],
    when: (f) => f.outcome === 'return' && f.retreatReason === 'target',
    weight: 4,
    text: '定めた{floor}階まで到達し、約束どおり引き上げた。戦利品{gold}G。'
  },
  {
    id: 'close.target2',
    tags: ['safeReturn'],
    when: (f) => f.outcome === 'return' && f.retreatReason === 'target',
    weight: 3,
    text: '無理はしない。それだけで{gold}Gと遺産{legacy}が拠点に積まれた。'
  },
  {
    id: 'close.firstClear',
    tags: ['clear', 'deepRun'],
    when: (f) => f.firstClear,
    weight: 30,
    text: '{floor}階——{dungeon}の底を踏み、{hero}は生きて戻った。この一行のために{index}度潜ったのだ。'
  },
  {
    id: 'close.clear',
    tags: ['clear', 'deepRun'],
    when: (f) => f.retreatReason === 'clear' && !f.firstClear,
    weight: 6,
    text: '底まで降り、また同じ階段を登って戻った。{gold}Gと遺産{legacy}。'
  },
  {
    id: 'close.clear2',
    tags: ['clear', 'deepRun'],
    when: (f) => f.retreatReason === 'clear' && !f.firstClear,
    weight: 6,
    text: '{dungeon}はもう{hero}を止められない。{floor}階から悠々と引き上げた。'
  },
  {
    id: 'close.clear3',
    tags: ['clear', 'deepRun'],
    when: (f) => f.retreatReason === 'clear' && !f.firstClear,
    weight: 5,
    text: '最奥の空気にも慣れた。持ち帰った{gold}Gを数え、{hero}は次の階段を探しはじめている。'
  },
  {
    id: 'close.clear4',
    tags: ['clear', 'deepRun'],
    when: (f) => f.retreatReason === 'clear' && !f.firstClear && f.lowestHpPct <= 30,
    weight: 9,
    text: '底は踏んだ。ただし残りHPは{lowestHpPct}%、笑って語れる帰還ではなかった。'
  },
  {
    id: 'close.deepRun',
    tags: ['deepRun'],
    when: (f) => f.outcome === 'return' && f.isDeepRun,
    weight: 5,
    text: '{floor}階からの帰還。ここまで来られた遠征は数えるほどしかない。'
  },
  {
    id: 'close.record',
    tags: ['deepRun'],
    when: (f) => f.newRecord && f.outcome === 'return',
    weight: 10,
    text: '{floor}階。これまでの最深記録を更新した夜として、記録簿に朱が入った。'
  },
  {
    id: 'close.recordDeath',
    tags: ['death', 'deepRun'],
    when: (f) => f.newRecord && f.outcome === 'death',
    weight: 10,
    text: '最深記録を更新したその足で、{hero}は{floor}階から戻らなかった。朱と黒が同じ行に並んでいる。'
  },
  {
    id: 'close.empty',
    tags: ['emptyHanded'],
    when: (f) => f.outcome === 'return' && f.gold <= 0,
    weight: 6,
    text: '無事なだけが取り柄の帰還だった。袋は行きと同じ重さのままである。'
  },
  {
    id: 'close.plain',
    tags: ['safeReturn'],
    when: (f) => f.outcome === 'return',
    text: '{floor}階から帰還。{gold}Gと遺産{legacy}が、次の遠征の礎となる。'
  },
  {
    id: 'close.plainDeath',
    tags: ['death'],
    when: (f) => f.outcome === 'death',
    text: '{floor}階にて消息を絶つ。遺産{legacy}だけが拠点に届いた。'
  }
]
