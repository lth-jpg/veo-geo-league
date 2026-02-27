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
