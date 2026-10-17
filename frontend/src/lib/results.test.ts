import { describe, expect, it } from 'vitest'
import type { ReferenceRange } from './api'
import { evaluate, isPositive, pickRange } from './results'

const range = (patch: Partial<ReferenceRange>): ReferenceRange => ({
  sex: null,
  ageMinYears: null,
  ageMaxYears: null,
  low: null,
  high: null,
  criticalLow: null,
  criticalHigh: null,
  normalText: null,
  ...patch,
})

describe('result flags (same rules as the server)', () => {
  const glucose = range({ low: 70, high: 100, criticalLow: 40, criticalHigh: 450 })

  it('flags numbers with critical limits first', () => {
    expect(evaluate('Numeric', '85', glucose)).toBe('None')
    expect(evaluate('Numeric', '69', glucose)).toBe('Low')
    expect(evaluate('Numeric', '101', glucose)).toBe('High')
    expect(evaluate('Numeric', '40', glucose)).toBe('CriticalLow')
    expect(evaluate('Numeric', '>500', glucose)).toBe('CriticalHigh')
  })

  it('judges text against the expected answer', () => {
    const negative = range({ normalText: 'Negative' })
    expect(evaluate('Choice', 'Negative', negative)).toBe('None')
    expect(evaluate('Choice', 'Reactive', negative)).toBe('Positive')
    expect(evaluate('Choice', '1-9 AFB', negative)).toBe('Abnormal')
    expect(evaluate('Choice', 'Not done', negative)).toBe('None')
    expect(isPositive('Non Reactive')).toBe(false)
    expect(isPositive('3+')).toBe(true)
  })

  it('picks the most specific range', () => {
    const both = range({ low: 1 })
    const male = range({ sex: 'Male', low: 2 })
    const adultMale = range({ sex: 'Male', ageMinYears: 18, low: 3 })
    expect(pickRange([both, male, adultMale], 'Male', 40)).toBe(adultMale)
    expect(pickRange([both, male, adultMale], 'Male', 10)).toBe(male)
    expect(pickRange([both, male, adultMale], 'Female', 40)).toBe(both)
  })
})
