<script lang="ts">
  import { CONFIG } from '../config'
  import { clock, num } from '../lib/format'
  import { game } from '../lib/store.svelte'

  const maxFloor = CONFIG.dungeon.maxFloor

  const exp = $derived(game.state.expedition)
  const s = $derived(game.state.settings)
  const hpPct = $derived(exp ? Math.max(0, (exp.hp / exp.maxHp) * 100) : 100)
  const hpClass = $derived(hpPct <= 25 ? 'danger' : hpPct <= 50 ? 'warn' : '')
  const phaseLabel = $derived(
    game.state.status === 'restock'
      ? '拠点で補給中'
      : !exp
        ? '待機中'
        : exp.phase === 'returning'
          ? '帰路'
          : exp.phase === 'descending'
            ? '降下中'
            : '探索中'
  )
</script>

<aside>
  <p class="section-title">遠征ステータス</p>

  <div class="stat-row">
    <span class="label">{exp ? `第${exp.index}次遠征` : '次の遠征'}</span>
    <span class="value">{phaseLabel}</span>
  </div>

  <div class="field">
    <div class="lbl">
      <span>到達階層</span>
      <span class="value">{exp?.floor ?? 0} / {maxFloor}F</span>
    </div>
    <div class="floors">
      {#each Array(maxFloor) as _, i (i)}
        {@const f = i + 1}
        <i
          class:done={!!exp && f < exp.floor}
          class:here={!!exp && f === exp.floor}
          class:target={!s.greedy && f === s.targetFloor}>{f}</i
        >
      {/each}
    </div>
    <p class="hint">
      {#if s.greedy}<span style="color:var(--vermilion)">強欲: 最深部まで潜り続ける</span>
      {:else}目標 {s.targetFloor}F（下線）に到達したら帰還する{/if}
    </p>
  </div>

  <div class="field">
    <div class="lbl">
      <span>HP</span>
      <span class="value">{Math.max(0, Math.round(exp?.hp ?? game.hero.maxHp))} / {Math.round(exp?.maxHp ?? game.hero.maxHp)}</span>
    </div>
    <div class="bar hp {hpClass}">
      <i style="width:{hpPct}%"></i>
      {#if s.hpPct > 0 && !s.greedy}
        <span class="line" style="left:{s.hpPct}%" title="撤退ライン {s.hpPct}%"></span>
      {/if}
    </div>
  </div>

  <div class="stat-row">
    <span class="label">戦利品</span><span class="value gold">{num(exp?.gold ?? 0)} G</span>
  </div>
  <div class="stat-row">
    <span class="label">撃破数</span><span class="value">{exp?.kills ?? 0}</span>
  </div>
  <div class="stat-row">
    <span class="label">お宝</span><span class="value">{exp?.treasures.length ?? 0}</span>
  </div>
  <div class="stat-row">
    <span class="label">経過</span>
    <span class="value">
      {#if game.state.status === 'restock'}出発まで {clock(game.state.restockTimer)}
      {:else}{clock(exp?.elapsed ?? 0)}{/if}
    </span>
  </div>

  <p class="section-title">出発前設定</p>

  <div class="field">
    <div class="lbl">
      <span>HP撤退ライン</span>
      <span class="value">{s.hpPct === 0 ? '設定なし' : `${s.hpPct}%`}</span>
    </div>
    <div class="seg">
      {#each CONFIG.retreat.hpOptions as opt (opt)}
        <button
          class:on={s.hpPct === opt}
          disabled={s.greedy}
          onclick={() => game.updateSettings({ hpPct: opt })}>{opt === 0 ? '—' : `${opt}%`}</button
        >
      {/each}
    </div>
    <p class="hint">HPがこの割合を下回った時点で引き返す。次の遠征から反映される。</p>
  </div>

  <div class="field">
    <div class="lbl">
      <span>目標階層</span>
      <span class="value">{s.targetFloor}F</span>
    </div>
    <input
      type="range"
      min="1"
      max={maxFloor}
      value={s.targetFloor}
      disabled={s.greedy}
      aria-label="目標階層"
      oninput={(e) => game.updateSettings({ targetFloor: +e.currentTarget.value })}
    />
    <p class="hint">深いほど報酬・遺産ポイントは増えるが、事故率も上がる。</p>
  </div>

  <label class="check greed">
    <input
      type="checkbox"
      checked={s.greedy}
      onchange={(e) => game.updateSettings({ greedy: e.currentTarget.checked })}
    />
    <span>
      <strong>強欲設定</strong>：撤退条件を無視して最深部まで潜り続ける。<br />
      報酬 ×{CONFIG.retreat.greedGoldMul} / 遺産 ×{CONFIG.retreat.greedLegacyMul}。ただし死ねば戦利品の{CONFIG.death
        .goldLossRate * 100}%を失う。
    </span>
  </label>

  <label class="check">
    <input
      type="checkbox"
      checked={s.autoRepeat}
      onchange={(e) => game.updateSettings({ autoRepeat: e.currentTarget.checked })}
    />
    <span>帰還後、自動で次の遠征に出発する</span>
  </label>

  {#if game.state.status === 'idle'}
    <button class="primary" style="width:100%;margin-top:0.6rem" onclick={() => game.depart()}>
      遠 征 に 出 発
    </button>
  {/if}
</aside>
