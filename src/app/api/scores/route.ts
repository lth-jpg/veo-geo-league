import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getTodayRange } from '@/lib/utils'

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
    const score = await prisma.score.upsert({
      where: { playerId_date: { playerId: parseInt(playerId), date: dateOnly } },
      create: { playerId: parseInt(playerId), round1: r1, round2: r2, round3: r3, total, date: dateOnly },
      update: { round1: r1, round2: r2, round3: r3, total },
      include: { player: true },
    })
    return NextResponse.json(score)
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
