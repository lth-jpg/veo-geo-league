import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET() {
  const wins = await prisma.monthlyWin.findMany({
    include: { player: true },
    orderBy: [{ year: 'desc' }, { month: 'desc' }],
  })

  // Group wins by player
  const byPlayer = new Map<number, { id: number; name: string; countryFlag: string; winCount: number; months: { year: number; month: number; avgScore: number; label: string }[] }>()

  for (const w of wins) {
    const label = new Date(w.year, w.month, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    const existing = byPlayer.get(w.playerId)
    if (existing) {
      existing.winCount++
      existing.months.push({ year: w.year, month: w.month, avgScore: w.avgScore, label })
    } else {
      byPlayer.set(w.playerId, {
        id: w.player.id,
        name: w.player.name,
        countryFlag: w.player.countryFlag,
        winCount: 1,
        months: [{ year: w.year, month: w.month, avgScore: w.avgScore, label }],
      })
    }
  }

  const sorted = Array.from(byPlayer.values()).sort((a, b) => b.winCount - a.winCount)
  return NextResponse.json({ wins: sorted, total: wins.length })
}
