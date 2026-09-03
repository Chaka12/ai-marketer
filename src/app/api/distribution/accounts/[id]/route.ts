import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { writeAudit } from '@/lib/server-utils'

/**
 * Disconnect a social account. This deletes the account and all its
 * destinations. Posts that referenced those destinations are NOT deleted —
 * they are kept for audit history, but their `destinationId` is cleared.
 *
 * In production this would also call Facebook's deauthorize endpoint to
 * revoke the app's permissions on the user's behalf.
 */
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  try {
    const account = await db.socialAccount.findUnique({ where: { id } })
    if (!account) {
      return NextResponse.json({ success: false, error: 'Account not found' }, { status: 404 })
    }

    // Clear destination references on posts so we don't break FK constraints.
    await db.post.updateMany({
      where: { destination: { socialAccountId: id } },
      data: { destinationId: null },
    })

    await db.socialAccount.delete({ where: { id } })

    await writeAudit({
      workspaceId: account.workspaceId,
      action: 'distribution.disconnect',
      entityType: 'socialAccount',
      entityId: id,
      details: { platform: account.platform, name: account.name },
    })

    return NextResponse.json({ success: true, data: { id } })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
