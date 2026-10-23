import { describe, expect, it } from 'vitest'
import { fromIdCard, readIdCard } from './idCard'

describe('fromIdCard', () => {
  it('maps the sample card to patient fields', async () => {
    const f = fromIdCard(await readIdCard())
    expect(f).toMatchObject({
      citizenId: '1103700123458',
      prefix: 'นาย',
      firstNameTh: 'สมชาย',
      lastNameTh: 'ใจดี',
      prefixEn: 'Mr.',
      firstNameEn: 'Somchai',
      sex: 'Male',
      birthDate: '1987-01-15',
      address: '123 หมู่ที่ 4 ซอยสุขใจ ถนนสีลม',
      subdistrict: 'บางรัก',
      district: 'บางรัก',
      province: 'กรุงเทพมหานคร',
      cardExpiryDate: '2030-01-14',
    })
  })

  it('handles a middle name, provincial address, unknown birth day and lifelong card', () => {
    const f = fromIdCard({
      cid: '1103700123458',
      nameTh: 'นางสาว#มณี#ศรี#สุข',
      nameEn: '',
      birthDate: '25200000',
      gender: '2',
      issuer: '',
      issueDate: '25600101',
      expiryDate: '99999999',
      address: '9#ตำบลในเมือง#อำเภอเมืองเชียงใหม่#จังหวัดเชียงใหม่',
      photo: null,
    })
    expect(f).toMatchObject({
      firstNameTh: 'มณี ศรี',
      firstNameEn: null,
      sex: 'Female',
      birthDate: '1977-01-01',
      cardExpiryDate: null,
      address: '9',
      subdistrict: 'ในเมือง',
      district: 'เมืองเชียงใหม่',
      province: 'เชียงใหม่',
      cardIssuer: null,
    })
  })
})
