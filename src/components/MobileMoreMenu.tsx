import { useState } from "react"

type NavItem = { label: string; href: string; icon: string }

export function MobileMoreMenu({ items, pathname }: { items: NavItem[]; pathname: string }) {
  const [open, setOpen] = useState(false)

  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href))
  const anyActive = items.some((item) => isActive(item.href))

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={`flex flex-col items-center gap-1.5 text-[10px] font-medium transition-colors ${anyActive ? "text-primary" : "text-muted-foreground"}`}
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
          <circle cx="5" cy="12" r="1.5" />
          <circle cx="12" cy="12" r="1.5" />
          <circle cx="19" cy="12" r="1.5" />
        </svg>
        <span className="whitespace-nowrap">เพิ่มเติม</span>
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end" onClick={() => setOpen(false)}>
          <div className="bg-card border-t border-border rounded-t-2xl p-4 space-y-1" onClick={(e) => e.stopPropagation()}>
            {items.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                  isActive(item.href) ? "bg-primary text-primary-foreground" : "hover:bg-muted"
                }`}
              >
                <span className="flex-shrink-0 opacity-80 [&>svg]:w-5 [&>svg]:h-5" dangerouslySetInnerHTML={{ __html: item.icon }} />
                {item.label}
              </a>
            ))}
          </div>
        </div>
      )}
    </>
  )
}
