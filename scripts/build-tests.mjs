/**
 * scripts/build-tests.mjs — テストをブラウザで走らせる1ファイルHTMLを作る。
 *
 *   npm run test:html   →  dist/tests.html
 *
 * テストファイルの `from 'vitest'` を esbuild の alias でブラウザ用の
 * harness に差し替えてバンドルし、CSS/JS をインライン化する。
 * 走るのは `npm test` と同じテストコードそのもの。
 */
import { build } from 'esbuild'
import { mkdirSync, writeFileSync } from 'node:fs'

const result = await build({
  entryPoints: ['src/lib/__tests__/browser/runner.ts'],
  bundle: true,
  format: 'esm',
  platform: 'browser',
  target: 'es2022',
  alias: { vitest: './src/lib/__tests__/browser/harness.ts' },
  // CSS を伴うバンドルには出力パスの指定が要る。write:false なので実際には書き出さない。
  outdir: 'dist',
  write: false,
  logLevel: 'warning'
})

const js = result.outputFiles.find((f) => f.path.endsWith('.js'))?.text ?? ''
const css = result.outputFiles.find((f) => f.path.endsWith('.css'))?.text ?? ''

if (/<\/script/i.test(js) || /<\/style/i.test(css)) {
  throw new Error('バンドルに </script> または </style> が含まれるためインライン化できません')
}

const html = `<!doctype html>
<html lang="ja">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>遠征記テスト</title>
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Shippori+Mincho:wght@400;600&display=swap" rel="stylesheet" />
<style>${css}</style>
</head>
<body>
<div class="sheet">
  <header class="top">
    <h1>遠 征 記 — 検 証 記 録</h1>
    <p class="sub">ロジックのテストをブラウザ上で実行した結果</p>
  </header>
  <div id="report"></div>
  <footer class="bottom">
    <button id="rerun" type="button">もう一度実行</button>
    <span>npm test と同じテストコードを、ブラウザ上で実行しています。</span>
  </footer>
</div>
<script type="module">${js}</script>
</body>
</html>
`

mkdirSync('dist', { recursive: true })
writeFileSync('dist/tests.html', html)
console.log(`dist/tests.html — ${(Buffer.byteLength(html) / 1024).toFixed(1)} KB`)
