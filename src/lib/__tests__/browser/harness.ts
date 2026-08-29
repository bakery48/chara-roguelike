/**
 * harness.ts — ブラウザでテストを走らせるための最小の vitest 互換シム。
 *
 * `npm run test:html` のビルド時に、テストファイルの `from 'vitest'` を
 * esbuild の alias でこのモジュールに差し替える。
 * 実装しているのは既存テストが実際に使っている API だけ。
 * 新しいマッチャーを使うテストを書いたらここに足すこと
 * (足し忘れても未対応マッチャーとして失敗するので、黙って通ることはない)。
 */

export interface TestResult {
  name: string
  passed: boolean
  error?: string
  durationMs: number
}

export interface SuiteResult {
  name: string
  results: TestResult[]
}

interface Suite {
  name: string
  tests: { name: string; fn: () => void | Promise<void> }[]
  hooks: (() => void | Promise<void>)[]
}

const suites: Suite[] = []
let current: Suite | null = null

export function describe(name: string, fn: () => void): void {
  const suite: Suite = { name, tests: [], hooks: [] }
  suites.push(suite)
  const parent = current
  current = suite
  try {
    fn()
  } finally {
    current = parent
  }
}

export function it(name: string, fn: () => void | Promise<void>): void {
  if (!current) throw new Error(`it("${name}") は describe の外では使えません`)
  current.tests.push({ name, fn })
}

export function beforeEach(fn: () => void | Promise<void>): void {
  if (!current) throw new Error('beforeEach は describe の外では使えません')
  current.hooks.push(fn)
}

/** 失敗メッセージ用に値を読みやすく整形する。 */
function show(v: unknown): string {
  if (typeof v === 'string') return JSON.stringify(v)
  if (typeof v === 'bigint') return `${v}n`
  if (v instanceof Error) return `${v.name}: ${v.message}`
  try {
    const s = JSON.stringify(v)
    if (s === undefined) return String(v)
    return s.length > 200 ? `${s.slice(0, 200)}…` : s
  } catch {
    return String(v)
  }
}

function deepEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false
  if (Array.isArray(a) !== Array.isArray(b)) return false
  const ka = Object.keys(a as object)
  const kb = Object.keys(b as object)
  if (ka.length !== kb.length) return false
  return ka.every(
    (k) =>
      Object.prototype.hasOwnProperty.call(b, k) &&
      deepEqual((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k])
  )
}

export interface Matchers {
  toBe(expected: unknown): void
  toEqual(expected: unknown): void
  toContain(expected: unknown): void
  toContainEqual(expected: unknown): void
  toMatch(expected: RegExp | string): void
  toBeDefined(): void
  toBeGreaterThan(expected: number): void
  toBeGreaterThanOrEqual(expected: number): void
  toBeLessThan(expected: number): void
  toBeLessThanOrEqual(expected: number): void
}

function build(actual: unknown, negated: boolean): Matchers {
  /** 判定結果を、否定(`.not`)を踏まえて検証する。 */
  const check = (ok: boolean, describeExpectation: string): void => {
    if (ok === !negated) return
    const not = negated ? ' not' : ''
    throw new Error(`expected ${show(actual)}${not} ${describeExpectation}`)
  }

  const asNumber = (label: string): number => {
    if (typeof actual !== 'number') {
      throw new Error(`${label} には数値が必要ですが ${show(actual)} が渡されました`)
    }
    return actual
  }

  return {
    toBe: (e) => check(Object.is(actual, e), `to be ${show(e)}`),
    toEqual: (e) => check(deepEqual(actual, e), `to equal ${show(e)}`),
    toContain: (e) => {
      if (typeof actual === 'string') {
        check(actual.includes(String(e)), `to contain ${show(e)}`)
      } else if (Array.isArray(actual)) {
        check(actual.some((v) => deepEqual(v, e)), `to contain ${show(e)}`)
      } else {
        throw new Error(`toContain は文字列か配列にしか使えません: ${show(actual)}`)
      }
    },
    toContainEqual: (e) => {
      if (!Array.isArray(actual)) {
        throw new Error(`toContainEqual は配列にしか使えません: ${show(actual)}`)
      }
      check(actual.some((v) => deepEqual(v, e)), `to contain equal ${show(e)}`)
    },
    toMatch: (e) => {
      const re = typeof e === 'string' ? new RegExp(e) : e
      check(re.test(String(actual)), `to match ${re}`)
    },
    toBeDefined: () => check(actual !== undefined, 'to be defined'),
    toBeGreaterThan: (e) => check(asNumber('toBeGreaterThan') > e, `to be greater than ${e}`),
    toBeGreaterThanOrEqual: (e) =>
      check(asNumber('toBeGreaterThanOrEqual') >= e, `to be greater than or equal to ${e}`),
    toBeLessThan: (e) => check(asNumber('toBeLessThan') < e, `to be less than ${e}`),
    toBeLessThanOrEqual: (e) =>
      check(asNumber('toBeLessThanOrEqual') <= e, `to be less than or equal to ${e}`)
  }
}

export function expect(actual: unknown): Matchers & { not: Matchers } {
  return Object.assign(build(actual, false), { not: build(actual, true) })
}

/** 収集済みのテストを全部走らせる。`onProgress` は1件ごとに呼ばれる。 */
export async function runAll(
  onProgress?: (suite: string, result: TestResult) => void | Promise<void>
): Promise<SuiteResult[]> {
  const out: SuiteResult[] = []
  for (const suite of suites) {
    const results: TestResult[] = []
    for (const test of suite.tests) {
      const start = performance.now()
      let passed = true
      let error: string | undefined
      try {
        for (const hook of suite.hooks) await hook()
        await test.fn()
      } catch (e) {
        passed = false
        error = e instanceof Error ? e.message : String(e)
      }
      const result = { name: test.name, passed, error, durationMs: performance.now() - start }
      results.push(result)
      await onProgress?.(suite.name, result)
    }
    out.push({ name: suite.name, results })
  }
  return out
}

/** 収集されたテストの総数(実行前に分かる)。 */
export function plannedCount(): number {
  return suites.reduce((n, s) => n + s.tests.length, 0)
}
