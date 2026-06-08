import { createClient } from "@supabase/supabase-js"

export const supabase = createClient(
  import.meta.env.PUBLIC_SUPABASE_URL,
  import.meta.env.PUBLIC_SUPABASE_ANON_KEY,
)

export function getUserId(): string {
  let id = localStorage.getItem("pf-user-id")
  if (!id) {
    id = crypto.randomUUID()
    localStorage.setItem("pf-user-id", id)
  }
  return id
}
