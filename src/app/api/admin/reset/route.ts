import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

function checkAdmin(adminName?: string) {
  return adminName?.toLowerCase() === 'leo'
}

// Wipes all game data: scores, red cards, comments, breaking news, chat, monthly wins.
// Players and league config are preserved.
export async function POST(req: NextRequest) {
  try {
    const { adminName, confirm } = await req.json()

    if (!checkAdmin(adminName)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }
    if (confirm !== 'RESET') {
      return NextResponse.json({ error: 'Confirmation required' }, { status: 400 })
    }

    // Delete in dependency order
    await prisma.comment.deleteMany({})
    await prisma.redCard.deleteMany({})
    await prisma.breakingNews.deleteMany({})
    await prisma.score.deleteMany({})
    await prisma.chatMessage.deleteMany({})
    await prisma.monthlyWin.deleteMany({})

    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[admin/reset POST]', e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
