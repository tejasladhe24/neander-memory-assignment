import { authClient } from "@/lib/auth-client"
import type { PGSession, PGUser } from "@/lib/db"
import {
  createContext,
  startTransition,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react"

interface IAuthContext {
  session: PGSession | null
  user: PGUser | null
  isLoading: boolean
  token: string | null
  /** Reload session from the server without toggling global loading UI. */
  refreshSession: () => Promise<void>
}

const AuthContext = createContext<IAuthContext>({
  session: null,
  user: null,
  isLoading: true,
  token: null,
  refreshSession: async () => {},
})

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [session, setSession] = useState<PGSession | null>(null)
  const [user, setUser] = useState<PGUser | null>(null)
  const [isLoading, setLoading] = useState(true)
  const [token, setToken] = useState<string | null>(null)

  const updateToken = useCallback(async () => {
    const { data, error } = await authClient.token()
    if (error || !data?.token) return
    setToken(data.token)
  }, [])

  const refreshSession = useCallback(async () => {
    const { data, error } = await authClient.getSession()
    if (error || !data?.session || !data?.user) return
    setSession(data.session as PGSession)
    setUser(data.user as PGUser)

    await updateToken()
  }, [])

  const getSession = async () => {
    setLoading(true)
    const { data, error } = await authClient.getSession()

    if (error || !data?.session || !data?.user) {
      setLoading(false)
      return
    }

    setSession(data.session as PGSession)
    setUser(data.user as PGUser)
    await updateToken()
    setLoading(false)
  }

  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | undefined
    // eslint-disable-next-line react-hooks/set-state-in-effect -- mount-only session bootstrap (getSession sets loading + user)
    void getSession().then(() => {
      startTransition(() => {
        interval = setInterval(() => void refreshSession(), 1000 * 60 * 5)
      })
    })

    return () => {
      if (interval) clearInterval(interval)
    }
  }, [refreshSession])

  const value = useMemo(
    () => ({ user, session, isLoading, refreshSession, token }),
    [user, session, isLoading, refreshSession, token]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export const useAuth = () => {
  const context = useContext(AuthContext)

  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider")
  }

  return context
}
