import { useAiAdvisorContext } from "@/store"
import { Bot } from "lucide-react"
import { useState, useEffect } from "react"

interface Props {
  title: string
  description?: string
}

export function PageHeader({ title, description }: Props) {
  const { generateFn, pageName, setOpen } = useAiAdvisorContext() as any
  // only show on mobile — detect via window width after mount
  const [isMobile, setIsMobile] = useState(false)
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    check()
    window.addEventListener("resize", check)
    return () => window.removeEventListener("resize", check)
  }, [])

  const showBtn = isMobile && !!generateFn

  return (
    <div className="mb-6 pb-5 border-b border-border/60 flex items-start justify-between gap-3">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
        {description && <p className="text-muted-foreground mt-0.5 text-sm">{description}</p>}
      </div>
      {showBtn && (
        <button
          onClick={() => setOpen(true)}
          className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium text-white transition-all active:scale-95"
          style={{ background: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)", boxShadow: "0 2px 8px rgba(139,92,246,0.4)" }}
        >
          <Bot className="w-3.5 h-3.5" />
          AI
        </button>
      )}
    </div>
  )
}
