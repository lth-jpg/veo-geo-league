import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getMonthRange, calcMonthlyAverage } from '@/lib/utils'
import { getEffectiveDateISO, isoToMonthRange } from '@/lib/date-utils'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const year = searchParams.get('year') ? parseInt(searchParams.get('year')!) : undefined
  const month = searchParams.get('month') ? parseInt(searchParams.get('month')!) : undefined

  let start: Date, end: Date, configYear: number, configMonth: number
  if (year !== undefined && month !== undefined) {
    const range = getMonthRange(year, month)
    start = range.start; end = range.end
    configYear = year; configMonth = month
  } else {
    const range = isoToMonthRange(await getEffectiveDateISO())
    start = range.start; end = range.end
    configYear = start.getFullYear(); configMonth = start.getMonth()
  }

  const config = await prisma.leagueConfig.findUnique({
    where: { year_month: { year: configYear, month: configMonth } },
  })
  const scoreCount = config?.scoreCount ?? 15
  const doubleDayDate = config?.doubleDayDate ?? null

  // Fetch all scores for the month with player info
  const allScores = await prisma.score.findMany({
    where: { date: { gte: start, lte: end } },
    include: { player: true },
    orderBy: { date: 'asc' },
  })

  // Get all distinct days that have scores (as YYYY-MM-DD)
  const daySet = new Set<string>()
  for (const s of allScores) {
    const d = s.date
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    daySet.add(iso)
  }
  const days = Array.from(daySet).sort()

  if (days.length === 0) {
    return NextResponse.json({ days: [], players: [], scoreCount })
  }

  // Group scores by player
  const playerMap = new Map<number, { id: number; name: string; countryFlag: string; scores: { dayISO: string; total: number; isDoubleDay: boolean }[] }>()
  for (const s of allScores) {
    const d = s.date
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    const isDoubleDay = doubleDayDate !== null && iso === doubleDayDate

    if (!playerMap.has(s.playerId)) {
      playerMap.set(s.playerId, {
        id: s.player.id,
        name: s.player.name,
        countryFlag: s.player.countryFlag,
        scores: [],
      })
    }
    playerMap.get(s.playerId)!.scores.push({ dayISO: iso, total: s.total, isDoubleDay })
  }

  // For each player compute cumulative daily average at each day
  const players = Array.from(playerMap.values()).map(p => {
    const averages: (number | null)[] = []
    const cumulative: { total: number; isDoubleDay: boolean }[] = []

    for (const day of days) {
      const dayScores = p.scores.filter(s => s.dayISO === day)
      cumulative.push(...dayScores)

      if (cumulative.length === 0) {
        averages.push(null)
      } else {
        averages.push(calcMonthlyAverage(cumulative, scoreCount))
      }
    }

    return {
      id: p.id,
      name: p.name,
      countryFlag: p.countryFlag,
      averages,
    }
  })

  // Sort players by their latest (last day) average descending
  players.sort((a, b) => {
    const aLast = a.averages.findLast(v => v !== null) ?? 0
    const bLast = b.averages.findLast(v => v !== null) ?? 0
    return bLast - aLast
  })

  return NextResponse.json({ days, players, scoreCount })
}
