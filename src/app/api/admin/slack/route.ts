import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { postToSlack } from '@/lib/slack'
import { buildMorningMessage, buildSummaryMessage } from '@/lib/slack-messages'
import { getTodayISODate } from '@/lib/utils'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { type, action, adminName, customNote, doublePoints } = body as {
    type: 'morning' | 'summary'
    action: 'preview' | 'send'
    adminName: string
    customNote?: string
    doublePoints?: boolean
  }

  if (adminName?.toLowerCase() !== 'leo') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  if (type !== 'morning' && type !== 'summary') {
    return NextResponse.json({ error: 'Invalid type' }, { status: 400 })
  }

  const message =
    type === 'morning'
      ? await buildMorningMessage(customNote || undefined, doublePoints ?? false)
      : await buildSummaryMessage(customNote || undefined)

  if (action === 'preview') {
    return NextResponse.json({ previewLines: message.previewLines, fallbackText: message.fallbackText })
  }

  // action === 'send'
  // If double points is enabled for morning post, persist it to the LeagueConfig
  if (type === 'morning' && doublePoints) {
    const now = new Date()
    const todayISO = getTodayISODate()
    await prisma.leagueConfig.upsert({
      where: { year_month: { year: now.getFullYear(), month: now.getMonth() } },
      create: {
        year: now.getFullYear(),
        month: now.getMonth(),
        doubleDayDate: todayISO,
      },
      update: { doubleDayDate: todayISO },
    })
  }

  await postToSlack(message.blocks, message.fallbackText)
  return NextResponse.json({ ok: true })
}
