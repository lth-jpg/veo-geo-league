import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET() {
  const players = await prisma.player.findMany({
    orderBy: { name: 'asc' },
  })
  return NextResponse.json(players)
}

export async function POST(req: NextRequest) {
  const { name, countryFlag } = await req.json()
  if (!name?.trim() || !countryFlag?.trim()) {
    return NextResponse.json({ error: 'Name and flag required' }, { status: 400 })
  }
  try {
    const player = await prisma.player.create({
      data: { name: name.trim(), countryFlag: countryFlag.trim() },
    })
    return NextResponse.json(player)
  } catch {
    return NextResponse.json({ error: 'Player already exists' }, { status: 409 })
  }
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const id = parseInt(searchParams.get('id') || '')
  const adminName = searchParams.get('adminName')

  if (!id) return NextResponse.json({ error: 'Player ID required' }, { status: 400 })
  if (adminName?.toLowerCase() !== 'leo') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  try {
    // Delete in dependency order: comments → red cards → scores → chat messages → player
    const scores = await prisma.score.findMany({ where: { playerId: id }, select: { id: true } })
    const scoreIds = scores.map((s: { id: number }) => s.id)

    await prisma.comment.deleteMany({ where: { scoreId: { in: scoreIds } } })
    await prisma.redCard.deleteMany({
      where: { OR: [{ scoreId: { in: scoreIds } }, { givenById: id }, { receivedById: id }] },
    })
    await prisma.score.deleteMany({ where: { playerId: id } })
    await prisma.chatMessage.deleteMany({ where: { playerId: id } })
    await prisma.player.delete({ where: { id } })

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Player not found' }, { status: 404 })
  }
}
