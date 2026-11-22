import { setResponseStatus } from 'h3'
import { logServerError } from './logger'

export function apiError(status: number, code: string) {
  return { ok: false as const, error: code }
}

export function apiErrorResponse(event: any, status: number, code: string) {
  setResponseStatus(event, status)
  return apiError(status, code)
}

export function apiErrorFromException(event: any, error: any) {
  const status = Number(error?.statusCode || error?.status || 500)
  const code = String(error?.statusMessage || error?.data?.code || error?.message || 'generic')
  logServerError(event?.path || event?.node?.req?.url || 'api', error)
  setResponseStatus(event, status >= 400 && status < 600 ? status : 500)
  return { ok: false as const, error: code }
}
