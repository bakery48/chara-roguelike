<script lang="ts">
  import { MAX_NAME_LENGTH, describeTrait, findEpithet } from '../lib/names'
  import { game } from '../lib/store.svelte'

  interface Props {
    /** 'register' は初回登録(取り消せない)、'rename' は改名(取り消せる)。 */
    mode: 'register' | 'rename'
    onclose: () => void
  }
  const { mode, onclose }: Props = $props()

  // 二つ名は store 側で既に引かれている(登録画面が出る時点で確定済み)。
  // ここで決めるのは名だけ。未登録なら名簿から候補を1つ出しておく。
  // svelte-ignore state_referenced_locally
  let value = $state(game.state.heroName || game.suggestName())

  const epithet = $derived(findEpithet(game.state.heroEpithet))
  const effects = $derived(describeTrait(game.state.heroEpithet))
  let input = $state<HTMLInputElement | null>(null)

  const valid = $derived(value.trim().length > 0)

  function commit(): void {
    if (!valid) return
    game.setHeroName(value)
    onclose()
  }

  function draw(): void {
    value = game.suggestName()
    input?.focus()
  }

  function onkeydown(e: KeyboardEvent): void {
    if (e.key === 'Enter') commit()
    else if (e.key === 'Escape' && mode === 'rename') onclose()
  }

  $effect(() => {
    input?.focus()
    input?.select()
  })
</script>

<div class="veil">
  <div class="card naming">
    <h2>{mode === 'register' ? '冒 険 者 の 登 録' : '改 名'}</h2>

    <p class="lead">
      {#if mode === 'register'}
        ギルドの門を叩いた者がいる。二つ名は本人に付いてきたもので、変えられない。
        名だけは、名簿から引いても自分で書き入れてもよい。
      {:else}
        記録簿の名を書き換える。二つ名は本人のものなので変わらず、
        これまでの遠征記に記された名もそのまま残る。
      {/if}
    </p>

    {#if epithet}
      <div class="trait">
        <div class="trait-head">
          <span class="label">{epithet.label}</span>
          <span class="lore">{epithet.lore}</span>
        </div>
        <ul class="effects">
          {#each effects as e (e.text)}
            <li class:good={e.good} class:bad={!e.good}>{e.text}</li>
          {:else}
            <li>特筆すべき癖はない</li>
          {/each}
        </ul>
      </div>
    {/if}

    <p class="preview">名乗り: <strong>{epithet?.label ?? ''}{value.trim() || '？'}</strong></p>

    <div class="row">
      <!-- svelte-ignore a11y_autofocus -->
      <input
        bind:this={input}
        bind:value
        {onkeydown}
        type="text"
        maxlength={MAX_NAME_LENGTH}
        aria-label="冒険者の名前"
        placeholder="名を入力"
        autocomplete="off"
      />
      <button type="button" class="draw" onclick={draw}>名簿から引く</button>
    </div>
    <p class="hint">{MAX_NAME_LENGTH}文字まで。二つ名の後ろに付く。</p>

    <div class="actions">
      {#if mode === 'rename'}
        <button type="button" class="ghost" onclick={onclose}>やめる</button>
      {/if}
      <button type="button" class="primary" disabled={!valid} onclick={commit}>
        {mode === 'register' ? '記録簿に記す' : '改名する'}
      </button>
    </div>
  </div>
</div>

<style>
  .naming .lead {
    font-size: 0.86rem;
    line-height: 1.9;
    margin: 0 0 1.1rem;
    color: var(--ink-soft);
  }
  .row { display: flex; gap: 0.5rem; }
  .row input {
    flex: 1;
    min-width: 0;
    font-family: var(--serif);
    font-size: 1.05rem;
    letter-spacing: 0.08em;
    color: var(--ink);
    background: rgba(255, 253, 245, 0.6);
    border: 1px solid var(--rule);
    border-bottom: 2px solid var(--ink-soft);
    padding: 0.5rem 0.7rem;
  }
  .row input:focus-visible { outline: 2px solid var(--vermilion); outline-offset: 1px; }
  .row .draw { white-space: nowrap; }
  .trait {
    border: 1px solid var(--rule);
    background: rgba(138, 106, 44, 0.07);
    padding: 0.6rem 0.8rem;
    margin-bottom: 0.9rem;
  }
  .trait-head { display: flex; align-items: baseline; gap: 0.6rem; flex-wrap: wrap; }
  .trait-head .label {
    font-size: 1.05rem;
    letter-spacing: 0.08em;
    color: var(--gold);
    font-weight: 600;
  }
  .trait-head .lore { font-size: 0.74rem; color: var(--ink-soft); }
  .effects {
    list-style: none;
    display: flex;
    flex-wrap: wrap;
    gap: 0.3rem 0.5rem;
    margin: 0.5rem 0 0;
    padding: 0;
  }
  .effects li {
    font-size: 0.74rem;
    font-family: var(--mono);
    padding: 0.1rem 0.45rem;
    border: 1px solid var(--rule);
    color: var(--ink-soft);
  }
  .effects li.good { color: var(--moss); border-color: var(--moss); }
  .effects li.bad { color: var(--vermilion); border-color: var(--vermilion); }

  .preview {
    font-size: 0.78rem;
    color: var(--ink-soft);
    margin: 0 0 0.5rem;
    letter-spacing: 0.06em;
  }
  .preview strong { font-size: 0.95rem; color: var(--ink); letter-spacing: 0.08em; }

  .hint {
    font-size: 0.7rem;
    color: var(--ink-faint);
    margin: 0.45rem 0 0;
    line-height: 1.6;
  }
</style>
