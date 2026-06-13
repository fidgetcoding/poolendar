import { Resend } from 'resend'
import type { NotificationPayload } from './types'

const resend = new Resend(process.env.RESEND_API_KEY)

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
}

function sanitizeUrl(url: string): string {
  // Only allow http(s) and relative URLs to prevent javascript: injection
  if (url.startsWith('/') || url.startsWith('https://') || url.startsWith('http://')) {
    return escapeHtml(url)
  }
  return '#'
}

function buildHtml(payload: NotificationPayload): string {
  const safeTitle = escapeHtml(payload.title)
  const safeBody = escapeHtml(payload.body)
  const cta = payload.url
    ? `<p style="margin-top:16px"><a href="${sanitizeUrl(payload.url)}" style="display:inline-block;padding:10px 20px;background:#6366f1;color:#fff;border-radius:6px;text-decoration:none;font-size:14px">Open in Poolendar</a></p>`
    : ''

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#1a1a1a">
  <h2 style="margin:0 0 8px;font-size:18px">${safeTitle}</h2>
  <p style="margin:0;font-size:14px;color:#555;line-height:1.6">${safeBody}</p>
  ${cta}
  <hr style="border:none;border-top:1px solid #e5e5e5;margin:24px 0 12px">
  <p style="font-size:11px;color:#999;margin:0">Poolendar Notifications</p>
</body>
</html>`.trim()
}

export async function sendEmailNotification(
  to: string,
  payload: NotificationPayload
): Promise<boolean> {
  try {
    const { error } = await resend.emails.send({
      from: 'Poolendar <noreply@poolendar.com>',
      to,
      subject: payload.title,
      html: buildHtml(payload),
    })

    if (error) {
      console.error('[notifications/email] Send failed:', error)
      return false
    }

    return true
  } catch (err) {
    console.error('[notifications/email] Unexpected error:', err)
    return false
  }
}
