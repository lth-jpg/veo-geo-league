import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getMonthRange, calcMonthlyAverage } from '@/lib/utils'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const year = searchParams.get('year') ? parseInt(searchParams.get('year')!) : undefined
  const month = searchParams.get('month') ? parseInt(searchParams.get('month')!) : undefined

  const { start, end } = getMonthRange(year, month)

  // Load scoreCount from config for current month (or archive month)
  const configYear = year ?? start.getFullYear()
  const configMonth = month ?? start.getMonth()
  const config = await prisma.leagueConfig.findUnique({
    where: { year_month: { year: configYear, month: configMonth } },
  })
  const scoreCount = config?.scoreCount ?? 15

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

  const last3ScoresPerPlayer = await prisma.score.findMany({
    where: {
      playerId: { in: players.map(p => p.id) },
      date: { gte: start, lte: end },
    },
    orderBy: { date: 'desc' },
  })

  const last3Map = new Map<number, number[]>()
  for (const s of last3ScoresPerPlayer) {
    const arr = last3Map.get(s.playerId) || []
    if (arr.length < 3) arr.push(s.total)
    last3Map.set(s.playerId, arr)
  }

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
      const scores = p.scores.map(s => ({ total: s.total, isDoubleDay: s.isDoubleDay }))
      const avg = calcMonthlyAverage(scores, scoreCount)
      const effectives = scores.map(s => s.isDoubleDay ? s.total * 2 : s.total)
      const topNSum = [...effectives].sort((a, b) => b - a).slice(0, scoreCount).reduce((a, b) => a + b, 0)
      const bestScore = scores.length > 0 ? Math.max(...scores.map(s => s.total)) : 0

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
        topNSum,
        gamesPlayed: scores.length,
        bestScore,
        redCardCount: p.redCardsReceived.length,
        isMvp: p.id === mvpPlayerId && mvpScore > 0,
        formStreak,
        scoreCount,
      }
    })
    .sort((a, b) => b.monthlyAverage - a.monthlyAverage)

  return NextResponse.json({ standings, month: start.getMonth(), year: start.getFullYear(), scoreCount })
}
