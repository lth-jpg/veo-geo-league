import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET() {
  const messages = await prisma.chatMessage.findMany({
    orderBy: { createdAt: 'desc' },
    take: 50,
    include: { player: true },
  })
  return NextResponse.json(messages.reverse())
}

export async function POST(req: NextRequest) {
  const { playerId, authorName, text } = await req.json()
  if (!authorName?.trim() || !text?.trim()) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  }
  const msg = await prisma.chatMessage.create({
    data: {
      playerId: playerId ? parseInt(playerId) : null,
      authorName: authorName.trim(),
      text: text.trim(),
    },
    include: { player: true },
  })
  return NextResponse.json(msg)
}
