import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { calcMonthlyAverage } from '@/lib/utils'
import { getEffectiveDateISO, isoToDateRange, isoToMonthRange } from '@/lib/date-utils'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const dateStr = searchParams.get('date')
  const playerId = searchParams.get('playerId')
  const monthMode = searchParams.get('month') === 'true'

  let where: Record<string, unknown> = {}

  if (monthMode) {
    const { start, end } = isoToMonthRange(await getEffectiveDateISO())
    where.date = { gte: start, lte: end }
  } else if (dateStr) {
    const d = new Date(dateStr)
    const start = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0)
    const end = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999)
    where.date = { gte: start, lte: end }
  } else {
    const { start, end } = isoToDateRange(await getEffectiveDateISO())
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

async function calcLeaderboardRanks(scoreCount = 15, todayISO: string): Promise<Map<number, number>> {
  const { start, end } = isoToMonthRange(todayISO)
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

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const scoreId = searchParams.get('id')
  const adminName = searchParams.get('adminName')

  if (adminName?.toLowerCase() !== 'leo') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }
  if (!scoreId) {
    return NextResponse.json({ error: 'Score ID required' }, { status: 400 })
  }

  try {
    // Delete dependent records first (no cascade in schema)
    await prisma.comment.deleteMany({ where: { scoreId: parseInt(scoreId) } })
    await prisma.redCard.deleteMany({ where: { scoreId: parseInt(scoreId) } })
    await prisma.score.delete({ where: { id: parseInt(scoreId) } })
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const { playerId, round1, round2, round3 } = await req.json()
  if (!playerId) return NextResponse.json({ error: 'Player required' }, { status: 400 })

  const r1 = Math.min(Math.max(parseInt(round1) || 0, 0), 5000)
  const r2 = Math.min(Math.max(parseInt(round2) || 0, 0), 5000)
  const r3 = Math.min(Math.max(parseInt(round3) || 0, 0), 5000)
  const total = r1 + r2 + r3

  const todayISO = await getEffectiveDateISO()
  const [y, m, d] = todayISO.split('-').map(Number)
  const dateOnly = new Date(y, m - 1, d, 12, 0, 0, 0)

  // Load league config for current month
  const config = await prisma.leagueConfig.findUnique({
    where: { year_month: { year: y, month: m - 1 } },
  })

  const activeDays: string[] = config ? JSON.parse(config.activeDays) : []
  const scoreCount = config?.scoreCount ?? 15

  // Enforce active days: block submission if not in the configured active days
  if (activeDays.length > 0 && !activeDays.includes(todayISO)) {
    return NextResponse.json({ error: 'Scores are not open today' }, { status: 400 })
  }

  // Check if today is a double-points day
  const isDoubleDay = config?.doubleDayDate === todayISO

  // If this is an update, preserve the existing isDoubleDay flag so clearing
  // double points mid-day doesn't retroactively remove it from earlier submissions
  const existing = await prisma.score.findUnique({
    where: { playerId_date: { playerId: parseInt(playerId), date: dateOnly } },
    select: { isDoubleDay: true },
  })
  const effectiveDoubleDay = isDoubleDay || (existing?.isDoubleDay ?? false)

  try {
    const ranksBefore = await calcLeaderboardRanks(scoreCount, todayISO)
    const rankBefore = ranksBefore.get(parseInt(playerId)) ?? null

    const score = await prisma.score.upsert({
      where: { playerId_date: { playerId: parseInt(playerId), date: dateOnly } },
      create: { playerId: parseInt(playerId), round1: r1, round2: r2, round3: r3, total, date: dateOnly, isDoubleDay: effectiveDoubleDay },
      update: { round1: r1, round2: r2, round3: r3, total, isDoubleDay: effectiveDoubleDay },
      include: { player: true },
    })

    const ranksAfter = await calcLeaderboardRanks(scoreCount, todayISO)
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
      // Remove any existing takeover banners — only one leader at a time
      await prisma.breakingNews.deleteMany({ where: { type: 'takeover' } })
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
