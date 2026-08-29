<script lang="ts">
  import { MAX_NAME_LENGTH } from '../lib/names'
  import { game } from '../lib/store.svelte'

  interface Props {
    /** 'register' は初回登録(取り消せない)、'rename' は改名(取り消せる)。 */
    mode: 'register' | 'rename'
    onclose: () => void
  }
  const { mode, onclose }: Props = $props()

  // モーダルは開くたびに作り直されるので、初期値を一度読むだけで正しい。
  // svelte-ignore state_referenced_locally
  let value = $state(mode === 'rename' ? game.state.heroName : game.suggestName())
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
        ギルドの記録簿に名を記す。名簿から引いてもよいし、自分で書き入れてもよい。
      {:else}
        記録簿の名を書き換える。これまでの遠征記に記された名はそのまま残る。
      {/if}
    </p>

    <div class="row">
      <!-- svelte-ignore a11y_autofocus -->
      <input
        bind:this={input}
        bind:value
        {onkeydown}
        type="text"
        maxlength={MAX_NAME_LENGTH}
        aria-label="冒険者の名前"
        placeholder="名前を入力"
        autocomplete="off"
      />
      <button type="button" class="draw" onclick={draw}>名簿から引く</button>
    </div>
    <p class="hint">{MAX_NAME_LENGTH}文字まで。二つ名を付けても構わない。</p>

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
  .hint {
    font-size: 0.7rem;
    color: var(--ink-faint);
    margin: 0.45rem 0 0;
    line-height: 1.6;
  }
</style>
