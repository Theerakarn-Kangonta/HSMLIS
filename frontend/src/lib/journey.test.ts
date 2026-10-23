import { describe, expect, it } from 'vitest'
import { isLate, stageOf } from './journey'

const base = { status: 'InProgress' as const, collectedCount: 0, receivedCount: 0, enteredCount: 0 }

describe('stageOf', () => {
  it('follows the specimen', () => {
    expect(stageOf({ ...base, status: 'AwaitingCollection' })).toBe(0)
    expect(stageOf({ ...base, collectedCount: 1 })).toBe(1)
    expect(stageOf({ ...base, receivedCount: 2 })).toBe(2)
    expect(stageOf({ ...base, receivedCount: 2, enteredCount: 1 })).toBe(3)
    expect(stageOf({ ...base, status: 'Completed' })).toBe(4)
  })
})

describe('isLate', () => {
  const now = new Date('2026-10-23T12:00:00Z').getTime()
  it('flags an urgent order after 2 hours and a routine one after a day', () => {
    expect(isLate({ status: 'InProgress', urgent: true, orderedAt: '2026-10-23T09:00:00Z' }, now)).toBe(true)
    expect(isLate({ status: 'InProgress', urgent: false, orderedAt: '2026-10-23T09:00:00Z' }, now)).toBe(false)
    expect(isLate({ status: 'Completed', urgent: true, orderedAt: '2026-10-20T09:00:00Z' }, now)).toBe(false)
  })
})
