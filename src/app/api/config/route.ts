import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getEffectiveDateISO, isoToMonthRange } from '@/lib/date-utils'

export const dynamic = 'force-dynamic'

export async function GET() {
  const todayISO = await getEffectiveDateISO()
  const { start } = isoToMonthRange(todayISO)
  const year = start.getFullYear()
  const month = start.getMonth()

  const config = await prisma.leagueConfig.findUnique({ where: { year_month: { year, month } } })

  const activeDays: string[] = config ? JSON.parse(config.activeDays) : []
  const scoreCount = config?.scoreCount ?? 15
  const doubleDayDate = config?.doubleDayDate ?? null
  const isDoubleDay = doubleDayDate === todayISO

  const daysRemaining = activeDays.length > 0
    ? activeDays.filter(d => d >= todayISO).length
    : null

  return NextResponse.json({
    effectiveDate: todayISO,
    isDoubleDay,
    activeDays,
    scoreCount,
    daysRemaining,
    totalActiveDays: activeDays.length,
  })
}
