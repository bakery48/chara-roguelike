<script lang="ts">
  import { CONFIG, UPGRADE_IDS, upgradeCost, type UpgradeId } from '../config'
  import { num } from '../lib/format'
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
  <div class="stat-row"><span class="label">名前</span><span class="value">{CONFIG.hero.name}</span></div>
  <div class="stat-row"><span class="label">最大HP</span><span class="value">{Math.round(game.hero.maxHp)}</span></div>
  <div class="stat-row"><span class="label">攻撃力</span><span class="value">{Math.round(game.hero.atk)}</span></div>
  <div class="stat-row"><span class="label">防御力</span><span class="value">{Math.round(game.hero.def)}</span></div>
  <div class="stat-row"><span class="label">遠征速度</span><span class="value">×{game.hero.speed.toFixed(2)}</span></div>
  <div class="stat-row"><span class="label">遺産獲得</span><span class="value">×{game.hero.legacyMul.toFixed(2)}</span></div>

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
