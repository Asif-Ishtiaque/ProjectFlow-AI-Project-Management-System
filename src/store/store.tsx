import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { api } from '../api/projectflow'
import { ApiError } from '../api/client'
import { idCounter, setIdCounter } from '../domain/ids'
import type { DatabaseShape, Project, RoleKey, User } from '../domain/types'
import type { Action } from './actions'
import { initialDatabase, reducer } from './reducer'

const STORAGE_KEY = 'anwar-projectflow-v2'

interface Persisted {
  db: DatabaseShape
  role: RoleKey
  ids: number
}

export interface Toast {
  id: string
  tone: 'success' | 'error' | 'info'
  title: string
  body?: string
}

interface Ctx {
  db: DatabaseShape
  status: 'loading' | 'ready' | 'error'
  role: RoleKey
  actor: User
  setRole: (r: RoleKey) => void
  /** Sends a command through the API layer; resolves the new state, or null when the call failed. */
  run: (action: Action, opts?: { success?: string; pendingKey?: string }) => Promise<DatabaseShape | null>
  pending: string | null
  toasts: Toast[]
  dismissToast: (id: string) => void
  pushToast: (t: Omit<Toast, 'id'>) => void
  failNext: boolean
  setFailNext: (v: boolean) => void
  reload: () => void
  resetDemo: () => void
  actorFor: (project?: Project) => User
}

const AppContext = createContext<Ctx | null>(null)

const ROLE_DEFAULT_USER: Record<RoleKey, string> = {
  management: 'u-kamal',
  team_lead: 'u-sarah',
  ai_analyst: 'u-nadia',
  developer: 'u-rahim',
  business_owner: 'u-hrdir',
}

const readPersisted = (): Persisted | null => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as Persisted) : null
  } catch {
    return null
  }
}

export function AppProvider({ children }: { children: ReactNode }) {
  const saved = useRef<Persisted | null>(readPersisted())
  const [db, dispatch] = useReducer(reducer, null, () => saved.current?.db ?? initialDatabase())
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [role, setRole] = useState<RoleKey>(saved.current?.role ?? 'team_lead')
  const [pending, setPending] = useState<string | null>(null)
  const [toasts, setToasts] = useState<Toast[]>([])
  const [failNext, setFailNext] = useState(false)

  useEffect(() => {
    if (saved.current?.ids) setIdCounter(saved.current.ids)
  }, [])

  const boot = useCallback(() => {
    setStatus('loading')
    api
      .bootstrap(db)
      .then(() => setStatus('ready'))
      .catch(() => setStatus('error'))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    boot()
  }, [boot])

  useEffect(() => {
    if (status !== 'ready') return
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ db, role, ids: idCounter() } satisfies Persisted))
    } catch {
      /* storage may be unavailable — the prototype still works in memory */
    }
  }, [db, role, status])

  const pushToast = useCallback((t: Omit<Toast, 'id'>) => {
    const id = `t-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`
    setToasts((list) => [...list, { ...t, id }])
    setTimeout(() => setToasts((list) => list.filter((x) => x.id !== id)), 5200)
  }, [])

  const dismissToast = useCallback((id: string) => setToasts((l) => l.filter((t) => t.id !== id)), [])

  const dbRef = useRef(db)
  dbRef.current = db

  /** Commands are serialised: each one is applied to the state the previous one produced. */
  const queue = useRef<Promise<unknown>>(Promise.resolve())

  const run = useCallback<Ctx['run']>((action, opts) => {
    const task = queue.current.then(() => execRef.current(action, opts))
    queue.current = task.catch(() => null)
    return task as Promise<DatabaseShape | null>
  }, [])

  const exec = useCallback<Ctx['run']>(
    async (action, opts) => {
      const key = opts?.pendingKey ?? action.type
      setPending(key)
      try {
        const next = await api.command(dbRef.current, action, { failOnce: failNext })
        if (failNext) setFailNext(false)
        dispatch({ type: '__commit', db: next })
        if (opts?.success) pushToast({ tone: 'success', title: opts.success })
        return next
      } catch (e) {
        setFailNext(false)
        pushToast({
          tone: 'error',
          title: 'The action could not be completed',
          body: e instanceof ApiError ? e.message : 'Unexpected error. Please try again.',
        })
        return null
      } finally {
        setPending(null)
      }
    },
    [failNext, pushToast],
  )

  const execRef = useRef(exec)
  execRef.current = exec

  const resetDemo = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY)
    dispatch({ type: 'reset' })
    setRole('team_lead')
    pushToast({ tone: 'info', title: 'Prototype reset', body: 'The demo data set was restored.' })
  }, [pushToast])

  const actorFor = useCallback(
    (project?: Project): User => {
      const fallback = db.users.find((u) => u.id === ROLE_DEFAULT_USER[role])!
      if (!project) return fallback
      const map: Partial<Record<RoleKey, string | undefined>> = {
        team_lead: project.ownerId,
        ai_analyst: project.analystId,
        developer: project.developerId,
        business_owner: project.businessOwnerId,
      }
      const id = map[role]
      return db.users.find((u) => u.id === id) ?? fallback
    },
    [db.users, role],
  )

  const value = useMemo<Ctx>(
    () => ({
      db,
      status,
      role,
      actor: db.users.find((u) => u.id === ROLE_DEFAULT_USER[role])!,
      setRole,
      run,
      pending,
      toasts,
      dismissToast,
      pushToast,
      failNext,
      setFailNext,
      reload: boot,
      resetDemo,
      actorFor,
    }),
    [db, status, role, run, pending, toasts, dismissToast, pushToast, failNext, boot, resetDemo, actorFor],
  )

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export const useApp = () => {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used inside <AppProvider>')
  return ctx
}

export const useProject = (id?: string) => {
  const { db } = useApp()
  return db.projects.find((p) => p.id === id)
}
