import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getEffectiveDateISO, isoToDateRange } from '@/lib/date-utils'
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const { givenById, receivedById, scoreId, reason } = await req.json()
  if (!givenById || !receivedById || !scoreId) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  }
  if (givenById === receivedById) {
    return NextResponse.json({ error: 'Cannot red card yourself' }, { status: 400 })
  }

  const todayISO = await getEffectiveDateISO()
  const { start, end } = isoToDateRange(todayISO)

  // Check if this player already gave a red card today (effective date)
  const existing = await prisma.redCard.findFirst({
    where: { givenById: parseInt(givenById), date: { gte: start, lte: end } },
  })
  if (existing) {
    return NextResponse.json({ error: 'Already used your red card today' }, { status: 409 })
  }

  // Explicitly set date to effective date noon so it matches the range query above
  const [y, m, d] = todayISO.split('-').map(Number)
  const dateNoon = new Date(y, m - 1, d, 12, 0, 0, 0)

  const rc = await prisma.redCard.create({
    data: {
      givenById: parseInt(givenById),
      receivedById: parseInt(receivedById),
      scoreId: parseInt(scoreId),
      reason: reason?.trim() || null,
      date: dateNoon,
    },
    include: { givenBy: true, receivedBy: true },
  })

  return NextResponse.json(rc)
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const givenById = searchParams.get('givenById')
  if (!givenById) return NextResponse.json({ error: 'Missing givenById' }, { status: 400 })

  const { start, end } = isoToDateRange(await getEffectiveDateISO())
  const existing = await prisma.redCard.findFirst({
    where: { givenById: parseInt(givenById), date: { gte: start, lte: end } },
    include: { receivedBy: true, score: true },
  })
  return NextResponse.json({ usedToday: !!existing, card: existing })
}
