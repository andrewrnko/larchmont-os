// Runs once on app mount to hydrate theme + custom-pages + favorites stores
// from localStorage and apply the saved accent color to :root.

'use client'

import { useEffect } from 'react'
import { usePagesStore } from '@/lib/pages-store'
import { useThemeStore } from '@/lib/theme-store'
import { useFavoritesStore } from '@/lib/favorites-store'

export function AppHydration() {
  const hydrateTheme = useThemeStore((s) => s.hydrate)
  const hydratePages = usePagesStore((s) => s.hydrate)
  const hydrateFavorites = useFavoritesStore((s) => s.hydrate)

  useEffect(() => {
    hydrateTheme()
    hydratePages()
    hydrateFavorites()
  }, [hydrateTheme, hydratePages, hydrateFavorites])

  return null
}
