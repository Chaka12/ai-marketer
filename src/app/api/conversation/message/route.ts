import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { resolveWorkspace, brandToDTO, parseJsonArray, stringifyJsonArray, writeAudit } from '@/lib/server-utils'
import { runAssistant } from '@/lib/ai'

export async function POST(req: Request) {
  try {
    const workspace = await resolveWorkspace('maison-ete')
    if (!workspace) {
      return NextResponse.json({ success: false, error: 'No workspace' }, { status: 404 })
    }
    const body = await req.json().catch(() => ({}))
    const userMessage: string = (body.message ?? '').toString().trim()
    if (!userMessage) {
      return NextResponse.json({ success: false, error: 'Message is required' }, { status: 400 })
    }

    let convo = await db.aIConversation.findFirst({ where: { workspaceId: workspace.id } })
    if (!convo) {
      convo = await db.aIConversation.create({
        data: { workspaceId: workspace.id, messages: '[]' },
      })
    }

    const history = parseJsonArray<{ role: 'user' | 'assistant'; content: string }>(convo.messages)

    // Build brand + workspace context
    const brand = await db.brand.findFirst({ where: { workspaceId: workspace.id } })
    const brandDTO = brand ? await brandToDTO(brand) : undefined

    const [campaigns, pendingCount, analyticsAgg] = await Promise.all([
      db.campaign.findMany({
        where: { workspaceId: workspace.id, status: 'active' },
        select: { id: true, name: true, objective: true },
      }),
      db.post.count({ where: { workspaceId: workspace.id, status: 'pending_approval' } }),
      db.postAnalytics.aggregate({
        _sum: { reach: true, reactions: true, comments: true, shares: true, clicks: true },
        where: {
          post: {
            workspaceId: workspace.id,
            status: 'published',
            publishedAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
          },
        },
      }),
    ])

    const workspaceContext = JSON.stringify({
      workspace: workspace.name,
      approvalMode: workspace.approvalMode,
      activeCampaigns: campaigns,
      postsAwaitingApproval: pendingCount,
      last30Days: {
        reach: analyticsAgg._sum.reach ?? 0,
        reactions: analyticsAgg._sum.reactions ?? 0,
        comments: analyticsAgg._sum.comments ?? 0,
        shares: analyticsAgg._sum.shares ?? 0,
        clicks: analyticsAgg._sum.clicks ?? 0,
      },
    })

    const assistantResponse = await runAssistant({
      brand: brandDTO as never, // runAssistant tolerates undefined
      workspaceContext,
      history,
      userMessage,
    })

    const newMessages = [
      ...history,
      { role: 'user', content: userMessage, timestamp: new Date().toISOString() },
      { role: 'assistant', content: assistantResponse, timestamp: new Date().toISOString() },
    ]

    await db.aIConversation.update({
      where: { id: convo.id },
      data: { messages: stringifyJsonArray(newMessages) },
    })

    await writeAudit({
      workspaceId: workspace.id,
      action: 'assistant.message',
      entityType: 'conversation',
      entityId: convo.id,
      details: { userMessagePreview: userMessage.slice(0, 80) },
    })

    return NextResponse.json({
      success: true,
      data: { response: assistantResponse, messages: newMessages },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
