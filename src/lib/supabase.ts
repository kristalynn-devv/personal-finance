import { createClient } from "@supabase/supabase-js"

export const supabase = createClient(
  import.meta.env.PUBLIC_SUPABASE_URL,
  import.meta.env.PUBLIC_SUPABASE_ANON_KEY,
)

export async function getUserId(): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("not authenticated")
  return user.id
}

export async function getSession() {
  const { data: { session } } = await supabase.auth.getSession()
  return session
}

export async function signInWithGoogle() {
  await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: window.location.origin },
  })
}

export async function signOut() {
  await supabase.auth.signOut()
  window.location.href = "/login"
}
