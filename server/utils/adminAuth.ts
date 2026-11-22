import { createHmac, timingSafeEqual } from 'node:crypto'
import type { H3Event } from 'h3'
import { createError, getCookie } from 'h3'

export const ADMIN_COOKIE = 'admin_session'
const SESSION_TTL_MS = 8 * 60 * 60 * 1000

function secret() {
  const value = process.env.SESSION_SECRET
  if (!value || value.length < 32) {
    throw createError({ statusCode: 500, statusMessage: 'session_secret_not_configured' })
  }
  return value
}

function sign(payload: string) {
  return createHmac('sha256', secret()).update(payload).digest('base64url')
}

export function createAdminSessionValue() {
  const expiresAt = Date.now() + SESSION_TTL_MS
  const payload = `admin.${expiresAt}`
  return `${payload}.${sign(payload)}`
}

export function isValidAdminSession(value: string | undefined) {
  if (!value) return false
  const parts = value.split('.')
  const signature = parts.pop()
  const payload = parts.join('.')
  if (!payload || !signature) return false
  const expected = sign(payload)
  const a = Buffer.from(signature)
  const b = Buffer.from(expected)
  if (a.length !== b.length || !timingSafeEqual(a, b)) return false
  const expiresAt = Number(payload.split('.').pop())
  return Number.isFinite(expiresAt) && expiresAt > Date.now()
}

export function requireAdmin(event: H3Event) {
  if (!isValidAdminSession(getCookie(event, ADMIN_COOKIE))) {
    throw createError({ statusCode: 401, statusMessage: 'unauthorized' })
  }
}

export function adminCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict' as const,
    path: '/',
    maxAge: SESSION_TTL_MS / 1000
  }
}
