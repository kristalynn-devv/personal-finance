import { useState, useEffect } from "react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Type } from "lucide-react"

const FONTS = [
  { id: "inter", label: "Inter", family: "Inter, sans-serif" },
  { id: "sarabun", label: "Sarabun", family: "Sarabun, sans-serif" },
  { id: "noto", label: "Noto Sans Thai", family: "'Noto Sans Thai', sans-serif" },
  { id: "ibm", label: "IBM Plex Sans Thai", family: "'IBM Plex Sans Thai', sans-serif" },
  { id: "anuphan", label: "Anuphan", family: "Anuphan, sans-serif" },
]

const MIN_SIZE = 12
const MAX_SIZE = 22
const DEFAULT_SIZE = 15

function applySettings(fontId: string, size: number) {
  const f = FONTS.find(f => f.id === fontId) ?? FONTS[1]
  document.documentElement.style.setProperty("--font-family", f.family)
  document.documentElement.style.setProperty("--font-size-base", `${size}px`)
}

export function FontSettings() {
  const [font, setFont] = useState("sarabun")
  const [size, setSize] = useState(DEFAULT_SIZE)

  useEffect(() => {
    const savedFont = localStorage.getItem("pf-font") ?? "sarabun"
    const savedSize = parseInt(localStorage.getItem("pf-font-size") ?? String(DEFAULT_SIZE))
    setFont(savedFont)
    setSize(savedSize)
    applySettings(savedFont, savedSize)
  }, [])

  function changeFont(fontId: string) {
    setFont(fontId)
    localStorage.setItem("pf-font", fontId)
    applySettings(fontId, size)
  }

  function changeSize(val: number) {
    setSize(val)
    localStorage.setItem("pf-font-size", String(val))
    applySettings(font, val)
  }

  const [open, setOpen] = useState(false)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        className="flex items-center gap-2 w-full px-3 py-2 rounded-md text-[13px] font-medium transition-all duration-150 text-left hover:opacity-100"
        style={{ color: "var(--sidebar-foreground)", opacity: 0.7 }}
      >
        <Type className="w-4 h-4 flex-shrink-0" />
        ตั้งค่าฟอนต์
      </PopoverTrigger>

      <PopoverContent side="right" align="end" className="w-52 p-3">
        <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">ฟอนต์</p>
        <div className="space-y-0.5 mb-4">
          {FONTS.map(f => (
            <button
              key={f.id}
              onClick={() => changeFont(f.id)}
              className={`w-full text-left px-2.5 py-1.5 rounded-md text-sm transition-colors ${
                font === f.id ? "bg-primary text-primary-foreground" : "hover:bg-muted"
              }`}
              style={{ fontFamily: f.family }}
            >
              {f.label}
            </button>
          ))}
        </div>

        <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">
          ขนาด — {size}px
        </p>
        <input
          type="range"
          min={MIN_SIZE}
          max={MAX_SIZE}
          value={size}
          onChange={(e) => changeSize(parseInt(e.target.value))}
          className="w-full accent-primary cursor-pointer"
        />
        <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
          <span>{MIN_SIZE}px</span>
          <span>{MAX_SIZE}px</span>
        </div>
      </PopoverContent>
    </Popover>
  )
}
