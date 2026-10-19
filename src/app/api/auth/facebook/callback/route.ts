import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { resolveWorkspace, writeAudit } from '@/lib/server-utils'

/**
 * Facebook OAuth callback.
 * Route: GET /api/auth/facebook/callback
 *
 * Exchanges the code for a long-lived User token, lists the user's Pages,
 * stores the account + each Page as a destination.
 */

const FB_GRAPH_VERSION = 'v21.0'
const FB_GRAPH_BASE = `https://graph.facebook.com/${FB_GRAPH_VERSION}`

export async function GET(req: Request) {
  const appId = process.env.FB_APP_ID
  const appSecret = process.env.FB_APP_SECRET
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL

  if (!appId || !appSecret || !baseUrl) {
    return NextResponse.redirect(new URL('/?error=fb_not_configured', baseUrl || '/'))
  }

  const { searchParams } = new URL(req.url)
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const error = searchParams.get('error')

  if (error) {
    return NextResponse.redirect(new URL('/?error=fb_auth_denied', baseUrl))
  }
  if (!code) {
    return NextResponse.redirect(new URL('/?error=fb_no_code', baseUrl))
  }

  // Verify state (CSRF protection)
  const cookieState = req.headers.get('cookie') ?? ''
  const stateMatch = cookieState.match(/fb_oauth_state=([^;]+)/)
  if (!stateMatch || stateMatch[1] !== state) {
    return NextResponse.redirect(new URL('/?error=fb_state_mismatch', baseUrl))
  }

  const redirectUri = `${baseUrl}/api/auth/facebook/callback`

  try {
    // 1. Exchange code for short-lived User access token
    const tokenRes = await fetch(
      `${FB_GRAPH_BASE}/oauth/access_token?client_id=${encodeURIComponent(appId)}&client_secret=${encodeURIComponent(appSecret)}&redirect_uri=${encodeURIComponent(redirectUri)}&code=${encodeURIComponent(code)}`,
    )
    const tokenJson = await tokenRes.json()
    if (!tokenJson.access_token) {
      throw new Error(tokenJson.error?.message ?? 'Token exchange failed')
    }
    const userToken = tokenJson.access_token

    // 2. Exchange for long-lived User token (60 days)
    const longTokenRes = await fetch(
      `${FB_GRAPH_BASE}/oauth/access_token?grant_type=fb_exchange_token&client_id=${encodeURIComponent(appId)}&client_secret=${encodeURIComponent(appSecret)}&fb_exchange_token=${encodeURIComponent(userToken)}`,
    )
    const longTokenJson = await longTokenRes.json()
    const longUserToken = longTokenJson.access_token ?? userToken
    const tokenExpiry = longTokenJson.expires_in
      ? new Date(Date.now() + longTokenJson.expires_in * 1000)
      : new Date(Date.now() + 60 * 24 * 60 * 60 * 1000)

    // 3. Get user name + list of Pages
    const meRes = await fetch(`${FB_GRAPH_BASE}/me?fields=name&access_token=${encodeURIComponent(longUserToken)}`)
    const meJson = await meRes.json()

    const pagesRes = await fetch(`${FB_GRAPH_BASE}/me/accounts?fields=id,name,access_token&access_token=${encodeURIComponent(longUserToken)}`)
    const pagesJson = await pagesRes.json()
    const pages: Array<{ id: string; name: string; access_token: string }> = pagesJson.data ?? []

    // 4. Store in database
    const workspace = await resolveWorkspace('maison-ete')
    if (!workspace) {
      return NextResponse.redirect(new URL('/?error=no_workspace', baseUrl))
    }

    const account = await db.socialAccount.create({
      data: {
        workspaceId: workspace.id,
        platform: 'facebook',
        name: `Facebook — ${meJson.name}`,
        accountId: meJson.id,
        accessToken: longUserToken,
        tokenExpiry,
        status: 'connected',
      },
    })

    for (const page of pages) {
      await db.destination.create({
        data: {
          socialAccountId: account.id,
          type: 'page',
          name: page.name,
          externalId: page.id,
          automationStatus: 'automated',
          postingRules: JSON.stringify({ pageAccessToken: page.access_token }),
        },
      })
    }

    // If only one page, store its token on the account for the publisher
    if (pages.length === 1) {
      await db.socialAccount.update({
        where: { id: account.id },
        data: { accessToken: pages[0].access_token },
      })
    }

    await writeAudit({
      workspaceId: workspace.id,
      action: 'distribution.facebook_oauth',
      entityType: 'socialAccount',
      entityId: account.id,
      details: { pagesConnected: pages.length, userName: meJson.name },
    })

    return NextResponse.redirect(new URL('/?fb_connected=1', baseUrl))
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.redirect(new URL(`/?error=${encodeURIComponent(message)}`, baseUrl))
  }
}
