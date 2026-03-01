import { NextRequest, NextResponse } from 'next/server'
import { postToSlack } from '@/lib/slack'
import { buildMorningMessage } from '@/lib/slack-messages'
import { getEffectiveDateISO } from '@/lib/date-utils'
import { prisma } from '@/lib/prisma'
import { getMonthRange, calcMonthlyAverage } from '@/lib/utils'

export const dynamic = 'force-dynamic'

function checkSecret(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return true // not configured — allow (dev mode)
  const auth = req.headers.get('authorization')
  return auth === `Bearer ${secret}`
}

/**
 * At the start of each new month, check if the previous month has a winner
 * that hasn't been recorded yet. If so, record them in MonthlyWin.
 */
async function maybeLockPreviousMonthWinner(todayISO: string) {
  const [y, m] = todayISO.split('-').map(Number)
  const todayDate = new Date(y, m - 1, 1) // first of current month

  // Previous month
  const prevDate = new Date(todayDate.getFullYear(), todayDate.getMonth() - 1, 1)
  const prevYear = prevDate.getFullYear()
  const prevMonth = prevDate.getMonth() // 0-indexed

  // Already recorded?
  const existing = await prisma.monthlyWin.findUnique({
    where: { year_month: { year: prevYear, month: prevMonth } },
  })
  if (existing) return

  // Get scores for the previous month
  const { start, end } = getMonthRange(prevYear, prevMonth)
  const config = await prisma.leagueConfig.findUnique({
    where: { year_month: { year: prevYear, month: prevMonth } },
  })
  const scoreCount = config?.scoreCount ?? 15

  const players = await prisma.player.findMany({
    include: {
      scores: {
        where: { date: { gte: start, lte: end } },
      },
    },
  })

  // Find winner (highest monthly average)
  let winner: { id: number; avg: number } | null = null
  for (const p of players) {
    if (p.scores.length === 0) continue
    const avg = calcMonthlyAverage(p.scores, scoreCount)
    if (!winner || avg > winner.avg) {
      winner = { id: p.id, avg }
    }
  }

  if (winner && winner.avg > 0) {
    await prisma.monthlyWin.create({
      data: {
        playerId: winner.id,
        year: prevYear,
        month: prevMonth,
        avgScore: winner.avg,
      },
    })
  }
}

export async function POST(req: NextRequest) {
  if (!checkSecret(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Only run Mon–Fri based on effective date (respects simulated date)
  const todayISO = await getEffectiveDateISO()
  const [y, m, d] = todayISO.split('-').map(Number)
  const dayOfWeek = new Date(y, m - 1, d).getDay() // 0=Sun, 6=Sat
  if (dayOfWeek === 0 || dayOfWeek === 6) {
    return NextResponse.json({ ok: true, skipped: 'weekend' })
  }

  // Check if we just entered a new month — lock previous month's winner
  await maybeLockPreviousMonthWinner(todayISO)

  const { blocks, fallbackText } = await buildMorningMessage()
  await postToSlack(blocks, fallbackText)

  return NextResponse.json({ ok: true })
}
