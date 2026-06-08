import { useEffect, useState } from "react"
import { supabase, signOut } from "@/lib/supabase"
import type { User } from "@supabase/supabase-js"
import { LogOut } from "lucide-react"

function useUser() {
  const [user, setUser] = useState<User | null>(null)
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setUser(session?.user ?? null))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ?? null)
    })
    return () => subscription.unsubscribe()
  }, [])
  return user
}

export function UserMenuMobile() {
  const user = useUser()
  const [open, setOpen] = useState(false)
  if (!user) return null
  const avatar = user.user_metadata?.avatar_url as string | undefined
  const name = user.user_metadata?.full_name ?? user.email ?? ""
  return (
    <>
      <button onClick={() => setOpen(true)} className="flex flex-col items-center gap-1.5">
        {avatar
          ? <img src={avatar} alt={name} className="rounded-full object-cover" style={{ width: 22, height: 22 }} referrerPolicy="no-referrer" />
          : <div className="rounded-full flex items-center justify-center text-[10px] font-bold text-white" style={{ width: 22, height: 22, background: "var(--primary)" }}>{name[0]?.toUpperCase()}</div>
        }
        <span className="text-[10px] font-medium text-muted-foreground whitespace-nowrap">บัญชี</span>
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end" onClick={() => setOpen(false)}>
          <div className="bg-card border-t border-border rounded-t-2xl p-4 space-y-3" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3 pb-3 border-b border-border">
              {avatar
                ? <img src={avatar} alt={name} className="w-10 h-10 rounded-full object-cover" referrerPolicy="no-referrer" />
                : <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white" style={{ background: "var(--primary)" }}>{name[0]?.toUpperCase()}</div>
              }
              <div className="min-w-0">
                <p className="text-sm font-semibold truncate">{name}</p>
                <p className="text-xs text-muted-foreground truncate">{user.email}</p>
              </div>
            </div>
            <button onClick={signOut} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-red-500 hover:bg-red-50 transition-colors">
              <LogOut className="w-4 h-4" />
              ออกจากระบบ
            </button>
          </div>
        </div>
      )}
    </>
  )
}

export function UserMenu() {
  const user = useUser()

  if (!user) return null

  const name = user.user_metadata?.full_name ?? user.email ?? ""
  const avatar = user.user_metadata?.avatar_url as string | undefined

  return (
    <div className="flex items-center gap-2.5 px-1">
      {avatar
        ? <img src={avatar} alt={name} className="w-7 h-7 rounded-full flex-shrink-0 object-cover" referrerPolicy="no-referrer" />
        : <div className="w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold text-white" style={{ background: "var(--primary)" }}>{name[0]?.toUpperCase()}</div>
      }
      <div className="flex-1 min-w-0">
        <p className="text-[12px] font-medium leading-tight truncate" style={{ color: "var(--sidebar-accent-foreground)" }}>{name}</p>
      </div>
      <button onClick={signOut} className="p-1 rounded opacity-50 hover:opacity-100 transition-opacity flex-shrink-0" style={{ color: "var(--sidebar-foreground)" }} title="ออกจากระบบ">
        <LogOut className="w-3.5 h-3.5" />
      </button>
    </div>
  )
}
