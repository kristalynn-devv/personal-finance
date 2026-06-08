import { useEffect } from "react"
import { useAssets, useLiabilities, useBudget, useProfile, useRetirement } from "@/store"

export function DataLoader() {
  const loadAssets = useAssets((s) => s.load)
  const loadLiabilities = useLiabilities((s) => s.load)
  const loadBudget = useBudget((s) => s.load)
  const loadProfile = useProfile((s) => s.load)
  const loadRetirement = useRetirement((s) => s.load)

  useEffect(() => {
    loadAssets()
    loadLiabilities()
    loadBudget()
    loadProfile()
    loadRetirement()
  }, [])

  return null
}
