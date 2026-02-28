import { NextRequest, NextResponse } from 'next/server'
import { postToSlack } from '@/lib/slack'
import { buildMorningMessage, buildSummaryMessage } from '@/lib/slack-messages'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { type, action, adminName, customNote } = body as {
    type: 'morning' | 'summary'
    action: 'preview' | 'send'
    adminName: string
    customNote?: string
  }

  if (adminName?.toLowerCase() !== 'leo') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  if (type !== 'morning' && type !== 'summary') {
    return NextResponse.json({ error: 'Invalid type' }, { status: 400 })
  }

  const message =
    type === 'morning'
      ? await buildMorningMessage(customNote || undefined)
      : await buildSummaryMessage(customNote || undefined)

  if (action === 'preview') {
    return NextResponse.json({ previewLines: message.previewLines, fallbackText: message.fallbackText })
  }

  // action === 'send'
  await postToSlack(message.blocks, message.fallbackText)
  return NextResponse.json({ ok: true })
}
