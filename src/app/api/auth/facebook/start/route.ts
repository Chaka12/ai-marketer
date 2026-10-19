import { NextResponse } from 'next/server'

/**
 * Initiate the Facebook OAuth flow.
 * Route: GET /api/auth/facebook/start
 *
 * Redirects to Facebook's authorization dialog. After approval, Facebook
 * redirects back to /api/auth/facebook/callback with a code.
 *
 * Required env vars: FB_APP_ID, FB_APP_SECRET, NEXT_PUBLIC_BASE_URL
 * See FACEBOOK_SETUP.md for setup instructions.
 */

const FB_GRAPH_VERSION = 'v21.0'

const FB_SCOPES = [
  'pages_show_list',
  'pages_read_engagement',
  'pages_manage_posts',
  'pages_read_user_content',
].join(',')

export async function GET() {
  const appId = process.env.FB_APP_ID
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL

  if (!appId || !baseUrl) {
    return NextResponse.json(
      {
        success: false,
        error:
          'Facebook OAuth is not configured. Set FB_APP_ID, FB_APP_SECRET, and NEXT_PUBLIC_BASE_URL in your environment variables. See FACEBOOK_SETUP.md for details.',
      },
      { status: 500 },
    )
  }

  const redirectUri = `${baseUrl}/api/auth/facebook/callback`
  const state = Math.random().toString(36).slice(2)

  const authUrl =
    `https://www.facebook.com/${FB_GRAPH_VERSION}/dialog/oauth` +
    `?client_id=${encodeURIComponent(appId)}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&scope=${encodeURIComponent(FB_SCOPES)}` +
    `&response_type=code` +
    `&state=${state}`

  const res = NextResponse.redirect(authUrl)
  res.cookies.set('fb_oauth_state', state, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    maxAge: 600,
    path: '/',
  })
  return res
}
