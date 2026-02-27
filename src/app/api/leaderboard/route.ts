import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getMonthRange, calcMonthlyAverage } from '@/lib/utils'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const year = searchParams.get('year') ? parseInt(searchParams.get('year')!) : undefined
  const month = searchParams.get('month') ? parseInt(searchParams.get('month')!) : undefined

  const { start, end } = getMonthRange(year, month)

  // Get all players with their scores for the month, plus last 3 scores overall for form
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

  // Fetch last 3 scores for each player (for form engine) - ordered by date desc
  const last3ScoresPerPlayer = await prisma.score.findMany({
    where: {
      playerId: { in: players.map(p => p.id) },
      date: { gte: start, lte: end },
    },
    orderBy: { date: 'desc' },
  })

  // Build map of playerId -> last 3 totals
  const last3Map = new Map<number, number[]>()
  for (const s of last3ScoresPerPlayer) {
    const arr = last3Map.get(s.playerId) || []
    if (arr.length < 3) arr.push(s.total)
    last3Map.set(s.playerId, arr)
  }

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

      // Form engine: last 3 games
      const last3 = last3Map.get(p.id) || []
      let formStreak: 'hot' | 'cold' | null = null
      if (last3.length >= 3) {
        if (last3.every(t => t > 14800)) formStreak = 'hot'
        else if (last3.every(t => t < 10000)) formStreak = 'cold'
      }

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
        formStreak,
      }
    })
    .sort((a, b) => b.monthlyAverage - a.monthlyAverage)

  return NextResponse.json({ standings, month: start.getMonth(), year: start.getFullYear() })
}
