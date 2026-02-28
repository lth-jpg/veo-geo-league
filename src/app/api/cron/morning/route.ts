import { NextRequest, NextResponse } from 'next/server'
import { postToSlack } from '@/lib/slack'
import { buildMorningMessage } from '@/lib/slack-messages'
import { getEffectiveDateISO } from '@/lib/date-utils'

export const dynamic = 'force-dynamic'

function checkSecret(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return true // not configured — allow (dev mode)
  const auth = req.headers.get('authorization')
  return auth === `Bearer ${secret}`
}

export async function POST(req: NextRequest) {
  if (!checkSecret(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Only run Mon–Fri based on effective date (respects simulated date)
  const todayISO = await getEffectiveDateISO()
  const [y, m, d] = todayISO.split('-').map(Number)
  const dayOfWeek = new Date(y, m - 1, d).getDay() // 0=Sun, 6=Sat
  if (dayOfWeek === 0 || dayOfWeek === 6) {
    return NextResponse.json({ ok: true, skipped: 'weekend' })
  }

  const { blocks, fallbackText } = await buildMorningMessage()
  await postToSlack(blocks, fallbackText)

  return NextResponse.json({ ok: true })
}
