import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getTodayRange } from '@/lib/utils'
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const { givenById, receivedById, scoreId, reason } = await req.json()
  if (!givenById || !receivedById || !scoreId) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  }
  if (givenById === receivedById) {
    return NextResponse.json({ error: 'Cannot red card yourself' }, { status: 400 })
  }

  const { start, end } = getTodayRange()

  // Check if this player already gave a red card today
  const existing = await prisma.redCard.findFirst({
    where: { givenById: parseInt(givenById), date: { gte: start, lte: end } },
  })
  if (existing) {
    return NextResponse.json({ error: 'Already used your red card today' }, { status: 409 })
  }

  const rc = await prisma.redCard.create({
    data: {
      givenById: parseInt(givenById),
      receivedById: parseInt(receivedById),
      scoreId: parseInt(scoreId),
      reason: reason?.trim() || null,
    },
    include: { givenBy: true, receivedBy: true },
  })

  return NextResponse.json(rc)
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const givenById = searchParams.get('givenById')
  if (!givenById) return NextResponse.json({ error: 'Missing givenById' }, { status: 400 })

  const { start, end } = getTodayRange()
  const existing = await prisma.redCard.findFirst({
    where: { givenById: parseInt(givenById), date: { gte: start, lte: end } },
    include: { receivedBy: true, score: true },
  })
  return NextResponse.json({ usedToday: !!existing, card: existing })
}
