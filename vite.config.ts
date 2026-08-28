import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'

export default defineConfig({
  plugins: [svelte()],
  base: './',
  define: {
    // PLAYTEST=1 でビルドしたときだけ検証コンソールを含める。
    // 通常のビルドでは false になり、パネルとその依存は丸ごと落ちる。
    __PLAYTEST__: JSON.stringify(process.env.PLAYTEST === '1')
  }
})
