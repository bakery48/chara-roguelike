/**
 * ブラウザ用 harness の検証。
 *
 * harness が「何を渡しても成功」になっていると、HTMLのテストページ全体が
 * 意味を失う。そのためマッチャー層をここで確かめる。
 *
 * 注意: describe/it/beforeEach はモジュール内のグローバルなレジストリに
 * 登録するので、ここでは触らない(触ると自分自身を二重に登録してしまう)。
 * レジストリを持たない expect の判定部分だけを対象にする。
 */
import { describe, expect, it } from 'vitest'
import { expect as browserExpect } from './harness'

/** 失敗すべきアサーションが実際に throw するか。throw したメッセージを返す。 */
function failureOf(fn: () => void): string | null {
  try {
    fn()
    return null
  } catch (e) {
    return e instanceof Error ? e.message : String(e)
  }
}

describe('browser harness: expect', () => {
  it('成功するアサーションは throw しない', () => {
    expect(failureOf(() => browserExpect(1).toBe(1))).toBe(null)
    expect(failureOf(() => browserExpect([1, 2]).toEqual([1, 2]))).toBe(null)
    expect(failureOf(() => browserExpect({ a: { b: 1 } }).toEqual({ a: { b: 1 } }))).toBe(null)
    expect(failureOf(() => browserExpect(['x']).toContain('x'))).toBe(null)
    expect(failureOf(() => browserExpect([{ a: 1 }]).toContainEqual({ a: 1 }))).toBe(null)
    expect(failureOf(() => browserExpect('abc').toMatch(/b/))).toBe(null)
    expect(failureOf(() => browserExpect(3).toBeGreaterThan(2))).toBe(null)
    expect(failureOf(() => browserExpect(2).toBeLessThanOrEqual(2))).toBe(null)
    expect(failureOf(() => browserExpect(0).toBeDefined())).toBe(null)
  })

  it('失敗するアサーションは throw し、理由が読める', () => {
    expect(failureOf(() => browserExpect(1).toBe(2))).toBe('expected 1 to be 2')
    expect(failureOf(() => browserExpect({ a: 1 }).toEqual({ a: 2 }))).toBe(
      'expected {"a":1} to equal {"a":2}'
    )
    expect(failureOf(() => browserExpect(1).toBeGreaterThan(5))).toBe(
      'expected 1 to be greater than 5'
    )
    expect(failureOf(() => browserExpect(undefined).toBeDefined())).toBe(
      'expected undefined to be defined'
    )
    expect(failureOf(() => browserExpect(['a']).toContain('b'))).toBe(
      'expected ["a"] to contain "b"'
    )
    expect(failureOf(() => browserExpect([{ a: 1 }]).toContainEqual({ a: 2 }))).toBe(
      'expected [{"a":1}] to contain equal {"a":2}'
    )
  })

  it('.not は判定を反転する', () => {
    expect(failureOf(() => browserExpect('abc').not.toMatch(/z/))).toBe(null)
    expect(failureOf(() => browserExpect('abc').not.toMatch(/b/))).toBe(
      'expected "abc" not to match /b/'
    )
    expect(failureOf(() => browserExpect(1).not.toBe(1))).toBe('expected 1 not to be 1')
  })

  it('オブジェクトの深い比較でキーの過不足を見落とさない', () => {
    expect(failureOf(() => browserExpect({ a: 1 }).toEqual({ a: 1, b: 2 }))).not.toBe(null)
    expect(failureOf(() => browserExpect({ a: 1, b: 2 }).toEqual({ a: 1 }))).not.toBe(null)
    expect(failureOf(() => browserExpect([1, 2]).toEqual([2, 1]))).not.toBe(null)
  })

  it('未対応のマッチャーは黙って通らず、はっきり失敗する', () => {
    const unsupported = () =>
      (browserExpect(1) as unknown as { toBeTruthy: () => void }).toBeTruthy()
    expect(failureOf(unsupported)).toMatch(/not a function/)
  })

  it('数値以外を数値比較に渡したら失敗する', () => {
    expect(failureOf(() => browserExpect('5').toBeGreaterThan(2))).toMatch(/数値が必要/)
  })
})
