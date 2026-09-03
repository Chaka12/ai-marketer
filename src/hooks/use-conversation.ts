'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  timestamp?: string
}

interface Conversation {
  id: string
  messages: ChatMessage[]
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url)
  const json = await res.json()
  if (!json.success) throw new Error(json.error ?? 'Request failed')
  return json.data as T
}

export function useConversation() {
  return useQuery<Conversation>({
    queryKey: ['conversation'],
    queryFn: () => fetchJson<Conversation>('/api/conversation'),
  })
}

export function useSendMessage() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (message: string) => {
      const res = await fetch('/api/conversation/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message }),
      })
      const json = await res.json()
      if (!json.success) throw new Error(json.error ?? 'Send failed')
      return json.data as { response: string; messages: ChatMessage[] }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['conversation'] })
    },
  })
}
