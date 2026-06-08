import { useEffect, useState } from "react"
import { supabase, signOut } from "@/lib/supabase"
import type { User } from "@supabase/supabase-js"
import { LogOut } from "lucide-react"

export function UserMenu() {
  const [user, setUser] = useState<User | null>(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setUser(session?.user ?? null))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ?? null)
    })
    return () => subscription.unsubscribe()
  }, [])

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
