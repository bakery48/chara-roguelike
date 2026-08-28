<script lang="ts">
  import { clock } from '../lib/format'
  import { game } from '../lib/store.svelte'

  const entries = $derived(
    (game.state.expedition?.log.length ? game.state.expedition.log : game.state.lastLog)
      .slice()
      .reverse()
  )
  const live = $derived(!!game.state.expedition)
</script>

{#if entries.length === 0}
  <p class="empty">
    まだ何も記録されていない。<br />
    左の設定を決めて、遠征に送り出そう。
  </p>
{:else}
  {#if !live}
    <p class="hint" style="margin:0 0 0.6rem;color:var(--ink-faint);font-size:0.74rem">
      直前の遠征の記録
    </p>
  {/if}
  <ul class="log">
    {#each entries as e (e.t + '-' + e.text)}
      <li class={e.outcome}>
        <span class="t">{clock(e.t)}</span>
        <span class="fl">{e.floor > 0 ? `${e.floor}F` : '—'}</span>
        <span class="body">{e.text}</span>
      </li>
    {/each}
  </ul>
{/if}
