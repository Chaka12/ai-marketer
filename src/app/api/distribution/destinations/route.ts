import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { writeAudit } from '@/lib/server-utils'

/**
 * Add a new destination (page or group) to an existing social account.
 *
 * Body:
 *   {
 *     socialAccountId: string,
 *     type: 'page' | 'group',
 *     name: string,
 *     externalId?: string,
 *     automationStatus?: 'automated' | 'manual',
 *     contentStyleHint?: string,
 *     allowedFrequency?: string
 *   }
 */
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}))
    const socialAccountId: string = (body.socialAccountId ?? '').toString()
    if (!socialAccountId) {
      return NextResponse.json({ success: false, error: 'socialAccountId is required' }, { status: 400 })
    }
    const account = await db.socialAccount.findUnique({ where: { id: socialAccountId } })
    if (!account) {
      return NextResponse.json({ success: false, error: 'Account not found' }, { status: 404 })
    }
    const name: string = (body.name ?? '').toString().trim()
    if (!name) {
      return NextResponse.json({ success: false, error: 'name is required' }, { status: 400 })
    }

    const destination = await db.destination.create({
      data: {
        socialAccountId,
        type: body.type === 'group' ? 'group' : 'page',
        name,
        externalId: body.externalId?.toString() || null,
        automationStatus: body.automationStatus === 'manual' ? 'manual' : 'automated',
        contentStyleHint: body.contentStyleHint?.toString() || null,
        allowedFrequency: body.allowedFrequency?.toString() || null,
      },
    })

    await writeAudit({
      workspaceId: account.workspaceId,
      action: 'distribution.destination_add',
      entityType: 'destination',
      entityId: destination.id,
      details: { name, type: destination.type, accountName: account.name },
    })

    return NextResponse.json({
      success: true,
      data: {
        id: destination.id,
        type: destination.type,
        name: destination.name,
        externalId: destination.externalId,
        platform: account.platform,
        automationStatus: destination.automationStatus,
        contentStyleHint: destination.contentStyleHint,
        allowedFrequency: destination.allowedFrequency,
        lastPostAt: null,
      },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
