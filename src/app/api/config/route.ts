import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getTodayISODate } from '@/lib/utils'

export const dynamic = 'force-dynamic'

export async function GET() {
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth()

  const config = await prisma.leagueConfig.findUnique({ where: { year_month: { year, month } } })

  const today = getTodayISODate()
  const activeDays: string[] = config ? JSON.parse(config.activeDays) : []
  const scoreCount = config?.scoreCount ?? 15
  const doubleDayDate = config?.doubleDayDate ?? null
  const isDoubleDay = doubleDayDate === today

  const daysRemaining = activeDays.length > 0
    ? activeDays.filter(d => d >= today).length
    : null

  return NextResponse.json({
    isDoubleDay,
    activeDays,
    scoreCount,
    daysRemaining,
    totalActiveDays: activeDays.length,
  })
}
