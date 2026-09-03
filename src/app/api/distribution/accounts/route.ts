import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { resolveWorkspace, writeAudit } from '@/lib/server-utils'

/**
 * GET — list all social accounts + their destinations for the workspace.
 */
export async function GET(req: Request) {
  try {
    const workspace = await resolveWorkspace('maison-ete')
    if (!workspace) {
      return NextResponse.json({ success: false, error: 'No workspace' }, { status: 404 })
    }
    const { searchParams } = new URL(req.url)
    const workspaceIdParam = searchParams.get('workspaceId')
    void workspaceIdParam

    const accounts = await db.socialAccount.findMany({
      where: { workspaceId: workspace.id },
      orderBy: { createdAt: 'asc' },
      include: {
        destinations: {
          orderBy: { createdAt: 'asc' },
        },
      },
    })

    const data = accounts.map((a) => ({
      id: a.id,
      platform: a.platform,
      name: a.name,
      accountId: a.accountId,
      status: a.status,
      destinations: a.destinations.map((d) => ({
        id: d.id,
        type: d.type,
        name: d.name,
        externalId: d.externalId,
        platform: a.platform,
        automationStatus: d.automationStatus,
        contentStyleHint: d.contentStyleHint,
        allowedFrequency: d.allowedFrequency,
        lastPostAt: d.lastPostAt?.toISOString() ?? null,
      })),
    }))

    return NextResponse.json({ success: true, data })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}

/**
 * POST — Connect a new Facebook account (and optionally a first destination/page).
 *
 * In production this endpoint would be hit after the user completed the
 * Facebook OAuth flow — the access token and page IDs would come from Meta's
 * callback. In the sandbox we accept the values from a form so the user can
 * simulate connecting any number of pages.
 *
 * Body:
 *   {
 *     platform: 'facebook',
 *     accountName: string,         // human-friendly label
 *     accountId?: string,          // FB page ID
 *     accessToken?: string,        // long-lived page token
 *     destination?: {              // optional first destination
 *       type: 'page' | 'group',
 *       name: string,
 *       externalId?: string,
 *       automationStatus?: 'automated' | 'manual',
 *       contentStyleHint?: string,
 *       allowedFrequency?: string
 *     }
 *   }
 */
export async function POST(req: Request) {
  try {
    const workspace = await resolveWorkspace('maison-ete')
    if (!workspace) {
      return NextResponse.json({ success: false, error: 'No workspace' }, { status: 404 })
    }

    const body = await req.json().catch(() => ({}))
    const platform: string = (body.platform ?? 'facebook').toString()
    const accountName: string = (body.accountName ?? '').toString().trim()
    if (!accountName) {
      return NextResponse.json({ success: false, error: 'accountName is required' }, { status: 400 })
    }

    const account = await db.socialAccount.create({
      data: {
        workspaceId: workspace.id,
        platform,
        name: accountName,
        accountId: body.accountId?.toString() || null,
        accessToken: body.accessToken?.toString() || 'demo_token',
        tokenExpiry: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
        status: 'connected',
      },
    })

    let destination = null
    if (body.destination && typeof body.destination === 'object') {
      const d = body.destination
      destination = await db.destination.create({
        data: {
          socialAccountId: account.id,
          type: d.type === 'group' ? 'group' : 'page',
          name: (d.name ?? accountName).toString(),
          externalId: d.externalId?.toString() || null,
          automationStatus:
            d.automationStatus === 'manual' ? 'manual' : 'automated',
          contentStyleHint: d.contentStyleHint?.toString() || null,
          allowedFrequency: d.allowedFrequency?.toString() || null,
        },
      })
    }

    await writeAudit({
      workspaceId: workspace.id,
      action: 'distribution.connect',
      entityType: 'socialAccount',
      entityId: account.id,
      details: { platform, accountName, destinationName: destination?.name ?? null },
    })

    return NextResponse.json({
      success: true,
      data: {
        id: account.id,
        platform: account.platform,
        name: account.name,
        accountId: account.accountId,
        status: account.status,
        destination: destination
          ? {
              id: destination.id,
              type: destination.type,
              name: destination.name,
              externalId: destination.externalId,
              automationStatus: destination.automationStatus,
              contentStyleHint: destination.contentStyleHint,
              allowedFrequency: destination.allowedFrequency,
            }
          : null,
      },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
