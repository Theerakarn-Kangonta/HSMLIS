import { describe, expect, it } from 'vitest'
import { code128Patterns, code128Values, code128Widths } from './code128'

describe('code128', () => {
  it('has 107 symbols of 11 modules, and a 13-module stop', () => {
    expect(code128Patterns).toHaveLength(107)
    code128Patterns.slice(0, 106).forEach((p) => expect([...p].reduce((s, d) => s + Number(d), 0)).toBe(11))
    expect([...code128Patterns[106]].reduce((s, d) => s + Number(d), 0)).toBe(13)
  })

  it('encodes text in code set B with the standard checksum', () => {
    // Start B, P J J 1 2 3 C: (104 + 48·1 + 42·2 + 42·3 + 17·4 + 18·5 + 19·6 + 35·7) mod 103 = 55
    expect(code128Values('PJJ123C')).toEqual([104, 48, 42, 42, 17, 18, 19, 35, 55])
  })

  it('packs runs of digits into code set C', () => {
    const values = code128Values('CENTER2609210001-01')
    // Start B, CENTER, switch to C, five digit pairs, back to B, "-01", checksum.
    expect(values.slice(0, 7)).toEqual([104, 35, 37, 46, 52, 37, 50])
    expect(values.slice(7, 13)).toEqual([99, 26, 9, 21, 0, 1])
    expect(values[13]).toBe(100)
    expect(values).toHaveLength(18)
  })

  it('starts in code set C for leading digits and leaves an odd digit to B', () => {
    const values = code128Values('12345')
    expect(values.slice(0, 5)).toEqual([105, 12, 34, 100, 21])
  })

  it('draws bars and spaces that add up to the whole width', () => {
    const widths = code128Widths('LAB01')
    const symbols = code128Values('LAB01').length + 1
    expect(widths.reduce((s, w) => s + w, 0)).toBe((symbols - 1) * 11 + 13)
  })

  it('refuses characters it cannot show', () => {
    expect(() => code128Values('ไทย')).toThrow()
  })
})
