import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getEffectiveDateISO, isoToMonthRange } from '@/lib/date-utils'

export const dynamic = 'force-dynamic'

function checkAdmin(adminName?: string) {
  return adminName?.toLowerCase() === 'leo'
}

export async function GET(req: NextRequest) {
  const adminName = req.nextUrl.searchParams.get('adminName') ?? ''
  if (!checkAdmin(adminName)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  try {
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
  } catch (e) {
    console.error('[admin/config GET]', e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

export async function PUT(req: NextRequest) {
  try {
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

    // Handle active days + score count — save to the SIMULATED month if one is set
    if (activeDays !== undefined && scoreCount !== undefined) {
      const todayISO = await getEffectiveDateISO()
      const { start } = isoToMonthRange(todayISO)
      const year = start.getFullYear()
      const month = start.getMonth()

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
  } catch (e) {
    console.error('[admin/config PUT]', e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
