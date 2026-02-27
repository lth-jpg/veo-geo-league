import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getTodayRange, getMonthRange, calcMonthlyAverage } from '@/lib/utils'
import { postToSlack, veoHeader, veoSection, veoContext } from '@/lib/slack'
import { shameLine, takeoverLine } from '@/lib/commentary'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const dateStr = searchParams.get('date')
  const playerId = searchParams.get('playerId')

  let where: Record<string, unknown> = {}

  if (dateStr) {
    const d = new Date(dateStr)
    const start = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0)
    const end = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999)
    where.date = { gte: start, lte: end }
  } else {
    const { start, end } = getTodayRange()
    where.date = { gte: start, lte: end }
  }

  if (playerId) where.playerId = parseInt(playerId)

  const scores = await prisma.score.findMany({
    where,
    include: {
      player: true,
      redCards: { include: { givenBy: true } },
      comments: { orderBy: { createdAt: 'asc' } },
      _count: { select: { redCards: true } },
    },
    orderBy: { total: 'desc' },
  })
  return NextResponse.json(scores)
}

async function calcLeaderboardRanks(): Promise<Map<number, number>> {
  const { start, end } = getMonthRange()
  const players = await prisma.player.findMany({
    include: {
      scores: {
        where: { date: { gte: start, lte: end } },
        select: { total: true },
      },
    },
  })
  const ranked = players
    .map(p => ({
      id: p.id,
      avg: calcMonthlyAverage(p.scores.map(s => s.total)),
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

  try {
    // Capture rank before submission
    const ranksBefore = await calcLeaderboardRanks()
    const rankBefore = ranksBefore.get(parseInt(playerId)) ?? null

    const score = await prisma.score.upsert({
      where: { playerId_date: { playerId: parseInt(playerId), date: dateOnly } },
      create: { playerId: parseInt(playerId), round1: r1, round2: r2, round3: r3, total, date: dateOnly },
      update: { round1: r1, round2: r2, round3: r3, total },
      include: { player: true },
    })

    // Capture rank after submission
    const ranksAfter = await calcLeaderboardRanks()
    const rankAfter = ranksAfter.get(parseInt(playerId)) ?? null

    // Calculate position change (positive = moved up in rankings = lower rank number)
    let positionChange: number | null = null
    if (rankBefore !== null && rankAfter !== null) {
      positionChange = rankBefore - rankAfter // positive = moved up (rank went from 3→1 = +2)
    }

    // Store position change on score
    if (positionChange !== null) {
      await prisma.score.update({
        where: { id: score.id },
        data: { positionChange },
      })
    }

    // Breaking news: check for shame trigger (sub-6000)
    if (total < 6000) {
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000) // 1 hour
      await prisma.breakingNews.create({
        data: {
          type: 'shame',
          message: `SHAME: ${score.player.countryFlag} ${score.player.name} just posted a sub-6000 disaster! 🤡`,
          playerId: parseInt(playerId),
          expiresAt,
        },
      })
      // Slack real-time shame ping
      await postToSlack(
        [
          veoHeader('🚨 DISASTER ALERT'),
          veoSection(shameLine(score.player.name, total)),
          veoContext(`${score.player.countryFlag} ${score.player.name} — ${total.toLocaleString()} pts`),
        ],
        `🚨 ${score.player.name} posted ${total.toLocaleString()}. That's rough.`
      )
    }

    // Breaking news: check for lead takeover trigger (moved to 1st place)
    if (rankAfter === 1 && (rankBefore === null || rankBefore > 1)) {
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000) // 1 hour
      await prisma.breakingNews.create({
        data: {
          type: 'takeover',
          message: `BREAKING: ${score.player.countryFlag} ${score.player.name} has taken the League Lead! 👑`,
          playerId: parseInt(playerId),
          expiresAt,
        },
      })
      // Slack real-time takeover ping
      await postToSlack(
        [
          veoHeader('👑 LEAD TAKEOVER'),
          veoSection(takeoverLine(score.player.name)),
          veoContext(`${score.player.countryFlag} ${score.player.name} — new monthly leader`),
        ],
        `👑 ${score.player.name} has taken the league lead!`
      )
    }

    return NextResponse.json({ ...score, positionChange })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
