<script lang="ts">
  import { CONFIG } from '../config'
  import { clock } from '../lib/format'
  import {
    GRANTS,
    SKIPS,
    SPEEDS,
    endExpedition,
    grantLegacy,
    rerollExpedition,
    reset,
    setSpeed,
    skip
  } from '../lib/playtest'
  import { game } from '../lib/store.svelte'

  let open = $state(true)

  const exp = $derived(game.state.expedition)
  const st = $derived(game.state.stats)
  // 1%未満を 0% と丸めると「死んでいるのに0%」に見えるので小数1桁まで出す。
  const deathRate = $derived(
    st.totalExpeditions === 0 ? '—' : `${((st.deaths / st.totalExpeditions) * 100).toFixed(1)}%`
  )
</script>

<div class="playtest" class:open>
  <button class="handle" onclick={() => (open = !open)} aria-expanded={open}>
    検証コンソール {open ? '▾' : '▴'}
    {#if game.speed !== 1}<em>×{game.speed}</em>{/if}
  </button>

  {#if open}
    <div class="body">
      <div class="group">
        <span class="lbl">倍速</span>
        <div class="btns">
          {#each SPEEDS as v (v)}
            <button class:on={game.speed === v} onclick={() => setSpeed(v)}>×{v}</button>
          {/each}
        </div>
      </div>

      <div class="group">
        <span class="lbl">時間を飛ばす</span>
        <div class="btns">
          {#each SKIPS as s (s.label)}
            <button onclick={() => skip(s.ms)}>{s.label}</button>
          {/each}
        </div>
      </div>

      <div class="group">
        <span class="lbl">遺産ポイント</span>
        <div class="btns">
          {#each GRANTS as g (g)}
            <button onclick={() => grantLegacy(g)}>+{g.toLocaleString('ja-JP')}</button>
          {/each}
        </div>
      </div>

      <div class="group">
        <span class="lbl">今の遠征を</span>
        <div class="btns">
          <button disabled={!exp} onclick={() => endExpedition('return')}>帰還させる</button>
          <button disabled={!exp} onclick={() => endExpedition('death')}>死なせる</button>
          <button disabled={!exp} onclick={() => rerollExpedition()}>運を引き直す</button>
        </div>
      </div>

      <div class="group wide">
        <span class="lbl">内部状態</span>
        <div class="readout">
          <span>状態 {game.state.status}{exp ? ` / ${exp.phase}` : ''}</span>
          <span>次イベントまで {clock(exp?.timer ?? game.state.restockTimer)}</span>
          <span>seed {(exp?.seed ?? 0).toString(16)}</span>
          <span>死亡率 {deathRate}（{st.deaths}/{st.totalExpeditions}）</span>
          <span>遠征記 {game.state.chronicles.length}/{CONFIG.chronicle.maxEntries}</span>
        </div>
      </div>

      <div class="group">
        <span class="lbl">やり直し</span>
        <div class="btns">
          <button
            class="danger"
            onclick={() => {
              if (confirm('セーブを消して最初から始めますか?')) reset()
            }}>最初から</button
          >
        </div>
      </div>

      <p class="note">
        テストプレイ用ビルド。このページのセーブは配布版とは別に保存される。
      </p>
    </div>
  {/if}
</div>

<style>
  /*
   * ゲーム本編と地続きに見えないよう、インクの濃い「差し込み帯」として置く。
   * .book(flex column)の最後の子として流し込むので、position:fixed にせずとも
   * 開閉に応じて本編の高さが自動で詰まる。
   */
  .playtest {
    flex: 0 0 auto;
    background: #3a2f22;
    color: #e8dcc2;
    border-top: 1px solid #6b5a44;
    box-shadow: 0 -6px 24px rgba(0, 0, 0, 0.35);
    font-family: 'Hiragino Sans', 'Yu Gothic', 'Noto Sans JP', system-ui, sans-serif;
  }

  .handle {
    display: block;
    width: 100%;
    text-align: left;
    background: transparent;
    border: none;
    color: #c9b894;
    font: inherit;
    font-size: 0.72rem;
    letter-spacing: 0.2em;
    padding: 0.45rem 1rem;
    cursor: pointer;
  }
  .handle:hover { color: #f0e4c8; }
  .handle:focus-visible { outline: 2px solid #c2604f; outline-offset: -2px; }
  .handle em { font-style: normal; color: #e0a04a; margin-left: 0.5rem; }

  .body {
    display: flex;
    flex-wrap: wrap;
    gap: 0.7rem 1.6rem;
    padding: 0 1rem 0.9rem;
    align-items: flex-start;
  }
  .group { display: flex; flex-direction: column; gap: 0.3rem; }
  .group.wide { flex: 1; min-width: 16rem; }
  .lbl {
    font-size: 0.62rem;
    letter-spacing: 0.16em;
    color: #a2906f;
  }
  .btns { display: flex; gap: 4px; flex-wrap: wrap; }
  .btns button {
    font: inherit;
    font-size: 0.74rem;
    font-variant-numeric: tabular-nums;
    background: #4a3c2c;
    color: #e8dcc2;
    border: 1px solid #6b5a44;
    padding: 0.22rem 0.6rem;
    cursor: pointer;
  }
  .btns button:hover:not(:disabled) { background: #6b5a44; }
  .btns button:focus-visible { outline: 2px solid #c2604f; outline-offset: 1px; }
  .btns button:disabled { opacity: 0.4; cursor: not-allowed; }
  .btns button.on { background: #a3372a; border-color: #a3372a; color: #fff2e2; }
  .btns button.danger { border-color: #8d5147; color: #e5a99c; }

  .readout {
    display: flex;
    flex-wrap: wrap;
    gap: 0.15rem 1rem;
    font-size: 0.72rem;
    color: #c9b894;
    font-variant-numeric: tabular-nums;
  }

  .note {
    flex-basis: 100%;
    margin: 0;
    font-size: 0.66rem;
    color: #8e7d5f;
    line-height: 1.6;
  }
</style>
