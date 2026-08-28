/**
 * scripts/build-single.mjs — 1ファイルのHTMLに丸める。
 *
 *   npm run build:single   →  out/standalone.html
 *
 * 出力先が dist/ ではなく out/ なのは、vite build が dist/ を毎回空にするため。
 * dist/ は静的サイトとしてのデプロイ用、out/ は1ファイル配布用。
 *
 * CSS と JS をインライン化するので、ファイルをそのままブラウザで開けば遊べる。
 * itch.io へのアップロードや、リンクを渡さずに配る用途を想定している。
 * フォントだけは Google Fonts を参照する(取得できなくてもフォールバックする)。
 */
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

/** --out <path> / --title <text> を受け取る(テストプレイ用ビルドと出し分けるため)。 */
function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`)
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback
}

const dist = 'dist'
const assets = join(dist, 'assets')
const files = readdirSync(assets)
const css = readFileSync(join(assets, files.find((f) => f.endsWith('.css'))), 'utf8')
const js = readFileSync(join(assets, files.find((f) => f.endsWith('.js'))), 'utf8')

// インラインスクリプトを途中で終わらせてしまう文字列がないか確認する。
if (/<\/script/i.test(js) || /<\/style/i.test(css)) {
  throw new Error('バンドルに </script> または </style> が含まれるためインライン化できません')
}

const out = arg('out', 'out/standalone.html')
const title = arg('title', '遠征記 — 放置遠征ローグライト')

const html = `<!doctype html>
<html lang="ja">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${title}</title>
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Shippori+Mincho:wght@400;600&display=swap" rel="stylesheet" />
<style>${css}</style>
</head>
<body>
<div id="app"></div>
<script type="module">${js}</script>
</body>
</html>
`

mkdirSync('out', { recursive: true })
writeFileSync(out, html)
console.log(`${out} — ${(Buffer.byteLength(html) / 1024).toFixed(1)} KB`)
