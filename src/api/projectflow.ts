import type { DatabaseShape } from '../domain/types'
import { reducer } from '../store/reducer'
import type { Action } from '../store/actions'
import { type ApiOptions, request } from './client'

/**
 * Endpoints the UI is allowed to call. In a real deployment each of these is an
 * HTTP route backed by the same entities declared in domain/types.ts.
 */
export const api = {
  /** GET /api/bootstrap */
  bootstrap: (db: DatabaseShape) => request('/api/bootstrap', () => db, { latency: [420, 700] }),

  /** POST /api/projects/:id/<command> — every command is a reducer action. */
  command: (db: DatabaseShape, action: Action, opts?: ApiOptions) =>
    request(`/api/commands/${action.type}`, () => reducer(db, action), opts),
}
