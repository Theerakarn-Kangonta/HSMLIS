// Silent printing through QZ Tray, a small program installed on each lab PC (printing/setup-printing.bat).
// The API signs every request with the lab's private key; QZ Tray trusts the matching certificate
// (its override.crt), so it prints straight away without asking the user.
import * as qz from 'qz-tray'
import { api } from './api'

/** Why printing through QZ Tray did not work, for a translated message. */
export class QzError extends Error {
  readonly reason: 'not_running' | 'no_printers'

  constructor(reason: 'not_running' | 'no_printers') {
    super(reason)
    this.reason = reason
  }
}

const PRINTER_KEY = 'hsmlis.labelPrinter'
/** The label printer is picked by this name the first time, until someone chooses one. */
const PRINTER_HINT = 'tsc'

let certificate: string | null = null
/** QZ Tray hides why signing failed ("Failed to sign request"); this keeps the API's error. */
let signingError: unknown = null
let connecting: Promise<void> | null = null

qz.security.setSignatureAlgorithm('SHA512')
qz.security.setCertificatePromise((resolve) => resolve(certificate ?? undefined))
qz.security.setSignaturePromise((toSign) => (resolve, reject) => {
  api
    .qzSign(toSign)
    .then((r) => resolve(r.signature))
    .catch((e: unknown) => {
      signingError = e
      reject(String(e))
    })
})

async function connect() {
  if (qz.websocket.isActive()) return
  // Fetched first, so a server without the certificate shows its own error instead of QZ asking the user.
  certificate ??= (await api.qzCertificate()).certificate
  connecting ??= qz.websocket
    .connect({ host: 'localhost', retries: 0 })
    .catch(() => {
      throw new QzError('not_running')
    })
    .finally(() => {
      connecting = null
    })
  await connecting
}

/** Runs a signed QZ call and reports the API's error when the signature was refused. */
async function signed<T>(call: () => Promise<T>): Promise<T> {
  await connect()
  signingError = null
  try {
    return await call()
  } catch (e) {
    throw signingError ?? e
  }
}

export function savedPrinter(): string | null {
  try {
    return localStorage.getItem(PRINTER_KEY)
  } catch {
    return null
  }
}

export function savePrinter(name: string | null) {
  try {
    if (name) localStorage.setItem(PRINTER_KEY, name)
    else localStorage.removeItem(PRINTER_KEY)
  } catch {
    // Private window: the choice lasts until the page closes.
  }
}

/** Every printer this PC has. */
export async function listPrinters(): Promise<string[]> {
  const found = await signed(() => qz.printers.find())
  const printers = Array.isArray(found) ? found : [found]
  if (printers.length === 0) throw new QzError('no_printers')
  return printers
}

/** The printer chosen on this PC before, else the first TSC printer; null when someone has to choose. */
export async function findLabelPrinter(): Promise<{ printer: string | null; printers: string[] }> {
  const printers = await listPrinters()
  const saved = savedPrinter()
  const printer = (saved && printers.includes(saved) ? saved : null) ?? printers.find((p) => p.toLowerCase().includes(PRINTER_HINT)) ?? null
  return { printer, printers }
}

/** Sends printer commands (TSPL) as they are, base64 so the bitmap bytes arrive unchanged. */
export async function printRaw(printer: string, commands: Uint8Array) {
  await signed(() => qz.print(qz.configs.create(printer), [{ type: 'raw', format: 'command', flavor: 'base64', data: toBase64(commands) }]))
}

function toBase64(bytes: Uint8Array) {
  let binary = ''
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(binary)
}
