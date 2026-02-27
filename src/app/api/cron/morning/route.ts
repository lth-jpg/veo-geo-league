import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getMonthRange, calcMonthlyAverage } from '@/lib/utils'
import { postToSlack, veoHeader, veoSection, veoContext, veoDivider } from '@/lib/slack'
import { morningOpener } from '@/lib/commentary'

export const dynamic = 'force-dynamic'

function checkSecret(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return true // not configured — allow (dev mode)
  const auth = req.headers.get('authorization')
  return auth === `Bearer ${secret}`
}

export async function POST(req: NextRequest) {
  if (!checkSecret(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Get current monthly leader
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

  const leader = standings[0]
  const appUrl = process.env.APP_URL ?? ''

  // Danish time: CET (UTC+1 winter) / CEST (UTC+2 summer)
  // 14:00 Danish = 13:00 UTC winter / 12:00 UTC summer
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

  const blocks = [
    veoHeader('⛳ VEO GEO LEAGUE — Morning Briefing'),
    veoSection(morningOpener()),
    veoDivider(),
    veoSection(`*Scores open at 14:00 🇩🇰* — ${countdownText}`),
    ...(leader ? [veoSection(`Monthly leader going into today: *${leader.flag} ${leader.name}* — avg ${leader.avg.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`)] : []),
    veoDivider(),
    veoContext(appUrl ? `Submit at ${appUrl}` : 'Submit your score at 14:00'),
  ]

  await postToSlack(blocks, `⛳ VEO GEO LEAGUE — Scores open at 14:00. ${countdownText}.`)

  return NextResponse.json({ ok: true })
}

// Rough Danish summer time check (last Sunday of March → last Sunday of October)
function isDanishSummerTime(date: Date): boolean {
  const month = date.getUTCMonth() // 0-indexed
  if (month < 2 || month > 9) return false
  if (month > 2 && month < 9) return true
  const lastSunday = getLastSunday(date.getUTCFullYear(), month)
  if (month === 2) return date.getUTCDate() >= lastSunday
  if (month === 9) return date.getUTCDate() < lastSunday
  return false
}

function getLastSunday(year: number, month: number): number {
  const d = new Date(Date.UTC(year, month + 1, 0)) // last day of month
  d.setUTCDate(d.getUTCDate() - d.getUTCDay())
  return d.getUTCDate()
}
