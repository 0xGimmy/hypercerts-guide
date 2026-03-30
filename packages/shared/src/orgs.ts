import type { Organization } from './types.js'

export const organizations: Organization[] = [
  {
    name: 'Asia Generative Art Exhibition dialog( )',
    nameZh: '亞洲生成藝術聯展 dialog( )',
    wallet: '0x20BC3EF37BFC8Ae3E3eD260161bbd9011E8D41A1',
    slug: 'dialog',
  },
  {
    name: 'Right Plus',
    nameZh: '多多益善',
    wallet: '0xab51AD23d222fD0afB4e29F3244402af9aa3C420',
    slug: 'right-plus',
  },
  {
    name: 'Halo Choir',
    nameZh: '微光合唱團',
    wallet: '0xc05b1996a6485A711bbAD2020224623f5354f14F',
    slug: 'halo-choir',
  },
]

export function getOrgByWallet(wallet: string): Organization | undefined {
  return organizations.find(
    (o) => o.wallet.toLowerCase() === wallet.toLowerCase(),
  )
}

export function getOrgBySlug(slug: string): Organization | undefined {
  return organizations.find((o) => o.slug === slug)
}
