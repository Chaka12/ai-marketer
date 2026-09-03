import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { writeAudit } from '@/lib/server-utils'

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  try {
    const account = await db.socialAccount.findUnique({ where: { id } })
    if (!account) {
      return NextResponse.json({ success: false, error: 'Account not found' }, { status: 404 })
    }
    // Simulated reconnect — sets status to 'connected' and refreshes token expiry.
    const updated = await db.socialAccount.update({
      where: { id },
      data: {
        status: 'connected',
        accessToken: 'demo_token_refreshed_' + Date.now(),
        tokenExpiry: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
      },
    })
    await writeAudit({
      workspaceId: account.workspaceId,
      action: 'distribution.reconnect',
      entityType: 'socialAccount',
      entityId: id,
      details: { platform: account.platform },
    })
    return NextResponse.json({
      success: true,
      data: { id: updated.id, status: updated.status, simulated: true },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
