<script lang="ts">
  import { dateLabel, duration, num } from '../lib/format'
  import { game } from '../lib/store.svelte'
  import type { ChronicleTag, HallOfFameKind } from '../types'

  const TAG_LABEL: Record<ChronicleTag, string> = {
    death: '死因',
    firstKill: '初討伐',
    rareFind: 'レア入手',
    nearMiss: '惜しい撤退',
    greedPrice: '強欲の代償',
    greedReward: '強欲の実り',
    deepRun: '最深',
    safeReturn: '無事帰還',
    emptyHanded: '空手',
    shallowDeath: '奇妙な死',
    clear: '踏破'
  }

  const FAME_LABEL: Record<HallOfFameKind, string> = {
    firstKill: '初 討 伐',
    deepest: '最 深 記 録',
    strangeDeath: '奇 妙 な 死',
    firstClear: '初 踏 破'
  }

  const fame = $derived(game.hallOfFame)
  const items = $derived(game.timeline)
</script>

{#if fame.length > 0}
  <h3 class="sub-title" style="margin-top:0">殿 堂</h3>
  <div class="fame-board">
    {#each fame.slice(-6).reverse() as c (c.id)}
      <div class="entry">
        <span class="kind">{FAME_LABEL[c.hallOfFame!]} — 第{c.index}次</span>
        {c.text}
      </div>
    {/each}
  </div>
{/if}

<h3 class="sub-title" style="margin-top:0">年 表</h3>

{#if items.length === 0}
  <p class="empty">遠征記はまだ一本もない。<br />最初の遠征が終われば、ここに記録が綴られる。</p>
{:else}
  {#each items as item (item.kind === 'entry' ? item.chronicle.id : `d${item.from}-${item.to}`)}
    {#if item.kind === 'digest'}
      <div class="digest">
        第{item.from}〜{item.to}次遠征: {item.count}回の遠征、最深{item.deepest}階、
        戦利品 {num(item.gold)}G{item.deaths > 0 ? `、うち${item.deaths}回の死` : '、死者なし'}。
      </div>
    {:else}
      {@const c = item.chronicle}
      <article class="chronicle" class:death={c.summary.outcome === 'death'} class:fame={!!c.hallOfFame}>
        <div class="head">
          <span class="no">第{c.index}次遠征</span>
          <span>{dateLabel(c.at)}</span>
          {#if c.hallOfFame}<span class="tag fame">{FAME_LABEL[c.hallOfFame]}</span>{/if}
          {#each c.tags as t (t)}
            <span class="tag" class:death={t === 'death'}>{TAG_LABEL[t]}</span>
          {/each}
        </div>
        <p class="text">{c.text}</p>
        <div class="meta">
          {c.summary.floor}F / {c.summary.outcome === 'death' ? '死亡' : '帰還'} /
          {num(c.summary.gold)}G / 遺産 {num(c.summary.legacy)} / 撃破 {c.summary.kills} /
          {duration(c.summary.durationMs)}
        </div>
      </article>
    {/if}
  {/each}
{/if}
