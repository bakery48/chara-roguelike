import { beforeEach, describe, expect, it } from 'vitest'
import { CONFIG } from '../../config'
import { STORAGE_KEY, clearState, defaultState, loadState, saveState } from '../save'
import { beginExpedition, stepGame } from '../game'

describe('save', () => {
  beforeEach(() => clearState())

  it('セーブしたものをそのまま読み戻せる', () => {
    const state = defaultState()
    beginExpedition(state)
    stepGame(state, 5 * 60 * 1000)
    saveState(state)
    const { state: loaded, loaded: ok } = loadState()
    expect(ok).toBe(true)
    expect(loaded.stats.totalExpeditions).toBe(state.stats.totalExpeditions)
    expect(loaded.chronicles.length).toBe(state.chronicles.length)
    expect(loaded.version).toBe(CONFIG.saveVersion)
  })

  it('壊れたデータなら新規で始める', () => {
    localStorage.setItem(STORAGE_KEY, '{ not json')
    const { state, loaded } = loadState()
    expect(loaded).toBe(false)
    expect(state.stats.totalExpeditions).toBe(0)
  })

  it('未知の古いバージョンは新規扱いにフォールバックする', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: -1, legacy: 999 }))
    const { state, loaded } = loadState()
    expect(loaded).toBe(false)
    expect(state.legacy).toBe(0)
  })

  it('フィールドが欠けていても既定値で補完する', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ version: CONFIG.saveVersion, legacy: 50, upgrades: { forge: 2 } })
    )
    const { state, loaded } = loadState()
    expect(loaded).toBe(true)
    expect(state.legacy).toBe(50)
    expect(state.upgrades.forge).toBe(2)
    expect(state.upgrades.tavern).toBe(0)
    expect(state.settings.targetFloor).toBe(CONFIG.retreat.defaultTargetFloor)
    expect(state.chronicles).toEqual([])
  })
})
