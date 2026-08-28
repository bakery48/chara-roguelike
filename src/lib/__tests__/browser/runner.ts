/**
 * runner.ts — ブラウザ用テストランナーのエントリ。
 *
 * テストファイルを import すると、`from 'vitest'` が alias で harness に
 * 差し替えられているため、describe/it の呼び出しで harness にテストが登録される。
 * あとはそれを走らせて記録簿風のレポートに描くだけ。
 */
import './report.css'
import { plannedCount, runAll, type TestResult } from './harness'

// import した順にスイートが登録される。
import '../expedition.test'
import '../chronicle.test'
import '../save.test'
import './harness.test'

const root = document.getElementById('report')
if (!root) throw new Error('#report が見つかりません')

const el = <K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string
): HTMLElementTagNameMap[K] => {
  const node = document.createElement(tag)
  if (className) node.className = className
  if (text !== undefined) node.textContent = text
  return node
}

/** 1フレーム譲って、進捗が実際に描画されるようにする。 */
const yieldToPaint = () =>
  new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))

async function main(): Promise<void> {
  root!.replaceChildren()
  const total = plannedCount()
  let passed = 0
  let failed = 0

  const verdict = el('span', 'verdict running', '実 行 中')
  const passCell = el('dd', 'ok', '0')
  const failCell = el('dd', 'ng', '0')
  const totalCell = el('dd', '', String(total))
  const timeCell = el('dd', '', '—')

  const tally = el('div', 'tally')
  const dl = el('dl')
  for (const [label, cell] of [
    ['成功', passCell],
    ['失敗', failCell],
    ['総数', totalCell],
    ['所要', timeCell]
  ] as const) {
    const pair = el('div')
    pair.append(el('dt', undefined, label), cell)
    dl.append(pair)
  }
  tally.append(verdict, dl)

  const bar = el('i')
  const progress = el('div', 'progress')
  progress.append(bar)
  root!.append(tally, progress)

  const suiteNodes = new Map<string, { body: HTMLElement; count: HTMLElement; n: number; ok: number }>()
  const started = performance.now()

  const onProgress = async (suiteName: string, result: TestResult): Promise<void> => {
    let suite = suiteNodes.get(suiteName)
    if (!suite) {
      const section = el('section', 'suite')
      const h2 = el('h2')
      const count = el('span', 'count')
      h2.append(el('span', undefined, suiteName), count)
      const body = el('div')
      section.append(h2, body)
      root!.append(section)
      suite = { body, count, n: 0, ok: 0 }
      suiteNodes.set(suiteName, suite)
    }

    const row = el('div', `case ${result.passed ? 'pass' : 'fail'}`)
    row.append(
      el('span', 'mark', result.passed ? '✓' : '✗'),
      el('span', 'name', result.name),
      el('span', 'ms', `${result.durationMs.toFixed(1)}ms`)
    )
    if (!result.passed && result.error) row.append(el('div', 'reason', result.error))
    suite.body.append(row)

    suite.n++
    if (result.passed) suite.ok++
    suite.count.textContent = `${suite.ok}/${suite.n}`

    if (result.passed) passed++
    else failed++
    passCell.textContent = String(passed)
    failCell.textContent = String(failed)
    bar.style.width = `${((passed + failed) / total) * 100}%`
    if (failed > 0) progress.classList.add('has-failure')

    await yieldToPaint()
  }

  await runAll(onProgress)

  const elapsed = performance.now() - started
  timeCell.textContent = `${(elapsed / 1000).toFixed(2)}s`
  verdict.textContent = failed === 0 ? '全 件 成 功' : `${failed} 件 失 敗`
  verdict.className = `verdict ${failed === 0 ? 'pass' : 'fail'}`
  document.title = `${failed === 0 ? '✓' : '✗'} 遠征記テスト — ${passed}/${total}`
}

const rerun = document.getElementById('rerun')
rerun?.addEventListener('click', () => void main())

void main()
