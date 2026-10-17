// Code 128 barcodes, drawn as SVG by components/Barcode.tsx. Text is encoded in code set B,
// switching to code set C for runs of four or more digits, which halves their width. Order
// numbers are mostly digits, so labels stay narrow enough for 50 mm tubes.

// Bar and space widths of every symbol, in modules. 103–105 start in A, B or C; 106 stops.
const PATTERNS = [
  '212222', '222122', '222221', '121223', '121322', '131222', '122213', '122312', '132212', '221213',
  '221312', '231212', '112232', '122132', '122231', '113222', '123122', '123221', '223211', '221132',
  '221231', '213212', '223112', '312131', '311222', '321122', '321221', '312212', '322112', '322211',
  '212123', '212321', '232121', '111323', '131123', '131321', '112313', '132113', '132311', '211313',
  '231113', '231311', '112133', '112331', '132131', '113123', '113321', '133121', '313121', '211331',
  '231131', '213113', '213311', '213131', '311123', '311321', '331121', '312113', '312311', '332111',
  '314111', '221411', '431111', '111224', '111422', '121124', '121421', '141122', '141221', '112214',
  '112412', '122114', '122411', '142112', '142211', '241211', '221114', '413111', '241112', '134111',
  '111242', '121142', '121241', '114212', '124112', '124211', '411212', '421112', '421211', '212141',
  '214121', '412121', '111143', '111341', '131141', '114113', '114311', '411113', '411311', '113141',
  '114131', '311141', '411131', '211412', '211214', '211232', '2331112',
]

const START_B = 104
const START_C = 105
const CODE_B = 100
const CODE_C = 99
const STOP = 106

export const code128Patterns = PATTERNS

/** The symbol values for `text`, with start and checksum but without the stop symbol. */
export function code128Values(text: string): number[] {
  for (const ch of text) {
    const code = ch.charCodeAt(0)
    if (code < 32 || code > 126) throw new Error(`Code 128 cannot show "${ch}"`)
  }
  const values: number[] = []
  let set: 'B' | 'C' | null = null
  let i = 0
  while (i < text.length) {
    const digits = /^\d+/.exec(text.slice(i))?.[0].length ?? 0
    if (digits >= 4) {
      // An even number of digits in C; an odd one left over goes in B.
      const pairs = Math.floor(digits / 2)
      if (set === null) values.push(START_C)
      else if (set === 'B') values.push(CODE_C)
      set = 'C'
      for (let p = 0; p < pairs; p++) {
        values.push(Number(text.slice(i, i + 2)))
        i += 2
      }
      continue
    }
    if (set !== 'B') values.push(set === null ? START_B : CODE_B)
    set = 'B'
    values.push(text.charCodeAt(i) - 32)
    i++
  }
  if (values.length === 0) values.push(START_B)
  const checksum = values.reduce((sum, value, index) => sum + value * Math.max(1, index), 0) % 103
  values.push(checksum)
  return values
}

/** Alternating bar/space widths in modules, starting with a bar, for the whole barcode. */
export function code128Widths(text: string): number[] {
  return [...code128Values(text), STOP].flatMap((value) => [...PATTERNS[value]].map(Number))
}
