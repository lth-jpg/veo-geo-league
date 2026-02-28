import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

function checkAdmin(adminName?: string) {
  return adminName?.toLowerCase() === 'leo'
}

export async function GET(req: NextRequest) {
  const adminName = req.nextUrl.searchParams.get('adminName') ?? ''
  if (!checkAdmin(adminName)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth()

  const [config, settings] = await Promise.all([
    prisma.leagueConfig.findUnique({ where: { year_month: { year, month } } }),
    prisma.appSettings.findUnique({ where: { id: 1 } }),
  ])

  return NextResponse.json({
    year,
    month,
    activeDays: config ? JSON.parse(config.activeDays) : [],
    scoreCount: config?.scoreCount ?? 15,
    doubleDayDate: config?.doubleDayDate ?? null,
    simulatedDate: settings?.simulatedDate ?? null,
  })
}

export async function PUT(req: NextRequest) {
  const body = await req.json()
  const { adminName, activeDays, scoreCount, simulatedDate } = body as {
    adminName: string
    activeDays?: string[]
    scoreCount?: number
    simulatedDate?: string | null
  }

  if (!checkAdmin(adminName)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  // Handle simulated date separately
  if (simulatedDate !== undefined) {
    await prisma.appSettings.upsert({
      where: { id: 1 },
      create: { id: 1, simulatedDate: simulatedDate || null },
      update: { simulatedDate: simulatedDate || null },
    })
  }

  // Handle active days + score count when provided
  if (activeDays !== undefined && scoreCount !== undefined) {
    const now = new Date()
    const year = now.getFullYear()
    const month = now.getMonth()

    const config = await prisma.leagueConfig.upsert({
      where: { year_month: { year, month } },
      create: {
        year,
        month,
        activeDays: JSON.stringify(activeDays),
        scoreCount: scoreCount ?? 15,
      },
      update: {
        activeDays: JSON.stringify(activeDays),
        scoreCount: scoreCount ?? 15,
      },
    })

    return NextResponse.json({
      activeDays: JSON.parse(config.activeDays),
      scoreCount: config.scoreCount,
    })
  }

  return NextResponse.json({ ok: true })
}
