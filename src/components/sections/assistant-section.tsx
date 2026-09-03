'use client'

import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import { useConversation, useSendMessage } from '@/hooks/use-conversation'
import { toast } from 'sonner'
import { Bot, Send, User, Sparkles } from 'lucide-react'
import { format } from 'date-fns'

const SUGGESTIONS = [
  'What performed best last month?',
  'Suggest an angle for next week\'s lifestyle post.',
  'Which pillar should I deprioritize?',
  'Summarise my awaiting-approval posts.',
]

export function AssistantSection() {
  const { data: convo, isLoading } = useConversation()
  const sendMessage = useSendMessage()
  const [input, setInput] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [convo?.messages.length, sendMessage.isPending])

  const handleSend = async (text?: string) => {
    const message = (text ?? input).trim()
    if (!message || sendMessage.isPending) return
    setInput('')
    try {
      await sendMessage.mutateAsync(message)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to send message')
    }
  }

  if (isLoading) {
    return (
      <div className="flex flex-col gap-3">
        <Skeleton className="h-[60vh] w-full" />
      </div>
    )
  }

  const messages = convo?.messages ?? []

  return (
    <Card className="flex flex-col gap-0 overflow-hidden">
      <CardContent className="flex items-center justify-between gap-2 border-b border-border p-4">
        <div className="flex items-center gap-2">
          <div className="flex size-9 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Bot className="size-5" />
          </div>
          <div>
            <p className="font-display text-base font-semibold">Workspace AI Assistant</p>
            <p className="text-xs text-muted-foreground">
              Knows your brand, campaigns, and analytics.
            </p>
          </div>
        </div>
        <span className="flex items-center gap-1 text-xs text-muted-foreground">
          <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
          Online
        </span>
      </CardContent>

      <div
        ref={scrollRef}
        className="scroll-area-styled max-h-[60vh] flex-1 overflow-y-auto p-4"
      >
        {messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-center text-sm text-muted-foreground">
            <Sparkles className="size-8 text-primary/60" />
            <p>Ask the assistant anything about your content, performance, or strategy.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <AnimatePresence initial={false}>
              {messages.map((m, i) => {
                const isUser = m.role === 'user'
                return (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2 }}
                    className={`flex gap-3 ${isUser ? 'flex-row-reverse' : ''}`}
                  >
                    <div
                      className={`flex size-8 shrink-0 items-center justify-center rounded-md ${
                        isUser
                          ? 'bg-secondary text-secondary-foreground'
                          : 'bg-primary text-primary-foreground'
                      }`}
                    >
                      {isUser ? <User className="size-4" /> : <Bot className="size-4" />}
                    </div>
                    <div
                      className={`flex max-w-[80%] flex-col gap-1 rounded-lg px-3 py-2 text-sm ${
                        isUser
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-card border border-border'
                      }`}
                    >
                      <p className="whitespace-pre-wrap leading-relaxed">{m.content}</p>
                      {m.timestamp && (
                        <span
                          className={`text-[10px] ${
                            isUser ? 'text-primary-foreground/60' : 'text-muted-foreground'
                          }`}
                        >
                          {format(new Date(m.timestamp), 'EEE, h:mm a')}
                        </span>
                      )}
                    </div>
                  </motion.div>
                )
              })}
            </AnimatePresence>
            {sendMessage.isPending && (
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex gap-3"
              >
                <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground">
                  <Bot className="size-4" />
                </div>
                <div className="flex items-center gap-1 rounded-lg border border-border bg-card px-3 py-3">
                  <span className="size-2 animate-bounce rounded-full bg-muted-foreground" />
                  <span className="size-2 animate-bounce rounded-full bg-muted-foreground" style={{ animationDelay: '0.15s' }} />
                  <span className="size-2 animate-bounce rounded-full bg-muted-foreground" style={{ animationDelay: '0.3s' }} />
                </div>
              </motion.div>
            )}
          </div>
        )}
      </div>

      <div className="border-t border-border p-3">
        <div className="mb-2 flex flex-wrap gap-1.5">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              onClick={() => handleSend(s)}
              disabled={sendMessage.isPending}
              className="rounded-full border border-border bg-card px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              {s}
            </button>
          ))}
        </div>
        <form
          className="flex items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            handleSend()
          }}
        >
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            rows={2}
            placeholder="Ask anything…"
            className="resize-none"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                handleSend()
              }
            }}
          />
          <Button
            type="submit"
            disabled={sendMessage.isPending || !input.trim()}
            className="bg-primary text-primary-foreground hover:bg-primary/90"
          >
            <Send className="size-4" />
          </Button>
        </form>
      </div>
    </Card>
  )
}
