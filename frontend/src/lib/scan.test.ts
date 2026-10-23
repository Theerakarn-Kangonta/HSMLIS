import { describe, expect, it } from 'vitest'
import { createScanBuffer } from './scan'

const type = (text: string, start: number, gap: number) => {
  const push = createScanBuffer()
  let result: string | null = null
  ;[...text, 'Enter'].forEach((key, i) => (result = push(key, start + i * gap)))
  return result
}

describe('createScanBuffer', () => {
  it('reads a fast run ended by Enter as a scan', () => expect(type('S26100001-1', 1000, 8)).toBe('S26100001-1'))
  it('ignores a person typing', () => expect(type('S26100001-1', 1000, 120)).toBeNull())
  it('ignores runs too short to be a label', () => expect(type('ab', 1000, 5)).toBeNull())
  it('drops a slow keystroke before the scan', () => {
    const push = createScanBuffer()
    push('x', 0)
    ;[...'26100001'].forEach((k, i) => push(k, 500 + i * 5))
    expect(push('Enter', 545)).toBe('26100001')
  })
})
