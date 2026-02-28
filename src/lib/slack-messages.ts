import { prisma } from '@/lib/prisma'
import { getMonthRange, getTodayRange, calcMonthlyAverage } from '@/lib/utils'
import { veoHeader, veoSection, veoContext, veoDivider } from '@/lib/slack'
import { morningOpener, winnerLine, loserLine, closeRaceLine, perfectLine, fullTurnoutLine, soloLine } from '@/lib/commentary'

const MEDALS = ['🥇', '🥈', '🥉']

// Rough Danish summer time check (last Sunday of March → last Sunday of October)
function isDanishSummerTime(date: Date): boolean {
  const month = date.getUTCMonth()
  if (month < 2 || month > 9) return false
  if (month > 2 && month < 9) return true
  const lastSunday = getLastSunday(date.getUTCFullYear(), month)
  if (month === 2) return date.getUTCDate() >= lastSunday
  if (month === 9) return date.getUTCDate() < lastSunday
  return false
}

function getLastSunday(year: number, month: number): number {
  const d = new Date(Date.UTC(year, month + 1, 0))
  d.setUTCDate(d.getUTCDate() - d.getUTCDay())
  return d.getUTCDate()
}

export async function buildMorningMessage(customNote?: string) {
  const { start, end } = getMonthRange()
  const players = await prisma.player.findMany({
    include: { scores: { where: { date: { gte: start, lte: end } }, select: { total: true } } },
  })

  const standings = players
    .map(p => ({
      name: p.name,
      flag: p.countryFlag,
      avg: calcMonthlyAverage(p.scores.map(s => s.total)),
      games: p.scores.length,
    }))
    .filter(p => p.games > 0)
    .sort((a, b) => b.avg - a.avg)

  const top3 = standings.slice(0, 3)
  const appUrl = process.env.APP_URL ?? ''

  const nowUtc = new Date()
  const danishOffsetHours = isDanishSummerTime(nowUtc) ? 2 : 1
  const danishHour = (nowUtc.getUTCHours() + danishOffsetHours) % 24
  const hoursUntil2pm = ((14 - danishHour) + 24) % 24
  const minutesUntil = hoursUntil2pm * 60 - nowUtc.getUTCMinutes()
  const hoursLeft = Math.floor(minutesUntil / 60)
  const minsLeft = minutesUntil % 60

  const countdownText = hoursLeft > 0
    ? `${hoursLeft}h ${minsLeft}m to go`
    : `${minsLeft} minutes to go`

  const opener = morningOpener()
  const standingsText = top3.length > 0
    ? '*Monthly Standings*\n' + top3.map((p, i) =>
        `${MEDALS[i]} ${p.flag} *${p.name}* — avg ${p.avg.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`
      ).join('\n')
    : null

  const blocks = [
    veoHeader('⛳ VEO GEO LEAGUE — Morning Briefing'),
    ...(customNote ? [veoSection(`📌 ${customNote}`)] : []),
    veoSection(opener),
    veoDivider(),
    veoSection(`*Scores close at 14:00* — ${countdownText}`),
    ...(standingsText ? [veoSection(standingsText)] : []),
    veoDivider(),
    veoContext(appUrl ? `Submit at ${appUrl}` : 'Submit your score at 14:00'),
  ]

  const fallbackText = `⛳ VEO GEO LEAGUE — Scores close at 14:00. ${countdownText}.`

  const previewLines = [
    '⛳ VEO GEO LEAGUE — Morning Briefing',
    ...(customNote ? [`📌 ${customNote}`] : []),
    '─────────────────',
    opener,
    '─────────────────',
    `Scores close at 14:00 — ${countdownText}`,
    ...(standingsText
      ? ['', 'Monthly Standings:', ...top3.map((p, i) =>
          `  ${MEDALS[i]} ${p.flag} ${p.name} — avg ${p.avg.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`
        )]
      : ['(no standings yet this month)']),
    '─────────────────',
    appUrl ? `Submit at ${appUrl}` : 'Submit your score at 14:00',
  ]

  return { blocks, fallbackText, previewLines }
}

export async function buildSummaryMessage(customNote?: string) {
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
    const blocks = [
      veoHeader('⛳ VEO GEO LEAGUE — Daily Wrap'),
      ...(customNote ? [veoSection(`📌 ${customNote}`)] : []),
      veoSection('No scores submitted today. The league took the day off. 🛋️'),
    ]
    const previewLines = [
      '⛳ VEO GEO LEAGUE — Daily Wrap',
      ...(customNote ? [`📌 ${customNote}`] : []),
      '─────────────────',
      'No scores submitted today. The league took the day off. 🛋️',
    ]
    return {
      blocks,
      fallbackText: '⛳ VEO GEO LEAGUE — No scores today.',
      previewLines,
    }
  }

  const { start: mStart, end: mEnd } = getMonthRange()
  const players = await prisma.player.findMany({
    include: { scores: { where: { date: { gte: mStart, lte: mEnd } }, select: { total: true } } },
  })
  const monthlyStandings = players
    .map(p => ({
      name: p.name,
      flag: p.countryFlag,
      avg: calcMonthlyAverage(p.scores.map(s => s.total)),
      games: p.scores.length,
    }))
    .filter(p => p.games > 0)
    .sort((a, b) => b.avg - a.avg)

  const monthlyLeader = monthlyStandings[0]

  const scoreLines = todayScores.map((score, i) => {
    const medal = MEDALS[i] ?? `${i + 1}.`
    const redCardBadge = score.redCards.length > 0 ? ` 🟥×${score.redCards.length}` : ''
    const perfect = score.total === 15000 ? ' ✨' : ''
    return `${medal} ${score.player.countryFlag} *${score.player.name}* — ${score.total.toLocaleString()}${redCardBadge}${perfect}`
  })

  const highlights: string[] = []
  const top = todayScores[0]
  const bottom = todayScores[todayScores.length - 1]

  if (top.total === 15000) {
    highlights.push(`✨ ${perfectLine(top.player.name)}`)
  } else {
    highlights.push(`🏆 ${winnerLine(top.player.name)}`)
  }

  if (todayScores.length > 1) {
    highlights.push(`💀 ${loserLine(bottom.player.name, bottom.total)}`)
  }

  if (todayScores.length >= 2) {
    const gap = todayScores[0].total - todayScores[1].total
    if (gap < 200) {
      highlights.push(`⚡ ${closeRaceLine(todayScores[0].player.name, todayScores[1].player.name, gap)}`)
    }
  }

  for (const score of todayScores) {
    for (const rc of score.redCards) {
      const reasonText = rc.reason ? ` Reason: "${rc.reason}"` : ''
      highlights.push(`🟥 ${rc.givenBy.countryFlag} ${rc.givenBy.name} carded ${score.player.countryFlag} ${score.player.name}.${reasonText}`)
    }
  }

  const totalPlayers = await prisma.player.count()
  if (todayScores.length === 1) {
    highlights.push(`👤 ${soloLine(top.player.name)}`)
  } else if (todayScores.length === totalPlayers) {
    highlights.push(`✅ ${fullTurnoutLine(todayScores.length)}`)
  }

  if (monthlyLeader) {
    const avg = monthlyLeader.avg.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
    highlights.push(`👑 Monthly leader: ${monthlyLeader.flag} *${monthlyLeader.name}* (avg ${avg})`)
  }

  const blocks = [
    veoHeader('⛳ VEO GEO LEAGUE — Daily Wrap'),
    ...(customNote ? [veoSection(`📌 ${customNote}`)] : []),
    veoDivider(),
    veoSection("*Today's Scores*\n" + scoreLines.join('\n')),
    veoDivider(),
    veoSection('*Highlights*\n' + highlights.map(h => `• ${h}`).join('\n')),
    veoDivider(),
    veoContext(`${new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })} • VEO GEO LEAGUE`),
  ]

  const fallbackText = `⛳ Daily Wrap — Top: ${top.player.name} ${top.total.toLocaleString()} | Bottom: ${bottom.player.name} ${bottom.total.toLocaleString()}`

  const previewLines = [
    '⛳ VEO GEO LEAGUE — Daily Wrap',
    ...(customNote ? [`📌 ${customNote}`] : []),
    '─────────────────',
    "Today's Scores:",
    ...scoreLines.map(l => `  ${l.replace(/\*/g, '')}`),
    '─────────────────',
    'Highlights:',
    ...highlights.map(h => `  • ${h}`),
    '─────────────────',
    new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' }) + ' • VEO GEO LEAGUE',
  ]

  return { blocks, fallbackText, previewLines }
}
