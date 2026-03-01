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

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const msgId = searchParams.get('id')
  const adminName = searchParams.get('adminName')

  if (adminName?.toLowerCase() !== 'leo') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }
  if (!msgId) {
    return NextResponse.json({ error: 'Message ID required' }, { status: 400 })
  }

  try {
    await prisma.chatMessage.delete({ where: { id: parseInt(msgId) } })
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

