/**
 * scripts/balance.ts — バランス確認用のシミュレーション。
 *
 *   npm run balance
 *
 * config.ts の数値をいじったあとにこれを流すと、
 *  1) 撤退ライン別の生存率と収支
 *  2) 放置プレイ時の成長曲線(どのくらいで何階まで行けるか)
 * が数字で出る。コードを触らずにバランスを詰めるための道具。
 */
import { CONFIG, UPGRADE_IDS, upgradeCost, type UpgradeId } from '../src/config'
import { advanceExpedition, createExpedition, heroStats, settleExpedition } from '../src/lib/expedition'
import { beginExpedition, buyUpgrade, stepGame } from '../src/lib/game'
import { defaultState } from '../src/lib/save'
import { EPITHETS, traitSummary } from '../src/lib/names'
import type { GameState, RetreatSettings } from '../src/types'

const HOUR = 3600_000

function pad(s: string | number, n: number): string {
  const str = String(s)
  return str + ' '.repeat(Math.max(0, n - str.length))
}
function rpad(s: string | number, n: number): string {
  const str = String(s)
  return ' '.repeat(Math.max(0, n - str.length)) + str
}

/* ── 1) 撤退ライン別の生存率 ───────────────────────── */

function sampleRuns(
  settings: RetreatSettings,
  upgrades: Record<UpgradeId, number>,
  n: number,
  epithet = ''
) {
  const state: GameState = { ...defaultState(), settings, upgrades, heroEpithet: epithet, heroName: '検証' }
  let deaths = 0
  let floors = 0
  let legacy = 0
  let ms = 0
  for (let i = 0; i < n; i++) {
    const exp = createExpedition(state)
    exp.seed = (i * 2654435761) >>> 0
    advanceExpedition(exp, 24 * HOUR)
    const s = settleExpedition(exp, upgrades)
    if (s.outcome === 'death') deaths++
    floors += exp.deepestFloor
    legacy += s.legacy
    ms += exp.elapsed
  }
  return {
    deathRate: deaths / n,
    avgFloor: floors / n,
    avgLegacy: legacy / n,
    avgMs: ms / n,
    legacyPerMin: legacy / (ms / 60000)
  }
}

function retreatTable(upgrades: Record<UpgradeId, number>, label: string) {
  const h = heroStats(upgrades)
  console.log(
    `\n■ 撤退ライン別 (${label}: HP${Math.round(h.maxHp)} ATK${Math.round(h.atk)} 速度×${h.speed.toFixed(2)})`
  )
  console.log(
    pad('設定', 22) + rpad('死亡率', 8) + rpad('平均階', 8) + rpad('平均遺産', 10) + rpad('所要', 8) + rpad('遺産/分', 9)
  )
  const rows: { label: string; s: RetreatSettings }[] = []
  for (const target of [3, 5, 7, 10]) {
    rows.push({
      label: `目標${target}F / HP35%`,
      s: { hpPct: 35, targetFloor: target, greedy: false, autoRepeat: true }
    })
  }
  rows.push({ label: 'HPライン無し / 10F', s: { hpPct: 0, targetFloor: 10, greedy: false, autoRepeat: true } })
  rows.push({ label: '強欲', s: { hpPct: 0, targetFloor: 10, greedy: true, autoRepeat: true } })

  for (const { label: l, s } of rows) {
    const r = sampleRuns(s, upgrades, 400)
    console.log(
      pad(l, 22) +
        rpad(`${(r.deathRate * 100).toFixed(1)}%`, 8) +
        rpad(r.avgFloor.toFixed(1), 8) +
        rpad(r.avgLegacy.toFixed(0), 10) +
        rpad(`${(r.avgMs / 60000).toFixed(1)}分`, 8) +
        rpad(r.legacyPerMin.toFixed(1), 9)
    )
  }
}

/* ── 2) 二つ名(特性)別 ────────────────────────────── */

function traitTable(
  upgrades: Record<UpgradeId, number>,
  label: string,
  settings: RetreatSettings,
  settingsLabel: string
) {
  const base = sampleRuns(settings, upgrades, 500)

  console.log(`\n■ 二つ名別 (${label} / ${settingsLabel})`)
  console.log(
    pad('二つ名', 14) + rpad('死亡率', 8) + rpad('平均階', 8) + rpad('遺産/分', 9) +
      rpad('基準比', 9) + '  効果'
  )
  console.log(
    pad('(なし)', 14) + rpad(`${(base.deathRate * 100).toFixed(1)}%`, 8) +
      rpad(base.avgFloor.toFixed(1), 8) + rpad(base.legacyPerMin.toFixed(1), 9) +
      rpad('—', 9)
  )

  const rows = EPITHETS.map((e) => {
    const r = sampleRuns(settings, upgrades, 500, e.id)
    return { e, r, ratio: r.legacyPerMin / base.legacyPerMin }
  }).sort((a, b) => b.ratio - a.ratio)

  for (const { e, r, ratio } of rows) {
    console.log(
      pad(e.label, 14) +
        rpad(`${(r.deathRate * 100).toFixed(1)}%`, 8) +
        rpad(r.avgFloor.toFixed(1), 8) +
        rpad(r.legacyPerMin.toFixed(1), 9) +
        rpad(`${ratio >= 1 ? '+' : ''}${((ratio - 1) * 100).toFixed(0)}%`, 9) +
        '  ' + traitSummary(e.id)
    )
  }

  const ratios = rows.map((r) => r.ratio)
  console.log(
    `  最良 ${(Math.max(...ratios) * 100 - 100).toFixed(0)}% / ` +
      `最悪 ${(Math.min(...ratios) * 100 - 100).toFixed(0)}% / ` +
      `幅 ${((Math.max(...ratios) - Math.min(...ratios)) * 100).toFixed(0)}ポイント`
  )
}

/* ── 3) 放置成長曲線 ──────────────────────────────── */

/** 「一番安いものから買う」単純なAIで放置した場合の成長を追う。 */
function progression(hours: number) {
  const state = defaultState()
  state.settings = { hpPct: 35, targetFloor: 5, greedy: false, autoRepeat: true }
  beginExpedition(state)

  console.log(`\n■ 放置成長曲線 (HP35%固定、直近10回無死亡なら目標を1F深く、死ねば1F浅く)`)
  console.log(
    pad('経過', 8) + rpad('遠征数', 8) + rpad('死亡', 6) + rpad('最深', 6) + rpad('遺産', 9) +
      rpad('鍛冶', 6) + rpad('酒場', 6) + rpad('図書', 6) + rpad('目標', 8)
  )

  const stepMin = 15
  for (let m = stepMin; m <= hours * 60; m += stepMin) {
    stepGame(state, stepMin * 60_000)
    // 買えるうちは一番安い施設を買い続ける
    for (let guard = 0; guard < 200; guard++) {
      const options = UPGRADE_IDS.map((id) => ({ id, cost: upgradeCost(id, state.upgrades[id]) }))
        .filter((o) => state.upgrades[o.id] < CONFIG.upgrades[o.id].maxLevel)
        .sort((a, b) => a.cost - b.cost)
      if (options.length === 0 || !buyUpgrade(state, options[0].id)) break
    }
    // 実際のプレイヤーらしく、安全なら深く・死んだら浅く目標を調整する
    const recent = state.chronicles.slice(-10)
    if (recent.length === 10) {
      const deaths = recent.filter((c) => c.summary.outcome === 'death').length
      if (deaths === 0 && state.settings.targetFloor < CONFIG.dungeon.maxFloor) state.settings.targetFloor++
      else if (deaths >= 3 && state.settings.targetFloor > 1) state.settings.targetFloor--
    }

    if (m % 60 === 0 || m === stepMin) {
      console.log(
        pad(`${(m / 60).toFixed(2)}h`, 8) +
          rpad(state.stats.totalExpeditions, 8) +
          rpad(state.stats.deaths, 6) +
          rpad(`${state.stats.deepestFloor}F`, 6) +
          rpad(Math.round(state.legacy), 9) +
          rpad(state.upgrades.forge, 6) +
          rpad(state.upgrades.tavern, 6) +
          rpad(state.upgrades.library, 6) +
          rpad(`目標${state.settings.targetFloor}F`, 8)
      )
    }
  }
  console.log(`\n  遠征記: ${state.chronicles.length}本 / 殿堂入り ${state.chronicles.filter((c) => c.hallOfFame).length}件`)
  console.log('  最新の遠征記:')
  for (const c of state.chronicles.slice(-6)) console.log(`   第${c.index}次 — ${c.text}`)
}

/* ── 4) コスト曲線 ───────────────────────────────── */

function costCurve() {
  console.log('\n■ 強化コスト曲線')
  console.log(pad('Lv', 5) + UPGRADE_IDS.map((id) => rpad(CONFIG.upgrades[id].name, 10)).join(''))
  for (const lv of [0, 1, 2, 3, 5, 8, 12, 16, 20]) {
    console.log(pad(lv, 5) + UPGRADE_IDS.map((id) => rpad(upgradeCost(id, lv), 10)).join(''))
  }
}

console.log(`ダンジョン: ${CONFIG.dungeon.name} / 最大${CONFIG.dungeon.maxFloor}階`)
retreatTable({ forge: 0, tavern: 0, library: 0 }, '無強化')
retreatTable({ forge: 5, tavern: 5, library: 2 }, '中盤')
retreatTable({ forge: 12, tavern: 12, library: 5 }, '終盤')
const SAFE: RetreatSettings = { hpPct: 35, targetFloor: 5, greedy: false, autoRepeat: true }
const RISKY: RetreatSettings = { hpPct: 15, targetFloor: 10, greedy: false, autoRepeat: true }
traitTable({ forge: 0, tavern: 0, library: 0 }, '無強化', SAFE, '目標5F・HP35%(安全)')
traitTable({ forge: 8, tavern: 8, library: 3 }, '中盤', RISKY, '目標10F・HP15%(冒険)')
costCurve()
progression(6)
