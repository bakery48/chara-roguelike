<script lang="ts">
  import { onDestroy, onMount } from 'svelte'
  import BasePanel from './components/BasePanel.svelte'
  import ChroniclePanel from './components/ChroniclePanel.svelte'
  import LogPanel from './components/LogPanel.svelte'
  import StatusPanel from './components/StatusPanel.svelte'
  import { CONFIG } from './config'
  import { duration, num } from './lib/format'
  import { game } from './lib/store.svelte'

  let tab = $state<'log' | 'chronicle'>('log')

  // ロード・オフライン進行・ティック開始は一度きり。$effect だと依存の追加で
  // 再実行されうるので、明示的なライフサイクルに載せる。
  onMount(() => game.init())
  onDestroy(() => game.stop())

  const report = $derived(game.offlineReport)
</script>

<div class="book">
  <header class="masthead">
    <h1>遠 征 記</h1>
    <span class="sub">{CONFIG.dungeon.name} 記録簿</span>
    <span class="spacer"></span>
    <span class="sub">
      第{game.state.nextIndex}次 / 最深 {game.state.stats.deepestFloor}F / 遺産 {num(game.state.legacy)}
    </span>
  </header>

  <div class="ledger">
    <StatusPanel />

    <main>
      <div class="tabs">
        <button class:on={tab === 'log'} onclick={() => (tab = 'log')}>遠 征 ロ グ</button>
        <button class:on={tab === 'chronicle'} onclick={() => (tab = 'chronicle')}>
          記 録 庫（{game.state.chronicles.length}）
        </button>
      </div>
      {#if tab === 'log'}
        <LogPanel />
      {:else}
        <ChroniclePanel />
      {/if}
    </main>

    <BasePanel />
  </div>
</div>

{#if report}
  <div class="veil">
    <div class="card">
      <h2>留 守 中 の 記 録</h2>
      <p style="font-size:0.9rem;line-height:1.9;margin:0 0 1rem">
        {duration(report.elapsedMs)}のあいだ、ヒーローは黙々と潜り続けていた。
      </p>
      <div class="stat-row"><span class="label">遠征回数</span><span class="value">{report.expeditions}</span></div>
      <div class="stat-row"><span class="label">最深到達</span><span class="value">{report.deepest}F</span></div>
      <div class="stat-row"><span class="label">死亡</span><span class="value">{report.deaths}</span></div>
      <div class="stat-row">
        <span class="label">獲得遺産</span><span class="value legacy">{num(report.legacyGained)} pt</span>
      </div>
      <p style="font-size:0.72rem;color:var(--ink-faint);margin:0.9rem 0 0;line-height:1.7">
        オフライン進行は最大{CONFIG.time.offlineCapHours}時間分まで計算される。詳細は記録庫に綴られている。
      </p>
      <div class="actions">
        <button class="primary" onclick={() => game.dismissOfflineReport()}>記録簿を開く</button>
      </div>
    </div>
  </div>
{/if}
