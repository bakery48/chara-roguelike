# 遠征記 — 放置遠征ローグライト (MVP)

ヒーローが自動でダンジョンへ遠征する放置型インクリメンタル×ローグライト。
プレイヤーの核となる意思決定は「どこまで潜らせるか（撤退ライン）」のリスク管理で、
遠征の顛末はテンプレート合成による「遠征記」として記録庫に蓄積される。

`GAME_DESIGN.md` の **MVPスコープ** を Vite + Svelte 5 + TypeScript で実装したもの。

## 動かす

```bash
npm install
npm run dev            # 開発サーバー (http://localhost:5173)
npm run build          # 型チェック + 本番ビルド (dist/)
npm run build:single   # CSS/JS をインライン化した1ファイル (out/standalone.html)
npm run preview        # ビルド結果の確認
npm test               # ロジックのテスト (vitest)
npm run build:playtest # 検証コンソール付きのテストプレイ用ビルド (out/playtest.html)
npm run test:html      # 同じテストをブラウザで走らせる1ファイル (out/tests.html)
npm run balance        # バランス確認シミュレーション (下記)
```

バックエンドを持たない静的サイトで、`vite.config.ts` の `base` は `'./'` にしてある。
`dist/` をそのまま itch.io に zip でアップロードしたり、任意のサブパスに置いて配信できる。
`out/standalone.html` は1ファイルで完結するので、ブラウザで直接開いても遊べる
（`vite build` が `dist/` を毎回空にするため、1ファイル出力の置き場は `out/` に分けてある）。

## MVPスコープの実装状況

| # | スコープ | 実装 |
|---|---|---|
| 1 | 1つのダンジョン、10階まで | `config.ts` の `dungeon`（`maxFloor: 10`） |
| 2 | 遠征の自動進行（戦闘/宝箱/罠）と撤退ライン設定 | `lib/expedition.ts` / `components/StatusPanel.svelte` |
| 3 | 死亡 → 遺産ポイント → 恒久強化3種 | `lib/game.ts` / `components/BasePanel.svelte`（鍛冶屋・酒場・図書館） |
| 4 | 遠征記の生成と一覧表示（テンプレート20種程度） | `lib/chronicle.ts` / `lib/templates.ts`（**48種**: 導入11 · 中盤15 · 結び22） / `components/ChroniclePanel.svelte` |
| 5 | 自動セーブ + オフライン進行 | `lib/save.ts` / `lib/store.svelte.ts` |

MVPに含めないもの（分岐イベント、装備システム、複数ダンジョン、実績、Steam連携）は未実装。
宝箱から出る「お宝」はステータス効果を持たず、遠征記の彩りとしてのみ機能する。

## 数値バランスは `src/config.ts` に集約

ゲームロジック側にマジックナンバーを置かない方針。時間スケール、敵のスケーリング、
報酬曲線（`reward = base × 1.12^floor`）、強化コスト曲線（`cost = base × growth^level`）、
死亡ペナルティ、撤退ラインの選択肢、遠征記の挙動まで、すべて `CONFIG` から読む。
**バランス調整はこのファイルの編集だけで完結する。**

調整したら `npm run balance` を流すと、

1. 撤退ライン別の死亡率・平均到達階・遺産/分（無強化・中盤・終盤の3段階）
2. 強化コスト曲線
3. 放置したときの成長曲線（何時間で何階まで行けるか）と、実際に生成された遠征記

が数字で出る。現状の調整はこの出力を見ながら、以下を満たすようにしてある。

- 序盤の1遠征は約2分、最深部まで潜る終盤の遠征は約4分（設計の「序盤2〜5分」）
- 浅く安全に周回する方が有利な序盤 → 深く潜る方が有利な終盤、という勾配
- 強欲設定は序盤では自殺行為（死亡率100%）、終盤で初めて最効率になる

## テストプレイ

放置ゲームなので、素で触ると1遠征2分・強化が効いてくるまで数時間かかる。
`npm run build:playtest` で出る `out/playtest.html` には画面下に検証コンソールが付き、

- **倍速** ×1 / ×5 / ×20 / ×100 / ×500
- **時間を飛ばす** +10分 / +1時間 / +8時間（オフライン進行と同じ経路で即座に消化）
- **遺産ポイント付与** +100 / +1,000 / +10,000
- **今の遠征を** 帰還させる / 死なせる / 運を引き直す（両方の結末と遠征記をすぐ確認できる）
- **内部状態** フェーズ・次イベントまでの残り・seed・死亡率・遠征記の件数

が使える。数時間ぶんの成長曲線を数分で見るためのもの。

コンソールは `__PLAYTEST__` というビルド時フラグ（`vite.config.ts` の `define`）で
囲ってあり、通常のビルドにはパネルもその依存も一切含まれない。

## テスト

`npm test` で vitest。`npm run test:html` を使うと **同じテストコード** を
ブラウザで実行する1ファイル `out/tests.html` が出る（開くだけで走る）。
テストファイルの `from 'vitest'` を esbuild の alias で
`src/lib/__tests__/browser/harness.ts`(最小の vitest 互換シム)に差し替えているだけで、
テスト側にブラウザ用の分岐は入れていない。

harness が「何を渡しても成功」になっていると HTML のレポート全体が意味を失うので、
harness 自身も `browser/harness.test.ts` で検証している
（失敗が失敗として出るか、`.not` が反転するか、未対応のマッチャーが黙って通らないか）。
新しいマッチャーを使うテストを書いたときは harness に足す。足し忘れた場合は
`not a function` で落ちるので、黙って通ることはない。

## 設計上のポイント

**遠征シミュレーションは純粋関数**（`lib/expedition.ts` / `lib/game.ts`）。
実時間のティックもオフライン進行も同じ `stepGame()` を通り、乱数は遠征ごとの seed から
決定論的に引いて消費状態を seed に書き戻す。このため、

- 8時間閉じていた場合と、開いたまま8時間待った場合の結果が一致する
- セーブ／ロードを跨いでも進行中の遠征が同じ結末に向かう

これはテストで検証している（`刻み幅を変えても結果が一致する`）。

**遠征記はLLMを使わない**。遠征中の全イベントを構造化ログ
（`{ floor, type, enemy?, item?, damage?, outcome, t }`）として記録し、
終了時にハイライトを抽出して「導入／中盤の見せ場／結び」の3プールから
状況タグに合うテンプレートを重み付き抽選して合成する。
直前の遠征記で使ったテンプレートは避けるので、周回しても文面が固まらない。

**セーブはバージョン番号を持つ**。スキーマを変えたら `CONFIG.saveVersion` を上げ、
`lib/save.ts` の `MIGRATIONS` に `n → n+1` の関数を追加する。
変換手段がない古いデータや壊れたデータは新規データにフォールバックし、
フィールドの欠落は既定値で補完する。

## ファイル構成

```
src/
  config.ts              数値バランス（ここだけ触ればバランス調整が済む）
  types.ts               ドメイン型
  App.svelte             3カラムのレイアウト（左:ステータス 中:ログ/記録庫 右:拠点）
  components/            StatusPanel / LogPanel / ChroniclePanel / BasePanel
                         PlaytestPanel（テストプレイ用ビルドのみ）
  lib/
    expedition.ts        遠征シミュレーション（純粋）
    game.ts              遠征の連鎖・精算・恒久強化・オフライン消化（純粋）
    store.svelte.ts      Svelte 5 runes による状態・ティック・セーブ
    chronicle.ts         構造化ログ → 遠征記の合成、年表のダイジェスト化
    templates.ts         遠征記テンプレート（48種）
    content.ts           敵・お宝・罠の名前
    save.ts              localStorage セーブとマイグレーション
    rng.ts               決定論的乱数（mulberry32）
    playtest.ts          検証コンソールの操作（テストプレイ用ビルドのみ）
    __tests__/           vitest のテスト
      browser/           ブラウザでテストを走らせる harness と runner
scripts/
  balance.ts             バランス確認シミュレーション
  build-single.mjs       1ファイルのゲーム (out/standalone.html / out/playtest.html)
  build-tests.mjs        1ファイルのテストページ (out/tests.html)
```

UIは絵を使わず、数字・バー・テキスト・記号のみ。羊皮紙と活字の質感はCSSで作っている。
