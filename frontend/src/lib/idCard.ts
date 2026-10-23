import type { PatientInput } from './api'
import { fromBuddhistYear } from './dates'

/**
 * What a Thai smart ID card chip returns, as the card's own text fields.
 * Names and the address are '#'-separated; dates are Buddhist-year YYYYMMDD; gender is '1' (male) or '2' (female).
 */
export type IdCardRaw = {
  cid: string
  nameTh: string // นาย#สมชาย#กลาง#ใจดี  (prefix#first#middle#last)
  nameEn: string // Mr.#Somchai#Klang#Jaidee
  birthDate: string // 25300115
  gender: string
  issuer: string
  issueDate: string
  expiryDate: string
  address: string // 123#หมู่ที่ 4#ซอยสุขใจ#ถนนสีลม#แขวงบางรัก#เขตบางรัก#กรุงเทพมหานคร
  photo: string | null // base64 JPEG, about 5 KB
}

export type IdCardFields = Pick<
  PatientInput,
  | 'citizenId' | 'prefix' | 'firstNameTh' | 'lastNameTh' | 'prefixEn' | 'firstNameEn' | 'lastNameEn' | 'sex' | 'birthDate'
  | 'nationality' | 'address' | 'subdistrict' | 'district' | 'province' | 'cardIssuer' | 'cardIssueDate' | 'cardExpiryDate'
>

/**
 * Reads the card in the reader. The single place to connect real hardware: replace the body with a call to the
 * local reader service and keep the return shape.
 * shortcut: returns a fixed sample card, until the card reader and its PC service are installed.
 */
export async function readIdCard(): Promise<IdCardRaw> {
  await new Promise((resolve) => setTimeout(resolve, 600))
  return {
    cid: '1103700123458',
    nameTh: 'นาย#สมชาย##ใจดี',
    nameEn: 'Mr.#Somchai##Jaidee',
    birthDate: '25300115',
    gender: '1',
    issuer: 'สำนักงานเขตบางรัก/กรุงเทพมหานคร',
    issueDate: '25650301',
    expiryDate: '25730114',
    address: '123#หมู่ที่ 4#ซอยสุขใจ#ถนนสีลม#แขวงบางรัก#เขตบางรัก#กรุงเทพมหานคร',
    photo: samplePhoto(),
  }
}

/** A grey head-and-shoulders outline in the card photo's size, standing in for the chip's photo. */
function samplePhoto(): string | null {
  const canvas = typeof document === 'undefined' ? null : document.createElement('canvas')
  const ctx = canvas?.getContext('2d')
  if (!canvas || !ctx) return null
  canvas.width = 297
  canvas.height = 356
  ctx.fillStyle = '#dbe4ef'
  ctx.fillRect(0, 0, 297, 356)
  ctx.fillStyle = '#8a9bb0'
  ctx.beginPath()
  ctx.arc(148, 140, 70, 0, Math.PI * 2)
  ctx.moveTo(18, 356)
  ctx.ellipse(148, 356, 130, 110, 0, Math.PI, 0)
  ctx.fill()
  return canvas.toDataURL('image/jpeg', 0.8).split(',')[1]
}

const clean = (s: string) => s.replace(/\s+/g, ' ').trim()
const orNull = (s: string) => clean(s) || null

/** Buddhist-year YYYYMMDD → ISO date. Cards may carry 00 for an unknown day or month, and 99999999 for "no expiry". */
function cardDate(s: string): string | null {
  const m = /^(\d{4})(\d{2})(\d{2})$/.exec(s.trim())
  if (!m || m[1] === '9999') return null
  return `${fromBuddhistYear(Number(m[1]))}-${m[2] === '00' ? '01' : m[2]}-${m[3] === '00' ? '01' : m[3]}`
}

function name(s: string) {
  const [prefix = '', first = '', middle = '', last = ''] = s.split('#')
  return { prefix: orNull(prefix), first: clean(`${first} ${middle}`), last: clean(last) }
}

/** Turns the card's fields into patient form fields. */
export function fromIdCard(raw: IdCardRaw): IdCardFields {
  const th = name(raw.nameTh)
  const en = name(raw.nameEn)
  const parts = raw.address.split('#').map(clean).filter(Boolean)
  // The last three parts are always sub-district, district and province.
  const [subdistrict = '', district = '', province = ''] = parts.slice(-3)
  return {
    citizenId: raw.cid.replace(/\D/g, '') || null,
    prefix: th.prefix,
    firstNameTh: th.first,
    lastNameTh: th.last,
    prefixEn: en.prefix,
    firstNameEn: en.first || null,
    lastNameEn: en.last || null,
    sex: raw.gender === '1' ? 'Male' : raw.gender === '2' ? 'Female' : 'Unknown',
    birthDate: cardDate(raw.birthDate),
    nationality: 'ไทย',
    address: orNull(parts.slice(0, -3).join(' ')),
    subdistrict: orNull(subdistrict.replace(/^(ตำบล|แขวง)/, '')),
    district: orNull(district.replace(/^(อำเภอ|เขต)/, '')),
    province: orNull(province.replace(/^จังหวัด/, '')),
    cardIssuer: orNull(raw.issuer),
    cardIssueDate: cardDate(raw.issueDate),
    cardExpiryDate: cardDate(raw.expiryDate),
  }
}
