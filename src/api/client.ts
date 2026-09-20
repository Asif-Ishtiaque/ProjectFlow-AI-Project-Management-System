/**
 * Simulated transport.
 *
 * The prototype has no server, but every mutation goes through this layer with
 * realistic latency and a switchable failure mode, so the UI has to deal with
 * pending, success and error states exactly as it would against a real API.
 */
export interface ApiOptions {
  /** Force this call to fail once — used by the Settings "simulate failure" switch. */
  failOnce?: boolean
  latency?: [number, number]
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status = 503,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))

const rand = ([lo, hi]: [number, number]) => lo + Math.random() * (hi - lo)

export async function request<T>(endpoint: string, produce: () => T, opts: ApiOptions = {}): Promise<T> {
  await wait(rand(opts.latency ?? [180, 420]))
  if (opts.failOnce) {
    throw new ApiError(`POST ${endpoint} failed — the service did not respond in time.`)
  }
  return produce()
}
