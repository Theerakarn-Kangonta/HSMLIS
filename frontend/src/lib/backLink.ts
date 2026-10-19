import { createContext, useContext, useEffect } from 'react'

/** Lets a page put its "back" link in the app shell's sticky top bar (see `Layout`). */
const BackLinkContext = createContext<(href: string | null) => void>(() => {})

export const BackLinkProvider = BackLinkContext.Provider

/** Shows a back link to `href` in the top bar while the calling page is on screen. */
export function useBackLink(href?: string) {
  const setBack = useContext(BackLinkContext)
  useEffect(() => {
    if (!href) return
    setBack(href)
    return () => setBack(null)
  }, [href, setBack])
}
