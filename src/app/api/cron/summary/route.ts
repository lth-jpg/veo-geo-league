import { NextRequest, NextResponse } from 'next/server'
import { postToSlack } from '@/lib/slack'
import { buildSummaryMessage } from '@/lib/slack-messages'

export const dynamic = 'force-dynamic'

function checkSecret(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return true
  const auth = req.headers.get('authorization')
  return auth === `Bearer ${secret}`
}

export async function POST(req: NextRequest) {
  if (!checkSecret(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Only run Mon–Fri (0=Sun, 6=Sat in UTC)
  const dayOfWeek = new Date().getUTCDay()
  if (dayOfWeek === 0 || dayOfWeek === 6) {
    return NextResponse.json({ ok: true, skipped: 'weekend' })
  }

  const { blocks, fallbackText } = await buildSummaryMessage()
  await postToSlack(blocks, fallbackText)

  return NextResponse.json({ ok: true, scores: true })
}
