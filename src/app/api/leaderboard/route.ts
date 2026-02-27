import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getMonthRange, calcMonthlyAverage } from '@/lib/utils'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const year = searchParams.get('year') ? parseInt(searchParams.get('year')!) : undefined
  const month = searchParams.get('month') ? parseInt(searchParams.get('month')!) : undefined

  const { start, end } = getMonthRange(year, month)

  // Get all players
  const players = await prisma.player.findMany({
    include: {
      scores: {
        where: { date: { gte: start, lte: end } },
        orderBy: { total: 'desc' },
      },
      redCardsReceived: {
        where: { date: { gte: start, lte: end } },
      },
    },
  })

  // Find MVP (highest single daily total this month)
  let mvpPlayerId: number | null = null
  let mvpScore = -1
  for (const p of players) {
    for (const s of p.scores) {
      if (s.total > mvpScore) {
        mvpScore = s.total
        mvpPlayerId = p.id
      }
    }
  }

  const standings = players
    .map((p) => {
      const totals = p.scores.map((s) => s.total)
      const avg = calcMonthlyAverage(totals)
      const top15Sum = [...totals].sort((a, b) => b - a).slice(0, 15).reduce((a, b) => a + b, 0)
      const bestScore = totals.length > 0 ? Math.max(...totals) : 0
      return {
        id: p.id,
        name: p.name,
        countryFlag: p.countryFlag,
        monthlyAverage: avg,
        top15Sum,
        gamesPlayed: totals.length,
        bestScore,
        redCardCount: p.redCardsReceived.length,
        isMvp: p.id === mvpPlayerId && mvpScore > 0,
      }
    })
    .sort((a, b) => b.monthlyAverage - a.monthlyAverage)

  return NextResponse.json({ standings, month: start.getMonth(), year: start.getFullYear() })
}
