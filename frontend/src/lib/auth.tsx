import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createContext, useCallback, useContext, useEffect, useMemo, type ReactNode } from 'react'
import { api, ApiError, setUnauthorizedHandler, type Me, type Permission } from './api'
import { useLiveUpdates } from './live'

type Auth = {
  me: Me | null
  /** True while the server is being asked whether this browser has a session. */
  isLoading: boolean
  /** Whether the signed-in user's role has the permission. The API checks again on every call. */
  can: (permission: Permission) => boolean
  signIn: (me: Me) => void
  signOut: () => void
}

const AuthContext = createContext<Auth | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()

  // The session cookie is invisible to script, so only the server can say whether we are signed in.
  const meQuery = useQuery({
    queryKey: ['me'],
    queryFn: () =>
      api.me().catch((error: unknown) => {
        if (error instanceof ApiError && error.status === 401) return null
        throw error
      }),
    retry: false,
    staleTime: 60_000,
  })

  /** Drops everything this browser knows about the signed-in user and their laboratory. */
  const forget = useCallback(() => {
    queryClient.setQueryData<Me | null>(['me'], null)
    queryClient.removeQueries({ predicate: (query) => query.queryKey[0] !== 'me' })
  }, [queryClient])

  useEffect(() => {
    setUnauthorizedHandler(forget)
  }, [forget])

  const signOut = useCallback(() => {
    // Asks the API to delete the cookie. If that fails the screen still signs out here.
    api.logout().catch(() => {})
    forget()
  }, [forget])

  // Keeps every screen current while signed in; reconnects as someone else after a new sign-in.
  useLiveUpdates(meQuery.data?.user.id)

  const signIn = useCallback((me: Me) => queryClient.setQueryData<Me | null>(['me'], me), [queryClient])

  const value = useMemo<Auth>(() => {
    const me = meQuery.data ?? null
    const permissions = new Set(me?.permissions ?? [])
    return {
      me,
      isLoading: meQuery.isPending,
      can: (permission) => permissions.has(permission),
      signIn,
      signOut,
    }
  }, [meQuery.data, meQuery.isPending, signIn, signOut])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): Auth {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth must be used inside AuthProvider')
  return value
}
