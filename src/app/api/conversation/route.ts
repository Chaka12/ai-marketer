import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { resolveWorkspace, parseJsonArray } from '@/lib/server-utils'

export async function GET() {
  try {
    const workspace = await resolveWorkspace('maison-ete')
    if (!workspace) {
      return NextResponse.json({ success: false, error: 'No workspace' }, { status: 404 })
    }
    let convo = await db.aIConversation.findFirst({
      where: { workspaceId: workspace.id },
    })
    if (!convo) {
      convo = await db.aIConversation.create({
        data: {
          workspaceId: workspace.id,
          messages: JSON.stringify([
            {
              role: 'assistant',
              content:
                "Hi! I'm the AI marketing assistant for this workspace. Ask me anything about your content, performance, or strategy.",
              timestamp: new Date().toISOString(),
            },
          ]),
        },
      })
    }
    const messages = parseJsonArray<{ role: string; content: string; timestamp?: string }>(convo.messages)
    return NextResponse.json({ success: true, data: { id: convo.id, messages } })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
