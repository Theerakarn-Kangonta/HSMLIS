// Specimen labels as TSPL for TSC label printers, sent through QZ Tray (lib/qz.ts).
// The whole label is drawn on a canvas at the printer's resolution and sent as one bitmap, so
// Thai names print without fonts in the printer, and it matches the preview in SpecimenLabelsPage.
// The barcode is drawn with whole printer dots per module, so it scans as well as a native one.
import type { Container, OrderDetail } from './api'
import { code128Widths } from './code128'
import { printRaw } from './qz'

/** Label stock, in mm. The gap is the space between labels on the roll. */
export const LABEL = { width: 50, height: 25, gap: 3 }
/** 203 dpi: TSC TDP-247 and most desktop label printers. */
const DOTS_PER_MM = 8
/** TSPL print direction. Set it to 0 if labels come out upside down. */
const DIRECTION = 1

const W = LABEL.width * DOTS_PER_MM
const H = LABEL.height * DOTS_PER_MM
const PAD = { top: 12, right: 16, bottom: 12, left: 8 }
const NAME_ROW = { top: PAD.top, height: 26 }
const FONT = `Sarabun, 'IBM Plex Sans Thai', Tahoma, sans-serif`
const MONO = `'IBM Plex Mono', Consolas, monospace`

/** Prints every label of the order that is not rejected; returns how many were printed. */
export async function printSpecimenLabels(order: OrderDetail, printer: string): Promise<number> {
  await Promise.all([
    document.fonts.load(`700 22px ${FONT}`, 'ก'),
    document.fonts.load(`400 18px ${FONT}`, 'ก'),
    document.fonts.load(`500 26px ${MONO}`, '0'),
  ]).catch(() => undefined)

  const chunks: Uint8Array[] = []
  let count = 0
  for (const container of order.containers) {
    if (container.status === 'Rejected' || container.labelCount <= 0) continue
    chunks.push(labelCommands(drawLabel(order, container), container.labelCount))
    count += container.labelCount
  }
  if (count > 0) await printRaw(printer, concat(chunks))
  return count
}

function drawLabel(order: OrderDetail, container: Container): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas is not available')
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, W, H)
  ctx.fillStyle = '#000'

  // Order number, turned 90° to the left so it reads upright on the tube. Its last digit is
  // centred on the name row, like the preview; the font shrinks for long numbers.
  let size = 26
  ctx.textBaseline = 'middle'
  const fit = () => {
    ctx.font = `500 ${size}px ${MONO}`
    ctx.letterSpacing = '1px'
    return ctx.measureText(order.orderNo).width
  }
  while (size > 14 && fit() > H - PAD.top - PAD.bottom) size--
  const digit = ctx.measureText('0').width
  const columnCentre = PAD.left + size / 2
  ctx.save()
  ctx.translate(columnCentre, NAME_ROW.top + NAME_ROW.height / 2 - digit / 2)
  ctx.rotate(-Math.PI / 2)
  ctx.textAlign = 'right'
  ctx.fillText(order.orderNo, 0, 0)
  ctx.restore()
  ctx.letterSpacing = '0px'

  const divider = PAD.left + size + 6
  ctx.fillRect(divider, PAD.top, 2, H - PAD.top - PAD.bottom)
  const left = divider + 12
  const right = W - PAD.right

  // Patient name, with URGENT on the right.
  const nameMiddle = NAME_ROW.top + NAME_ROW.height / 2
  let nameRight = right
  if (order.urgent) {
    ctx.font = `700 16px ${FONT}`
    const boxWidth = ctx.measureText('URGENT').width + 8
    ctx.fillRect(right - boxWidth, NAME_ROW.top + 2, boxWidth, NAME_ROW.height - 4)
    ctx.fillStyle = '#fff'
    ctx.textAlign = 'center'
    ctx.fillText('URGENT', right - boxWidth / 2, nameMiddle)
    ctx.fillStyle = '#000'
    nameRight -= boxWidth + 6
  }
  ctx.font = `700 22px ${FONT}`
  ctx.textAlign = 'left'
  ctx.fillText(truncate(ctx, order.patient.fullName, nameRight - left), left, nameMiddle)

  // HN on the left, the referrer's code on the right.
  const infoMiddle = NAME_ROW.top + NAME_ROW.height + 12
  ctx.font = `400 18px ${FONT}`
  const hn = `HN ${order.patient.hn}`
  ctx.fillText(hn, left, infoMiddle)
  if (order.referrer?.code) {
    ctx.textAlign = 'right'
    ctx.fillText(truncate(ctx, order.referrer.code, right - left - ctx.measureText(hn).width - 8), right, infoMiddle)
    ctx.textAlign = 'left'
  }

  // Barcode of the specimen number, with a quiet zone of 10 modules on each side.
  const barcodeTop = infoMiddle + 14
  const barcodeHeight = 48
  const widths = code128Widths(container.lsn)
  const modules = widths.reduce((a, b) => a + b, 0) + 20
  const module = Math.max(1, Math.floor((right - left) / modules))
  let x = left + Math.floor((right - left - modules * module) / 2) + 10 * module
  widths.forEach((w, i) => {
    if (i % 2 === 0) ctx.fillRect(x, barcodeTop, w * module, barcodeHeight)
    x += w * module
  })

  // Specimen and every test code, wrapped after a comma or space; lines that do not fit are left off.
  ctx.font = `400 16px ${FONT}`
  ctx.textBaseline = 'top'
  const lineHeight = 17
  let y = barcodeTop + barcodeHeight + 6
  for (const line of wrap(ctx, `${container.specimenName} · ${container.testCodes.join(', ')}`, right - left)) {
    if (y + lineHeight > H - PAD.bottom + 4) break
    ctx.fillText(line, left, y)
    y += lineHeight
  }
  return canvas
}

function truncate(ctx: CanvasRenderingContext2D, text: string, width: number) {
  if (ctx.measureText(text).width <= width) return text
  const chars = Array.from(text)
  while (chars.length > 0 && ctx.measureText(`${chars.join('')}…`).width > width) chars.pop()
  return `${chars.join('')}…`
}

function wrap(ctx: CanvasRenderingContext2D, text: string, width: number): string[] {
  const lines: string[] = []
  let line = ''
  // Words keep their trailing comma or space, so a line breaks only after one.
  for (const word of text.match(/[^,\s]+[,\s]*|[,\s]+/g) ?? []) {
    if (ctx.measureText(line + word).width <= width) {
      line += word
      continue
    }
    if (line) lines.push(line.trimEnd())
    line = ''
    // A word longer than the line is split where it has to be.
    for (const ch of Array.from(word)) {
      if (line && ctx.measureText(line + ch).width > width) {
        lines.push(line)
        line = ''
      }
      line += ch
    }
  }
  if (line.trim()) lines.push(line.trimEnd())
  return lines
}

/** One label as TSPL: the canvas as a 1-bit bitmap, printed <copies> times. */
function labelCommands(canvas: HTMLCanvasElement, copies: number): Uint8Array {
  const pixels = canvas.getContext('2d')!.getImageData(0, 0, W, H).data
  const rowBytes = W / 8
  // In a TSPL bitmap a set bit is white and a clear bit prints.
  const bitmap = new Uint8Array(rowBytes * H).fill(0xff)
  for (let row = 0; row < H; row++) {
    for (let col = 0; col < W; col++) {
      const p = (row * W + col) * 4
      const grey = 0.299 * pixels[p] + 0.587 * pixels[p + 1] + 0.114 * pixels[p + 2]
      if (grey < 160) bitmap[row * rowBytes + (col >> 3)] &= ~(0x80 >> (col & 7))
    }
  }
  return concat([
    ascii(`SIZE ${LABEL.width} mm,${LABEL.height} mm\r\nGAP ${LABEL.gap} mm,0 mm\r\nDIRECTION ${DIRECTION}\r\nCLS\r\n`),
    ascii(`BITMAP 0,0,${rowBytes},${H},0,`),
    bitmap,
    ascii(`\r\nPRINT 1,${copies}\r\n`),
  ])
}

function ascii(text: string) {
  return new TextEncoder().encode(text)
}

function concat(parts: Uint8Array[]) {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0))
  let offset = 0
  for (const p of parts) {
    out.set(p, offset)
    offset += p.length
  }
  return out
}
