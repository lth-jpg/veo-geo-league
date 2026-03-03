import { prisma } from './prisma'

/**
 * Returns the effective "today" as YYYY-MM-DD.
 * Uses simulatedDate from AppSettings when set; falls back to real date.
 */
export async function getEffectiveDateISO(): Promise<string> {
  const now = new Date()
  const realISO = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`

  try {
    const settings = await prisma.appSettings.findUnique({ where: { id: 1 } })
    if (settings?.simulatedDate) {
      // Auto-clear the simulated date once the real calendar day has moved past it
      if (settings.simulatedDate < realISO) {
        await prisma.appSettings.update({ where: { id: 1 }, data: { simulatedDate: null } })
      } else {
        return settings.simulatedDate
      }
    }
  } catch {
    // AppSettings table may not exist yet on fresh deploy — fall through to real date
  }

  return realISO
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
