import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET() {
  // Get distinct year/month combos from scores
  const scores = await prisma.score.findMany({
    select: { date: true },
    orderBy: { date: 'desc' },
  })

  const seen = new Set<string>()
  const months: { year: number; month: number; label: string }[] = []

  for (const s of scores) {
    const y = s.date.getFullYear()
    const m = s.date.getMonth()
    const key = `${y}-${m}`
    if (!seen.has(key)) {
      seen.add(key)
      months.push({
        year: y,
        month: m,
        label: new Date(y, m, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
      })
    }
  }

  return NextResponse.json(months)
}
