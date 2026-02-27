const WEBHOOK_URL = process.env.SLACK_WEBHOOK_URL

export async function postToSlack(blocks: object[], fallbackText: string): Promise<void> {
  if (!WEBHOOK_URL) return
  try {
    await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: fallbackText, blocks }),
    })
  } catch {
    // Slack is optional — never crash the app
  }
}

export function veoDivider() {
  return { type: 'divider' }
}

export function veoHeader(text: string) {
  return {
    type: 'header',
    text: { type: 'plain_text', text, emoji: true },
  }
}

export function veoSection(mrkdwn: string) {
  return {
    type: 'section',
    text: { type: 'mrkdwn', text: mrkdwn },
  }
}

export function veoContext(mrkdwn: string) {
  return {
    type: 'context',
    elements: [{ type: 'mrkdwn', text: mrkdwn }],
  }
}
