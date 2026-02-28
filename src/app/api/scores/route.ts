import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getTodayRange, getMonthRange, calcMonthlyAverage, getTodayISODate } from '@/lib/utils'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const dateStr = searchParams.get('date')
  const playerId = searchParams.get('playerId')
  const monthMode = searchParams.get('month') === 'true'

  let where: Record<string, unknown> = {}

  if (monthMode) {
    const { start, end } = getMonthRange()
    where.date = { gte: start, lte: end }
  } else if (dateStr) {
    const d = new Date(dateStr)
    const start = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0)
    const end = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999)
    where.date = { gte: start, lte: end }
  } else {
    const { start, end } = getTodayRange()
    where.date = { gte: start, lte: end }
  }

  if (playerId) where.playerId = parseInt(playerId)

  const orderBy = monthMode
    ? [{ date: 'desc' as const }, { total: 'desc' as const }]
    : [{ total: 'desc' as const }]

  const scores = await prisma.score.findMany({
    where,
    include: {
      player: true,
      redCards: { include: { givenBy: true } },
      comments: { orderBy: { createdAt: 'asc' } },
      _count: { select: { redCards: true } },
    },
    orderBy,
  })
  return NextResponse.json(scores)
}

async function calcLeaderboardRanks(scoreCount = 15): Promise<Map<number, number>> {
  const { start, end } = getMonthRange()
  const players = await prisma.player.findMany({
    include: {
      scores: {
        where: { date: { gte: start, lte: end } },
        select: { total: true, isDoubleDay: true },
      },
    },
  })
  const ranked = players
    .map(p => ({
      id: p.id,
      avg: calcMonthlyAverage(p.scores, scoreCount),
    }))
    .sort((a, b) => b.avg - a.avg)

  const rankMap = new Map<number, number>()
  ranked.forEach((p, i) => rankMap.set(p.id, i + 1))
  return rankMap
}

export async function POST(req: NextRequest) {
  const { playerId, round1, round2, round3 } = await req.json()
  if (!playerId) return NextResponse.json({ error: 'Player required' }, { status: 400 })

  const r1 = Math.min(Math.max(parseInt(round1) || 0, 0), 5000)
  const r2 = Math.min(Math.max(parseInt(round2) || 0, 0), 5000)
  const r3 = Math.min(Math.max(parseInt(round3) || 0, 0), 5000)
  const total = r1 + r2 + r3

  const today = new Date()
  const dateOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 12, 0, 0, 0)
  const todayISO = getTodayISODate()

  // Load league config for current month
  const config = await prisma.leagueConfig.findUnique({
    where: { year_month: { year: today.getFullYear(), month: today.getMonth() } },
  })

  const activeDays: string[] = config ? JSON.parse(config.activeDays) : []
  const scoreCount = config?.scoreCount ?? 15

  // Enforce active days: block submission if not in the configured active days
  if (activeDays.length > 0 && !activeDays.includes(todayISO)) {
    return NextResponse.json({ error: 'Scores are not open today' }, { status: 400 })
  }

  // Check if today is a double-points day
  const isDoubleDay = config?.doubleDayDate === todayISO

  try {
    const ranksBefore = await calcLeaderboardRanks(scoreCount)
    const rankBefore = ranksBefore.get(parseInt(playerId)) ?? null

    const score = await prisma.score.upsert({
      where: { playerId_date: { playerId: parseInt(playerId), date: dateOnly } },
      create: { playerId: parseInt(playerId), round1: r1, round2: r2, round3: r3, total, date: dateOnly, isDoubleDay },
      update: { round1: r1, round2: r2, round3: r3, total, isDoubleDay },
      include: { player: true },
    })

    const ranksAfter = await calcLeaderboardRanks(scoreCount)
    const rankAfter = ranksAfter.get(parseInt(playerId)) ?? null

    let positionChange: number | null = null
    if (rankBefore !== null && rankAfter !== null) {
      positionChange = rankBefore - rankAfter
    }

    if (positionChange !== null) {
      await prisma.score.update({ where: { id: score.id }, data: { positionChange } })
    }

    if (total < 6000) {
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000)
      await prisma.breakingNews.create({
        data: {
          type: 'shame',
          message: `SHAME: ${score.player.countryFlag} ${score.player.name} just posted a sub-6000 disaster! 🤡`,
          playerId: parseInt(playerId),
          expiresAt,
        },
      })
    }

    if (rankAfter === 1 && (rankBefore === null || rankBefore > 1)) {
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000)
      await prisma.breakingNews.create({
        data: {
          type: 'takeover',
          message: `BREAKING: ${score.player.countryFlag} ${score.player.name} has taken the League Lead! 👑`,
          playerId: parseInt(playerId),
          expiresAt,
        },
      })
    }

    return NextResponse.json({ ...score, positionChange })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
