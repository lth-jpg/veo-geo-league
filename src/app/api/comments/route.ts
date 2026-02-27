import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const { scoreId, authorName, text } = await req.json()
  if (!scoreId || !authorName?.trim() || !text?.trim()) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  }
  const comment = await prisma.comment.create({
    data: { scoreId: parseInt(scoreId), authorName: authorName.trim(), text: text.trim() },
  })
  return NextResponse.json(comment)
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const scoreId = searchParams.get('scoreId')
  if (!scoreId) return NextResponse.json({ error: 'Missing scoreId' }, { status: 400 })
  const comments = await prisma.comment.findMany({
    where: { scoreId: parseInt(scoreId) },
    orderBy: { createdAt: 'asc' },
  })
  return NextResponse.json(comments)
}
