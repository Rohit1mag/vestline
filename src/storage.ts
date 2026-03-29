import { format, startOfMonth } from 'date-fns'
import { v4 as uuid } from 'uuid'
import type { AppData, EquityGrant, Stakeholder } from './types'

/** Used by LocalApp only (no Clerk). Not shared with cloud sync keys. */
const LEGACY_SINGLE_USER_KEY = 'vestline-app-v1'

export function userScopedStorageKey(clerkUserId: string): string {
  return `${LEGACY_SINGLE_USER_KEY}:clerk:${clerkUserId}`
}

export function isValidAppData(value: unknown): value is AppData {
  if (!value || typeof value !== 'object') return false
  const v = value as Record<string, unknown>
  if (!v.company || typeof v.company !== 'object') return false
  if (!Array.isArray(v.stakeholders) || !Array.isArray(v.grants)) return false
  return true
}

export function createDefaultData(): AppData {
  const s1: Stakeholder = {
    id: uuid(),
    name: 'Alex Rivera',
    role: 'Co-founder & CEO',
  }
  const s2: Stakeholder = {
    id: uuid(),
    name: 'Jordan Chen',
    role: 'Co-founder & CTO',
  }
  const grantStart = format(startOfMonth(new Date()), 'yyyy-MM-dd')
  const grants: EquityGrant[] = [
    {
      id: uuid(),
      stakeholderId: s1.id,
      label: 'Founder equity',
      grantType: 'common',
      shares: 3_500_000,
      startDate: grantStart,
      cliffMonths: 12,
      vestingMonths: 48,
    },
    {
      id: uuid(),
      stakeholderId: s2.id,
      label: 'Founder equity',
      grantType: 'common',
      shares: 3_500_000,
      startDate: grantStart,
      cliffMonths: 12,
      vestingMonths: 48,
    },
  ]
  return {
    company: { name: 'Acme Labs', totalAuthorizedShares: 10_000_000 },
    stakeholders: [s1, s2],
    grants,
  }
}

/** Read local cache without creating defaults (local-only mode / legacy key). */
export function readLocalAppData(): AppData | null {
  try {
    const raw = localStorage.getItem(LEGACY_SINGLE_USER_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as unknown
    if (!isValidAppData(parsed)) return null
    return parsed
  } catch {
    return null
  }
}

/** Per-Clerk-user cache so two accounts on the same browser never share state. */
export function readUserScopedAppData(clerkUserId: string): AppData | null {
  try {
    const raw = localStorage.getItem(userScopedStorageKey(clerkUserId))
    if (!raw) return null
    const parsed = JSON.parse(raw) as unknown
    if (!isValidAppData(parsed)) return null
    return parsed
  } catch {
    return null
  }
}

export function saveUserScopedAppData(clerkUserId: string, data: AppData): void {
  localStorage.setItem(userScopedStorageKey(clerkUserId), JSON.stringify(data))
}

export function loadAppData(): AppData {
  const existing = readLocalAppData()
  if (existing) return existing
  const fresh = createDefaultData()
  saveAppData(fresh)
  return fresh
}

export function saveAppData(data: AppData): void {
  localStorage.setItem(LEGACY_SINGLE_USER_KEY, JSON.stringify(data))
}

export function newStakeholder(partial: Omit<Stakeholder, 'id'>): Stakeholder {
  return { id: uuid(), ...partial }
}

export function newGrant(partial: Omit<EquityGrant, 'id'>): EquityGrant {
  return { id: uuid(), ...partial }
}
