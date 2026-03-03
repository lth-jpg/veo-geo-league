import { prisma } from '@/lib/prisma'
import { calcMonthlyAverage } from '@/lib/utils'
import { veoHeader, veoSection, veoContext, veoDivider } from '@/lib/slack'
import { morningOpener, winnerLine, loserLine, closeRaceLine, perfectLine, fullTurnoutLine, soloLine, toiletLine, biggestGainerLine } from '@/lib/commentary'
import { getEffectiveDateISO, isoToDateRange, isoToMonthRange } from '@/lib/date-utils'

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

export async function buildMorningMessage(customNote?: string, isDoubleDay?: boolean) {
  const todayISO = await getEffectiveDateISO()
  const { start, end } = isoToMonthRange(todayISO)

  // Load scoreCount from config for the effective month
  const config = await prisma.leagueConfig.findUnique({
    where: { year_month: { year: start.getFullYear(), month: start.getMonth() } },
  }).catch(() => null)
  const scoreCount = config?.scoreCount ?? 15

  const players = await prisma.player.findMany({
    include: { scores: { where: { date: { gte: start, lte: end } }, select: { total: true, isDoubleDay: true } } },
  })

  const standings = players
    .map(p => ({
      name: p.name,
      flag: p.countryFlag,
      avg: calcMonthlyAverage(p.scores, scoreCount),
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
    ...(isDoubleDay ? [veoSection('⚡ *DOUBLE POINTS DAY* ⚡\nToday\'s scores count TWICE toward the monthly standings. Don\'t waste it.')] : []),
    veoSection(opener),
    veoDivider(),
    veoSection(`*Scores close at 14:00* — ${countdownText}`),
    ...(standingsText ? [veoSection(standingsText)] : []),
    veoDivider(),
    veoContext(appUrl ? `Submit at ${appUrl}` : 'Submit your score at 14:00'),
  ]

  const fallbackText = isDoubleDay
    ? `⚡ DOUBLE POINTS DAY ⚡ — VEO GEO LEAGUE Scores close at 14:00. ${countdownText}.`
    : `⛳ VEO GEO LEAGUE — Scores close at 14:00. ${countdownText}.`

  const previewLines = [
    '⛳ VEO GEO LEAGUE — Morning Briefing',
    ...(customNote ? [`📌 ${customNote}`] : []),
    ...(isDoubleDay ? ['⚡ DOUBLE POINTS DAY ⚡ — Scores count TWICE today!'] : []),
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
  const todayISO = await getEffectiveDateISO()
  const { start, end } = isoToDateRange(todayISO)
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

  // Load scoreCount from config for the effective month
  const { start: mStart, end: mEnd } = isoToMonthRange(todayISO)
  const config = await prisma.leagueConfig.findUnique({
    where: { year_month: { year: mStart.getFullYear(), month: mStart.getMonth() } },
  }).catch(() => null)
  const scoreCount = config?.scoreCount ?? 15

  // Need date on each score so we can split before/after today for gainer calc
  const players = await prisma.player.findMany({
    include: { scores: { where: { date: { gte: mStart, lte: mEnd } }, select: { total: true, isDoubleDay: true, date: true } } },
  })

  // Monthly standings WITH today
  const monthlyStandings = players
    .map(p => ({
      name: p.name,
      flag: p.countryFlag,
      avg: calcMonthlyAverage(p.scores, scoreCount),
      games: p.scores.length,
    }))
    .filter(p => p.games > 0)
    .sort((a, b) => b.avg - a.avg)

  // Monthly standings WITHOUT today — for biggest gainer calculation
  const standingsBeforeToday = players
    .map(p => ({
      name: p.name,
      flag: p.countryFlag,
      avg: calcMonthlyAverage(p.scores.filter(s => s.date < start), scoreCount),
      games: p.scores.filter(s => s.date < start).length,
    }))
    .filter(p => p.games > 0)
    .sort((a, b) => b.avg - a.avg)

  // ── Top 3 today ──────────────────────────────────────────────────────────
  const top3Today = todayScores.slice(0, 3)
  const top3Lines = top3Today.map((score, i) => {
    const medal = MEDALS[i]
    const redCardBadge = score.redCards.length > 0 ? ` 🟥×${score.redCards.length}` : ''
    const perfect = score.total === 15000 ? ' ✨' : ''
    const doubleTag = score.isDoubleDay ? ' ⚡×2' : ''
    return `${medal} ${score.player.countryFlag} *${score.player.name}* — ${score.total.toLocaleString()}${doubleTag}${redCardBadge}${perfect}`
  })

  const top = todayScores[0]
  const winnerComment = top.total === 15000 ? perfectLine(top.player.name) : winnerLine(top.player.name)

  // ── Worst score / wooden spoon ────────────────────────────────────────────
  const worst = todayScores[todayScores.length - 1]
  const worstBanter = toiletLine(worst.player.name, worst.total)

  // ── Biggest gainer ────────────────────────────────────────────────────────
  let biggestGainer: { name: string; flag: string; fromPos: number; toPos: number } | null = null
  if (standingsBeforeToday.length >= 2) {
    for (const s of todayScores) {
      const name = s.player.name
      const fromIdx = standingsBeforeToday.findIndex(p => p.name === name)
      const toIdx = monthlyStandings.findIndex(p => p.name === name)
      // fromIdx > 0 = they existed before and weren't already #1
      if (fromIdx > 0 && toIdx >= 0) {
        const gain = fromIdx - toIdx
        if (gain > 0 && (!biggestGainer || gain > (biggestGainer.fromPos - biggestGainer.toPos))) {
          biggestGainer = { name, flag: s.player.countryFlag, fromPos: fromIdx + 1, toPos: toIdx + 1 }
        }
      }
    }
  }

  // ── Red cards ─────────────────────────────────────────────────────────────
  const redCardLines: string[] = []
  for (const score of todayScores) {
    for (const rc of score.redCards) {
      const reasonText = rc.reason ? ` Reason: "${rc.reason}"` : ''
      redCardLines.push(`🟥 ${rc.givenBy.countryFlag} ${rc.givenBy.name} carded ${score.player.countryFlag} ${score.player.name}.${reasonText}`)
    }
  }

  // ── Extra highlights (close race, full turnout, solo) ─────────────────────
  const extras: string[] = []
  if (todayScores.length >= 2) {
    const gap = todayScores[0].total - todayScores[1].total
    if (gap < 200) extras.push(`⚡ ${closeRaceLine(todayScores[0].player.name, todayScores[1].player.name, gap)}`)
  }
  const totalPlayers = await prisma.player.count()
  if (todayScores.length === 1) {
    extras.push(`👤 ${soloLine(top.player.name)}`)
  } else if (todayScores.length === totalPlayers) {
    extras.push(`✅ ${fullTurnoutLine(todayScores.length)}`)
  }

  // ── Monthly top 3 ─────────────────────────────────────────────────────────
  const top3Monthly = monthlyStandings.slice(0, 3)

  // ── Footer ────────────────────────────────────────────────────────────────
  const [fy, fm, fd] = todayISO.split('-').map(Number)
  const footerDate = new Date(fy, fm - 1, fd).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })

  const blocks = [
    veoHeader('⛳ VEO GEO LEAGUE — Daily Wrap'),
    ...(customNote ? [veoSection(`📌 ${customNote}`)] : []),
    veoDivider(),
    veoSection(`*Today's Top 3*\n${top3Lines.join('\n')}\n\n${winnerComment}`),
    // Wooden spoon — only when more than one player submitted
    ...(todayScores.length > 1 ? [
      veoDivider(),
      veoSection(`*🚽 Wooden Spoon*\n${worstBanter}`),
    ] : []),
    // Biggest gainer
    ...(biggestGainer ? [
      veoDivider(),
      veoSection(`*📈 Biggest Gainer*\n${biggestGainerLine(biggestGainer.name, biggestGainer.fromPos, biggestGainer.toPos)}`),
    ] : []),
    // Red cards
    ...(redCardLines.length > 0 ? [
      veoDivider(),
      veoSection(redCardLines.join('\n')),
    ] : []),
    // Close race / turnout / solo extras
    ...(extras.length > 0 ? [
      veoDivider(),
      veoSection(extras.join('\n')),
    ] : []),
    // Monthly top 3
    ...(top3Monthly.length > 0 ? [
      veoDivider(),
      veoSection('*🏆 Monthly Standings*\n' + top3Monthly.map((p, i) =>
        `${MEDALS[i]} ${p.flag} *${p.name}* — avg ${p.avg.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`
      ).join('\n')),
    ] : []),
    veoDivider(),
    veoContext(`${footerDate} • VEO GEO LEAGUE`),
  ]

  const fallbackText = `⛳ Daily Wrap — Top: ${top.player.name} ${top.total.toLocaleString()} | Wooden Spoon: ${worst.player.name} ${worst.total.toLocaleString()}`

  const previewLines = [
    '⛳ VEO GEO LEAGUE — Daily Wrap',
    ...(customNote ? [`📌 ${customNote}`] : []),
    '─────────────────',
    "Today's Top 3:",
    ...top3Lines.map(l => `  ${l.replace(/\*/g, '')}`),
    `  ${winnerComment}`,
    ...(todayScores.length > 1 ? [
      '─────────────────',
      '🚽 Wooden Spoon:',
      `  ${worstBanter}`,
    ] : []),
    ...(biggestGainer ? [
      '─────────────────',
      '📈 Biggest Gainer:',
      `  ${biggestGainerLine(biggestGainer.name, biggestGainer.fromPos, biggestGainer.toPos)}`,
    ] : []),
    ...(redCardLines.length > 0 ? [
      '─────────────────',
      ...redCardLines,
    ] : []),
    ...(extras.length > 0 ? [
      '─────────────────',
      ...extras,
    ] : []),
    ...(top3Monthly.length > 0 ? [
      '─────────────────',
      '🏆 Monthly Standings:',
      ...top3Monthly.map((p, i) => `  ${MEDALS[i]} ${p.flag} ${p.name} — avg ${p.avg.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`),
    ] : []),
    '─────────────────',
    footerDate + ' • VEO GEO LEAGUE',
  ]

  return { blocks, fallbackText, previewLines }
}
