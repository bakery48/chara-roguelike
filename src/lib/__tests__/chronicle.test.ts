import { describe, expect, it } from 'vitest'
import { CONFIG } from '../../config'
import { buildTimeline, composeChronicle } from '../chronicle'
import { advanceExpedition, createExpedition, settleExpedition } from '../expedition'
import { beginExpedition, stepGame } from '../game'
import { defaultState } from '../save'
import { CLOSINGS, MIDDLES, OPENINGS } from '../templates'

describe('templates', () => {
  it('テンプレートは合計20種以上ある', () => {
    expect(OPENINGS.length + MIDDLES.length + CLOSINGS.length).toBeGreaterThanOrEqual(20)
  })

  it('テンプレートIDは重複しない', () => {
    const ids = [...OPENINGS, ...MIDDLES, ...CLOSINGS].map((t) => t.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('どのプールにも無条件で選べる受け皿がある', () => {
    expect(OPENINGS.some((t) => t.id === 'open.plain')).toBe(true)
    expect(MIDDLES.some((t) => t.id === 'mid.quiet')).toBe(true)
  })
})

describe('composeChronicle', () => {
  it('スロットを埋め残さず、複数文の遠征記を作る', () => {
    const state = { ...defaultState(), heroName: 'テスト遠征者' }
    for (let seed = 0; seed < 100; seed++) {
      const exp = createExpedition(state)
      exp.seed = seed
      advanceExpedition(exp, 3600_000)
      const settlement = settleExpedition(exp, state.upgrades)
      const c = composeChronicle(exp, settlement, state)
      expect(c.text).not.toMatch(/[{}]/) // 未置換のスロットが残っていない
      expect(c.text.length).toBeGreaterThan(20)
      expect(c.text.split('。').length).toBeGreaterThanOrEqual(2)
      expect(c.summary.outcome).toBe(exp.outcome)
    }
  })

  it('同じ遠征からは同じ文章が出る(決定論)', () => {
    const state = { ...defaultState(), heroName: 'テスト遠征者' }
    const exp = createExpedition(state)
    exp.seed = 4242
    advanceExpedition(exp, 3600_000)
    const s = settleExpedition(exp, state.upgrades)
    expect(composeChronicle(exp, s, state).text).toBe(composeChronicle(exp, s, state).text)
  })

  it('文面は状況によって揺れる', () => {
    const state = { ...defaultState(), heroName: 'テスト遠征者' }
    const texts = new Set<string>()
    for (let seed = 0; seed < 40; seed++) {
      const exp = createExpedition(state)
      exp.seed = seed
      advanceExpedition(exp, 3600_000)
      texts.add(composeChronicle(exp, settleExpedition(exp, state.upgrades), state).text)
    }
    expect(texts.size).toBeGreaterThan(20)
  })

  it('死亡した遠征には death タグが付く', () => {
    const state = { ...defaultState(), heroName: 'テスト遠征者' }
    let checked = 0
    for (let seed = 0; seed < 60 && checked < 3; seed++) {
      const exp = createExpedition(state)
      exp.seed = seed
      advanceExpedition(exp, 3600_000)
      if (exp.outcome !== 'death') continue
      checked++
      const c = composeChronicle(exp, settleExpedition(exp, state.upgrades), state)
      expect(c.tags).toContain('death')
    }
    expect(checked).toBeGreaterThan(0)
  })
})

describe('buildTimeline', () => {
  it('平凡な遠征が続くとダイジェストにまとまる', () => {
    const state = { ...defaultState(), heroName: 'テスト遠征者' }
    beginExpedition(state)
    stepGame(state, 2 * 3600_000)
    const items = buildTimeline(state.chronicles)
    const entries = items.filter((i) => i.kind === 'entry').length
    expect(items.length).toBeLessThanOrEqual(state.chronicles.length)
    expect(entries).toBeGreaterThan(0)
    for (const i of items) {
      if (i.kind === 'digest') expect(i.count).toBeGreaterThanOrEqual(CONFIG.chronicle.digestThreshold)
    }
  })
})
