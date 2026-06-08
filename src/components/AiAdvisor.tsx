import { useState, useRef, useEffect, useCallback } from "react"
import { useAssets, useLiabilities, useBudget, useProfile, useRetirement, useAiAdvisorContext } from "@/store"
import { sendMessage, type Message } from "@/lib/ai"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Bot, Loader2, Send, X, Sparkles, RefreshCw } from "lucide-react"

const SUGGESTIONS = [
  "วิเคราะห์สุขภาพการเงินของฉัน",
  "ควรโปะหนี้หรือลงทุนดี?",
  "ลดหย่อนภาษีได้อีกไหม?",
  "ฉันจะเกษียณได้ตามแผนไหม?",
]

function MessageBubble({ content, role }: { content: string; role: "user" | "assistant" }) {
  // render bullet lines nicely
  const lines = content.split("\n").map(l => l.trim()).filter(Boolean)
  const isBullet = lines.length > 1 && lines.some(l => /^[-•]/.test(l))

  if (role === "user") {
    return (
      <div className="max-w-[80%] rounded-2xl rounded-tr-sm px-3.5 py-2.5 text-xs leading-relaxed text-primary-foreground" style={{ background: "var(--primary)" }}>
        {content}
      </div>
    )
  }

  if (isBullet) {
    return (
      <div className="max-w-[88%] rounded-2xl rounded-tl-sm bg-muted px-3.5 py-2.5 text-xs leading-relaxed space-y-1.5">
        {lines.map((line, i) => {
          const clean = line.replace(/^[-•*]\s*/, "").replace(/\*\*(.+?)\*\*/g, "$1")
          return (
            <div key={i} className="flex gap-2">
              <span className="mt-[5px] w-1.5 h-1.5 rounded-full bg-primary/60 flex-shrink-0" />
              <span>{clean}</span>
            </div>
          )
        })}
      </div>
    )
  }

  return (
    <div className="max-w-[88%] rounded-2xl rounded-tl-sm bg-muted px-3.5 py-2.5 text-xs leading-relaxed whitespace-pre-wrap">
      {content}
    </div>
  )
}

export function AiAdvisor() {
  const { isOpen, setOpen: storeSetOpen } = useAiAdvisorContext()
  const [open, setOpenLocal] = useState(false)
  const setOpen = (v: boolean) => { setOpenLocal(v); storeSetOpen(v) }
  // sync from store (e.g. PageHeader button)
  useEffect(() => { setOpenLocal(isOpen) }, [isOpen])

  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const [pageInsightLoaded, setPageInsightLoaded] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const prevPageRef = useRef<string | null>(null)

  // drag state for mobile
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null)
  const dragRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null)
  const isDragging = useRef(false)

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    const t = e.touches[0]
    const btn = e.currentTarget as HTMLElement
    const rect = btn.getBoundingClientRect()
    dragRef.current = { startX: t.clientX, startY: t.clientY, origX: rect.left, origY: rect.top }
    isDragging.current = false
  }, [])

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    if (!dragRef.current) return
    const t = e.touches[0]
    const dx = t.clientX - dragRef.current.startX
    const dy = t.clientY - dragRef.current.startY
    if (!isDragging.current && Math.abs(dx) + Math.abs(dy) > 6) isDragging.current = true
    if (!isDragging.current) return
    e.preventDefault()
    const bw = window.innerWidth, bh = window.innerHeight, sz = 44
    const x = Math.min(Math.max(dragRef.current.origX + dx, 8), bw - sz - 8)
    const y = Math.min(Math.max(dragRef.current.origY + dy, 8), bh - sz - 8)
    setPos({ x, y })
  }, [])

  const onTouchEnd = useCallback(() => {
    if (isDragging.current) { dragRef.current = null; return }
    dragRef.current = null
    setOpen(true)
  }, [])

  const { items: assets } = useAssets()
  const { items: liabilities } = useLiabilities()
  const { entries } = useBudget()
  const profile = useProfile()
  const retirement = useRetirement()
  const { generateFn, pageName, cache, setCache } = useAiAdvisorContext()

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, loading])

  // reset chat when navigating to a new page
  useEffect(() => {
    if (pageName && pageName !== prevPageRef.current) {
      prevPageRef.current = pageName
      setMessages([])
      setPageInsightLoaded(null)
    }
  }, [pageName])

  // auto-load page insight when bubble is opened — use cache if available
  useEffect(() => {
    if (!open || !generateFn || pageInsightLoaded === pageName || loading) return
    setPageInsightLoaded(pageName)
    const cached = pageName ? cache[pageName] : null
    if (cached) {
      setMessages([{ role: "assistant", content: cached }])
      return
    }
    setLoading(true)
    generateFn().then((result) => {
      setMessages([{ role: "assistant", content: result }])
      if (pageName) setCache(pageName, result)
    }).catch(() => {
      setMessages([{ role: "assistant", content: "❌ ไม่สามารถโหลดการวิเคราะห์ได้ ลองใหม่นะ" }])
    }).finally(() => setLoading(false))
  }, [open, generateFn, pageName])

  async function send(text?: string) {
    const content = (text ?? input).trim()
    if (!content || loading) return
    setInput("")
    const newMessages: Message[] = [...messages, { role: "user", content }]
    setMessages(newMessages)
    setLoading(true)
    try {
      const reply = await sendMessage(newMessages, assets, liabilities, entries, profile, retirement)
      setMessages([...newMessages, { role: "assistant", content: reply }])
    } catch {
      setMessages([...newMessages, { role: "assistant", content: "❌ เกิดข้อผิดพลาด กรุณาลองใหม่นะ" }])
    } finally {
      setLoading(false)
    }
  }

  async function reloadInsight() {
    if (!generateFn || loading) return
    setMessages([])
    setLoading(true)
    try {
      const result = await generateFn()
      setMessages([{ role: "assistant", content: result }])
      if (pageName) setCache(pageName, result)
    } catch {
      setMessages([{ role: "assistant", content: "❌ ไม่สามารถโหลดการวิเคราะห์ได้" }])
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      {/* Desktop trigger button — only when panel is closed */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-6 right-6 z-50 hidden md:flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-medium text-white transition-all hover:scale-105 active:scale-95"
          style={{
            background: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)",
            boxShadow: "0 4px 20px rgba(139,92,246,0.45)",
          }}
        >
          <span className="w-2 h-2 rounded-full bg-white/80 animate-pulse" />
          <Bot className="w-4 h-4" />
          AI ที่ปรึกษา
        </button>
      )}

      {open && (
        <>
          {/* Desktop: full-height side panel */}
          <div className="fixed inset-y-0 right-0 z-50 hidden md:flex flex-col w-[380px] border-l border-border/50 shadow-2xl bg-background">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 flex-shrink-0 border-b border-border/40" style={{ background: "var(--primary)" }}>
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center">
                <Bot className="w-4 h-4" style={{ color: "var(--primary-foreground)" }} />
              </div>
              <div>
                <p className="text-sm font-semibold leading-none" style={{ color: "var(--primary-foreground)" }}>AI ที่ปรึกษาการเงิน</p>
                <p className="text-[11px] mt-0.5 opacity-70" style={{ color: "var(--primary-foreground)" }}>
                  {pageName ? `กำลังดูหน้า: ${pageName}` : "รู้ข้อมูลการเงินของคุณทั้งหมด"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {generateFn && messages.length > 0 && !loading && (
                <button onClick={reloadInsight} className="opacity-70 hover:opacity-100 transition-opacity p-1" style={{ color: "var(--primary-foreground)" }} title="วิเคราะห์ใหม่">
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
              )}
              <button onClick={() => setOpen(false)} className="opacity-70 hover:opacity-100 transition-opacity p-1" style={{ color: "var(--primary-foreground)" }}>
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-background min-h-0">
            {!loading && messages.length === 0 && (
              <div className="space-y-3 pt-2">
                <div className="flex items-center gap-2 text-muted-foreground justify-center">
                  <Sparkles className="w-3.5 h-3.5" />
                  <p className="text-xs">ถามเรื่องการเงินของคุณได้เลย</p>
                </div>
                <div className="grid grid-cols-1 gap-2">
                  {SUGGESTIONS.map((s) => (
                    <button key={s} onClick={() => send(s)} className="w-full text-left text-xs px-3.5 py-2.5 rounded-xl border border-border/70 hover:bg-muted hover:border-border transition-colors">
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((m, i) => (
              <div key={i} className={`flex gap-2 ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                {m.role === "assistant" && (
                  <div className="w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center mt-0.5" style={{ background: "var(--primary)" }}>
                    <Bot className="w-3.5 h-3.5" style={{ color: "var(--primary-foreground)" }} />
                  </div>
                )}
                <MessageBubble content={m.content} role={m.role} />
              </div>
            ))}

            {loading && (
              <div className="flex gap-2 justify-start">
                <div className="w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center" style={{ background: "var(--primary)" }}>
                  <Bot className="w-3.5 h-3.5" style={{ color: "var(--primary-foreground)" }} />
                </div>
                <div className="bg-muted rounded-2xl rounded-tl-sm px-3.5 py-2.5 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50 animate-bounce" style={{ animationDelay: "0ms" }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50 animate-bounce" style={{ animationDelay: "150ms" }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50 animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="p-3 border-t border-border bg-background flex gap-2 flex-shrink-0">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && send()}
              placeholder="ถามต่อได้เลย..."
              className="text-sm rounded-xl"
              disabled={loading}
            />
            <Button size="icon" className="flex-shrink-0 rounded-xl" onClick={() => send()} disabled={loading || !input.trim()}>
              {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
            </Button>
          </div>
        </div>

        {/* Mobile: full-screen overlay */}
        <div className="fixed inset-0 z-50 flex flex-col md:hidden bg-background">
          <div className="flex items-center justify-between px-4 py-3 flex-shrink-0" style={{ background: "var(--primary)" }}>
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center">
                <Bot className="w-4 h-4" style={{ color: "var(--primary-foreground)" }} />
              </div>
              <div>
                <p className="text-sm font-semibold leading-none" style={{ color: "var(--primary-foreground)" }}>AI ที่ปรึกษาการเงิน</p>
                <p className="text-[11px] mt-0.5 opacity-70" style={{ color: "var(--primary-foreground)" }}>
                  {pageName ? `หน้า: ${pageName}` : "รู้ข้อมูลการเงินของคุณทั้งหมด"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {generateFn && messages.length > 0 && !loading && (
                <button onClick={reloadInsight} className="opacity-70 hover:opacity-100 p-1" style={{ color: "var(--primary-foreground)" }}>
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
              )}
              <button onClick={() => setOpen(false)} className="opacity-70 hover:opacity-100 p-1" style={{ color: "var(--primary-foreground)" }}>
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0">
            {!loading && messages.length === 0 && (
              <div className="space-y-3 pt-2">
                <div className="flex items-center gap-2 text-muted-foreground justify-center">
                  <Sparkles className="w-3.5 h-3.5" />
                  <p className="text-xs">ถามเรื่องการเงินของคุณได้เลย</p>
                </div>
                <div className="grid grid-cols-1 gap-2">
                  {SUGGESTIONS.map((s) => (
                    <button key={s} onClick={() => send(s)} className="w-full text-left text-xs px-3.5 py-2.5 rounded-xl border border-border/70 hover:bg-muted transition-colors">
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} className={`flex gap-2 ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                {m.role === "assistant" && (
                  <div className="w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center mt-0.5" style={{ background: "var(--primary)" }}>
                    <Bot className="w-3.5 h-3.5" style={{ color: "var(--primary-foreground)" }} />
                  </div>
                )}
                <MessageBubble content={m.content} role={m.role} />
              </div>
            ))}
            {loading && (
              <div className="flex gap-2 justify-start">
                <div className="w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center" style={{ background: "var(--primary)" }}>
                  <Bot className="w-3.5 h-3.5" style={{ color: "var(--primary-foreground)" }} />
                </div>
                <div className="bg-muted rounded-2xl rounded-tl-sm px-3.5 py-2.5 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50 animate-bounce" style={{ animationDelay: "0ms" }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50 animate-bounce" style={{ animationDelay: "150ms" }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50 animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>
          <div className="p-3 border-t border-border bg-background flex gap-2 flex-shrink-0">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && send()}
              placeholder="ถามต่อได้เลย..."
              className="text-sm rounded-xl"
              disabled={loading}
            />
            <Button size="icon" className="flex-shrink-0 rounded-xl" onClick={() => send()} disabled={loading || !input.trim()}>
              {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
            </Button>
          </div>
        </div>
        </>
      )}
    </>
  )
}
