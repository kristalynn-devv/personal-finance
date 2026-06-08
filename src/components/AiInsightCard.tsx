import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Sparkles, Loader2, RefreshCw, Send } from "lucide-react"

function InsightText({ text }: { text: string }) {
  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
    .map((l) =>
      l
        .replace(/^[-•*]\s*/, "")
        .replace(/^\d+\.\s*/, "")
        .replace(/\*\*(.+?)\*\*/g, "$1")
        .trim()
    )
    .filter((l) => l.length > 0)

  return (
    <ul className="space-y-2.5">
      {lines.map((line, i) => (
        <li key={i} className="flex gap-2.5 text-sm leading-relaxed">
          <span className="mt-[5px] w-1.5 h-1.5 rounded-full bg-primary/60 flex-shrink-0" />
          <span className="text-foreground/80">{line}</span>
        </li>
      ))}
    </ul>
  )
}

interface ChatTurn {
  role: "user" | "ai"
  text: string
}

interface Props {
  generate: () => Promise<string>
  followUp: (question: string, previousContext: string) => Promise<string>
  initialContent?: string | null
  initialLoading?: boolean
  hideRefresh?: boolean
}

export function AiInsightCard({ generate, followUp, initialContent, initialLoading, hideRefresh }: Props) {
  const [turns, setTurns] = useState<ChatTurn[]>(() =>
    initialContent ? [{ role: "ai", text: initialContent }] : []
  )
  const [loading, setLoading] = useState(initialLoading ?? false)

  useEffect(() => {
    if (initialContent) setTurns([{ role: "ai", text: initialContent }])
  }, [initialContent])

  useEffect(() => {
    if (initialLoading !== undefined) setLoading(initialLoading)
  }, [initialLoading])
  const [question, setQuestion] = useState("")
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [turns, loading])

  async function runInitial() {
    setLoading(true)
    try {
      const result = await generate()
      setTurns([{ role: "ai", text: result }])
    } catch {
      setTurns([{ role: "ai", text: "ไม่สามารถเชื่อมต่อ AI ได้ กรุณาลองใหม่" }])
    } finally {
      setLoading(false)
    }
  }

  async function runFollowUp() {
    if (!question.trim() || loading) return
    const q = question.trim()
    setQuestion("")
    const prevContext = turns.map((t) => `${t.role === "ai" ? "AI" : "ฉัน"}: ${t.text}`).join("\n")
    setTurns((prev) => [...prev, { role: "user", text: q }])
    setLoading(true)
    try {
      const result = await followUp(q, prevContext)
      setTurns((prev) => [...prev, { role: "ai", text: result }])
    } catch {
      setTurns((prev) => [...prev, { role: "ai", text: "ไม่สามารถเชื่อมต่อ AI ได้" }])
    } finally {
      setLoading(false)
    }
  }

  const hasContent = turns.length > 0

  return (
    <div className="mt-6 rounded-xl border border-primary/20 bg-gradient-to-br from-primary/5 to-primary/[0.02] p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-primary/15 flex items-center justify-center">
            <Sparkles className="w-3.5 h-3.5 text-primary" />
          </div>
          <span className="text-sm font-semibold">AI แนะนำ</span>
        </div>
        {loading && !hasContent ? (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            กำลังวิเคราะห์...
          </div>
        ) : (!hasContent || !hideRefresh) ? (
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs gap-1.5 border-primary/30 text-primary hover:bg-primary/10 hover:text-primary hover:border-primary/50"
            onClick={hasContent ? () => { setTurns([]); runInitial() } : runInitial}
            disabled={loading}
          >
            {hasContent ? <RefreshCw className="w-3 h-3" /> : <Sparkles className="w-3 h-3" />}
            {hasContent ? "วิเคราะห์ใหม่" : "ขอคำแนะนำ"}
          </Button>
        ) : null}
      </div>

      {!loading && !hasContent && (
        <p className="text-xs text-muted-foreground pl-8">
          กดปุ่มเพื่อให้ AI วิเคราะห์ข้อมูลในหน้านี้และให้คำแนะนำเฉพาะสำหรับคุณ
        </p>
      )}

      {!hasContent && loading && (
        <div className="pl-8 space-y-2">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="flex gap-2.5 items-center">
              <div className="w-1.5 h-1.5 rounded-full bg-primary/20 flex-shrink-0" />
              <div className={`h-3 rounded bg-primary/10 animate-pulse ${i === 0 ? "w-3/4" : i === 1 ? "w-2/3" : "w-1/2"}`} />
            </div>
          ))}
        </div>
      )}

      {hasContent && (
        <div className="space-y-4">
          {turns.map((turn, i) => (
            <div key={i} className={turn.role === "user" ? "pl-8" : ""}>
              {turn.role === "user" ? (
                <div className="inline-block bg-primary/10 text-primary text-sm rounded-lg px-3 py-1.5 max-w-[85%]">
                  {turn.text}
                </div>
              ) : (
                <div className="pl-8">
                  <InsightText text={turn.text} />
                </div>
              )}
            </div>
          ))}

          {loading && (
            <div className="pl-8 space-y-2">
              {[...Array(2)].map((_, i) => (
                <div key={i} className="flex gap-2.5 items-center">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary/20 flex-shrink-0" />
                  <div className={`h-3 rounded bg-primary/10 animate-pulse ${i === 0 ? "w-3/4" : "w-1/2"}`} />
                </div>
              ))}
            </div>
          )}

          <div ref={bottomRef} />

          <div className="flex gap-2 pt-1">
            <Input
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && runFollowUp()}
              placeholder="ถามต่อได้เลย..."
              className="h-8 text-sm bg-background/60"
              disabled={loading}
            />
            <Button
              size="icon"
              className="h-8 w-8 shrink-0"
              onClick={runFollowUp}
              disabled={!question.trim() || loading}
            >
              {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
