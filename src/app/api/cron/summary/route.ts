import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getTodayRange, getMonthRange, calcMonthlyAverage } from '@/lib/utils'
import { postToSlack, veoHeader, veoSection, veoContext, veoDivider } from '@/lib/slack'
import {
  winnerLine, loserLine, closeRaceLine, perfectLine,
  fullTurnoutLine, soloLine,
} from '@/lib/commentary'

export const dynamic = 'force-dynamic'

function checkSecret(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return true
  const auth = req.headers.get('authorization')
  return auth === `Bearer ${secret}`
}

const MEDALS = ['🥇', '🥈', '🥉']

export async function POST(req: NextRequest) {
  if (!checkSecret(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Only run Mon–Fri (0=Sun, 6=Sat in UTC)
  const dayOfWeek = new Date().getUTCDay()
  if (dayOfWeek === 0 || dayOfWeek === 6) {
    return NextResponse.json({ ok: true, skipped: 'weekend' })
  }

  // ── Fetch today's scores ──────────────────────────────────────────────────
  const { start, end } = getTodayRange()
  const todayScores = await prisma.score.findMany({
    where: { date: { gte: start, lte: end } },
    include: {
      player: true,
      redCards: { include: { givenBy: true } },
    },
    orderBy: { total: 'desc' },
  })

  if (todayScores.length === 0) {
    await postToSlack(
      [veoHeader('⛳ VEO GEO LEAGUE — Daily Wrap'), veoSection('No scores submitted today. The league took the day off. 🛋️')],
      '⛳ VEO GEO LEAGUE — No scores today.'
    )
    return NextResponse.json({ ok: true, scores: 0 })
  }

  // ── Fetch monthly standings ───────────────────────────────────────────────
  const { start: mStart, end: mEnd } = getMonthRange()
  const players = await prisma.player.findMany({
    include: { scores: { where: { date: { gte: mStart, lte: mEnd } }, select: { total: true } } },
  })
  const monthlyStandings = players
    .map(p => ({
      id: p.id,
      name: p.name,
      flag: p.countryFlag,
      avg: calcMonthlyAverage(p.scores.map(s => s.total)),
      games: p.scores.length,
    }))
    .filter(p => p.games > 0)
    .sort((a, b) => b.avg - a.avg)

  const monthlyLeader = monthlyStandings[0]

  // ── Build score lines ────────────────────────────────────────────────────
  const scoreLines = todayScores.map((score, i) => {
    const medal = MEDALS[i] ?? `${i + 1}.`
    const redCardBadge = score.redCards.length > 0 ? ` 🟥×${score.redCards.length}` : ''
    const perfect = score.total === 15000 ? ' ✨' : ''
    return `${medal} ${score.player.countryFlag} *${score.player.name}* — ${score.total.toLocaleString()}${redCardBadge}${perfect}`
  })

  // ── Highlights ───────────────────────────────────────────────────────────
  const highlights: string[] = []

  const top = todayScores[0]
  const bottom = todayScores[todayScores.length - 1]

  // Perfect score
  if (top.total === 15000) {
    highlights.push(`✨ ${perfectLine(top.player.name)}`)
  } else {
    highlights.push(`🏆 ${winnerLine(top.player.name)}`)
  }

  // Loser note (only if more than 1 player)
  if (todayScores.length > 1) {
    highlights.push(`💀 ${loserLine(bottom.player.name, bottom.total)}`)
  }

  // Close race at the top (gap < 200 between 1st and 2nd)
  if (todayScores.length >= 2) {
    const gap = todayScores[0].total - todayScores[1].total
    if (gap < 200) {
      highlights.push(`⚡ ${closeRaceLine(todayScores[0].player.name, todayScores[1].player.name, gap)}`)
    }
  }

  // Red cards
  for (const score of todayScores) {
    for (const rc of score.redCards) {
      const reasonText = rc.reason ? ` Reason: _"${rc.reason}"_` : ''
      highlights.push(`🟥 ${rc.givenBy.countryFlag} ${rc.givenBy.name} carded ${score.player.countryFlag} ${score.player.name}.${reasonText}`)
    }
  }

  // Turnout
  const totalPlayers = (await prisma.player.count())
  if (todayScores.length === 1) {
    highlights.push(`👤 ${soloLine(top.player.name)}`)
  } else if (todayScores.length === totalPlayers) {
    highlights.push(`✅ ${fullTurnoutLine(todayScores.length)}`)
  }

  // Monthly leader callout
  if (monthlyLeader) {
    const avg = monthlyLeader.avg.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
    highlights.push(`👑 Monthly leader: ${monthlyLeader.flag} *${monthlyLeader.name}* (avg ${avg})`)
  }

  // ── Assemble Slack message ────────────────────────────────────────────────
  const blocks = [
    veoHeader('⛳ VEO GEO LEAGUE — Daily Wrap'),
    veoDivider(),
    veoSection("*Today's Scores*\n" + scoreLines.join('\n')),
    veoDivider(),
    veoSection('*Highlights*\n' + highlights.map(h => `• ${h}`).join('\n')),
    veoDivider(),
    veoContext(`${new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })} • VEO GEO LEAGUE`),
  ]

  const fallback = `⛳ Daily Wrap — Top: ${top.player.name} ${top.total.toLocaleString()} | Bottom: ${bottom.player.name} ${bottom.total.toLocaleString()}`
  await postToSlack(blocks, fallback)

  return NextResponse.json({ ok: true, scores: todayScores.length })
}
