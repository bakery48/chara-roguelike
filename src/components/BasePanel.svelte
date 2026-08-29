<script lang="ts">
  import { CONFIG, UPGRADE_IDS, upgradeCost, type UpgradeId } from '../config'
  import { num } from '../lib/format'
  import HeroNaming from './HeroNaming.svelte'
  import { describeTrait, findEpithet } from '../lib/names'
  import { canAfford } from '../lib/game'
  import { game } from '../lib/store.svelte'

  const u = CONFIG.upgrades

  /** 現在の効果と、次のレベルで得られる効果の説明。 */
  function effect(id: UpgradeId, lv: number): { now: string; next: string } {
    if (id === 'forge')
      return {
        now: `攻撃力 +${lv * u.forge.atkPerLevel}`,
        next: `次: +${u.forge.atkPerLevel}`
      }
    if (id === 'tavern')
      return {
        now: `最大HP +${lv * u.tavern.hpPerLevel}`,
        next: `次: +${u.tavern.hpPerLevel}`
      }
    const speed = Math.min(u.library.maxSpeedMul - 1, lv * u.library.speedPerLevel)
    return {
      now: `遠征速度 +${Math.round(speed * 100)}% / 遺産獲得 +${Math.round(lv * u.library.legacyPerLevel * 100)}%`,
      next: `次: 速度 +${Math.round(u.library.speedPerLevel * 100)}% / 遺産 +${Math.round(u.library.legacyPerLevel * 100)}%`
    }
  }

  const st = $derived(game.state.stats)
  let renaming = $state(false)
  const epithet = $derived(findEpithet(game.state.heroEpithet))
  const effects = $derived(describeTrait(game.state.heroEpithet))
</script>

<aside>
  <p class="section-title">拠点</p>

  <div style="margin-bottom:0.9rem">
    <div class="big-number" style="color:var(--vermilion)">{num(game.state.legacy)}</div>
    <div style="font-size:0.72rem;letter-spacing:0.2em;color:var(--ink-soft)">遺産ポイント</div>
  </div>

  {#each UPGRADE_IDS as id (id)}
    {@const def = u[id]}
    {@const lv = game.state.upgrades[id]}
    {@const maxed = lv >= def.maxLevel}
    {@const cost = upgradeCost(id, lv)}
    {@const eff = effect(id, lv)}
    <div class="upgrade">
      <header>
        <span aria-hidden="true">{def.icon}</span>
        <span class="name">{def.name}</span>
        <span class="lv">Lv.{lv}{maxed ? ' (最大)' : ` / ${def.maxLevel}`}</span>
      </header>
      <p class="effect">{eff.now}{maxed ? '' : `　—　${eff.next}`}</p>
      <div class="buy">
        <button
          class="tiny"
          disabled={maxed || !canAfford(game.state, id)}
          onclick={() => game.buy(id)}>{maxed ? '最大' : '強化する'}</button
        >
        {#if !maxed}<span class="cost">{num(cost)} pt</span>{/if}
      </div>
    </div>
  {/each}

  <p class="section-title">ヒーロー</p>
  <div class="stat-row hero-name">
    <span class="label">名前</span>
    <span class="value">
      {game.heroDisplayName}
      {#if game.state.heroGeneration > 1}<em>第{game.state.heroGeneration}代</em>{/if}
    </span>
    <button class="tiny ghost" onclick={() => (renaming = true)}>改名</button>
  </div>

  {#if epithet}
    <div class="trait-row">
      <span class="lore">{epithet.label}——{epithet.lore}</span>
      <ul class="effects">
        {#each effects as e (e.text)}
          <li class:good={e.good} class:bad={!e.good}>{e.text}</li>
        {:else}
          <li>特筆すべき癖はない</li>
        {/each}
      </ul>
    </div>
  {/if}
  <div class="stat-row"><span class="label">最大HP</span><span class="value">{Math.round(game.hero.maxHp)}</span></div>
  <div class="stat-row"><span class="label">攻撃力</span><span class="value">{Math.round(game.hero.atk)}</span></div>
  <div class="stat-row"><span class="label">防御力</span><span class="value">{Math.round(game.hero.def)}</span></div>
  <div class="stat-row"><span class="label">遠征速度</span><span class="value">×{game.hero.speed.toFixed(2)}</span></div>
  <div class="stat-row"><span class="label">遺産獲得</span><span class="value">×{game.hero.legacyMul.toFixed(2)}</span></div>

  <label class="check">
    <input
      type="checkbox"
      checked={game.state.renameOnDeath}
      onchange={(e) => game.setRenameOnDeath(e.currentTarget.checked)}
    />
    <span>死亡したら名簿から新しい冒険者を迎える</span>
  </label>

  <p class="section-title">記録</p>
  <div class="stat-row"><span class="label">遠征回数</span><span class="value">{num(st.totalExpeditions)}</span></div>
  <div class="stat-row"><span class="label">帰還 / 死亡</span><span class="value">{num(st.returns)} / {num(st.deaths)}</span></div>
  <div class="stat-row"><span class="label">最深到達</span><span class="value">{st.deepestFloor}F</span></div>
  <div class="stat-row"><span class="label">累計戦利品</span><span class="value gold">{num(st.totalGold)} G</span></div>
  <div class="stat-row"><span class="label">討伐図鑑</span><span class="value">{st.slain.length}種</span></div>

  <div style="margin-top:1.4rem;text-align:right">
    <button
      class="ghost tiny"
      onclick={() => {
        if (confirm('セーブデータを消去して最初からやり直しますか?')) game.reset()
      }}>記録簿を焼き捨てる</button
    >
  </div>
</aside>

{#if renaming}
  <HeroNaming mode="rename" onclose={() => (renaming = false)} />
{/if}

<style>
  .stat-row.hero-name { gap: 0.5rem; }
  .trait-row { padding: 0.4rem 0 0.5rem; border-bottom: 1px dotted var(--rule); }
  .trait-row .lore { font-size: 0.72rem; color: var(--ink-faint); line-height: 1.6; }
  .trait-row .effects {
    list-style: none;
    display: flex;
    flex-wrap: wrap;
    gap: 0.25rem 0.35rem;
    margin: 0.35rem 0 0;
    padding: 0;
  }
  .trait-row .effects li {
    font-size: 0.68rem;
    font-family: var(--mono);
    padding: 0.05rem 0.35rem;
    border: 1px solid var(--rule);
    color: var(--ink-soft);
  }
  .trait-row .effects li.good { color: var(--moss); border-color: var(--moss); }
  .trait-row .effects li.bad { color: var(--vermilion); border-color: var(--vermilion); }
  .stat-row.hero-name .value {
    margin-left: auto;
    text-align: right;
    font-family: var(--serif);
    letter-spacing: 0.06em;
  }
  .stat-row.hero-name .value em {
    font-style: normal;
    font-size: 0.68rem;
    color: var(--ink-faint);
    margin-left: 0.4rem;
  }
</style>
