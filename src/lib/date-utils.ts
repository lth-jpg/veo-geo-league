import { prisma } from './prisma'

/**
 * Returns the effective "today" as YYYY-MM-DD.
 * Uses simulatedDate from AppSettings when set; falls back to real date.
 */
export async function getEffectiveDateISO(): Promise<string> {
  const settings = await prisma.appSettings.findUnique({ where: { id: 1 } })
  if (settings?.simulatedDate) return settings.simulatedDate
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/** Full-day Date range for a given YYYY-MM-DD string. */
export function isoToDateRange(dateISO: string) {
  const [y, m, d] = dateISO.split('-').map(Number)
  return {
    start: new Date(y, m - 1, d, 0, 0, 0, 0),
    end:   new Date(y, m - 1, d, 23, 59, 59, 999),
  }
}

/** Full-month Date range derived from a YYYY-MM-DD string. */
export function isoToMonthRange(dateISO: string) {
  const [y, m] = dateISO.split('-').map(Number)
  return {
    start: new Date(y, m - 1, 1, 0, 0, 0, 0),
    end:   new Date(y, m,     0, 23, 59, 59, 999),
  }
}
