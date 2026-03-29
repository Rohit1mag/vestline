export type GrantType = 'iso' | 'nso' | 'rsu' | 'common'

export interface EquityGrant {
  id: string
  stakeholderId: string
  label: string
  grantType: GrantType
  shares: number
  startDate: string // ISO date
  cliffMonths: number
  vestingMonths: number
  notes?: string
}

export interface Stakeholder {
  id: string
  name: string
  role: string
  email?: string
}

export interface Company {
  name: string
  totalAuthorizedShares?: number
}

export interface AppData {
  company: Company
  stakeholders: Stakeholder[]
  grants: EquityGrant[]
}

export interface VestingMonthRow {
  monthIndex: number
  dateLabel: string
  cumulativeVested: number
  vestedThisMonth: number
  percentVested: number
}
