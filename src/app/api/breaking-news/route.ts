import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET() {
  const now = new Date()
  // Return all active (non-expired) breaking news items
  const news = await prisma.breakingNews.findMany({
    where: { expiresAt: { gt: now } },
    include: { player: true },
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json(news)
}
