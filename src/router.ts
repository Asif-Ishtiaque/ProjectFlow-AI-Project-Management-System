import { useEffect, useState } from 'react'

export const navigate = (href: string) => {
  const to = href.startsWith('#') ? href.slice(1) : href
  if (window.location.hash.slice(1) === to) return
  window.location.hash = to
}

export interface Route {
  path: string
  segments: string[]
  /** Everything after "?" — lets a chart deep-link into a filtered list. */
  query: Record<string, string>
}

const read = (): Route => {
  const raw = window.location.hash.slice(1) || '/'
  const [path, search = ''] = raw.split('?')
  const query: Record<string, string> = {}
  for (const pair of search.split('&')) {
    if (!pair) continue
    const [k, v = ''] = pair.split('=')
    query[decodeURIComponent(k)] = decodeURIComponent(v)
  }
  return { path, segments: path.split('/').filter(Boolean), query }
}

export function useRoute(): Route {
  const [route, setRoute] = useState<Route>(read)
  useEffect(() => {
    const onHash = () => {
      setRoute(read())
      window.scrollTo({ top: 0 })
    }
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])
  return route
}
