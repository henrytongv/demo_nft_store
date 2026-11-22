import { createError, defineEventHandler, readBody, setCookie } from 'h3'
import { createAdminSessionValue, adminCookieOptions, ADMIN_COOKIE } from '../../utils/adminAuth'
import { timingSafeEqual } from 'node:crypto'

export default defineEventHandler(async (event) => {
  const body = await readBody(event).catch(() => ({}))
  const password = String(body?.password || '')
  const expected = process.env.ADMIN_SCREEN_PASSWORD || ''
  const a = Buffer.from(password)
  const b = Buffer.from(expected)
  const ok = expected.length > 0 && a.length === b.length && timingSafeEqual(a, b)
  if (!ok) {
    throw createError({ statusCode: 401, statusMessage: 'wrong_password' })
  }
  setCookie(event, ADMIN_COOKIE, createAdminSessionValue(), adminCookieOptions())
  return { ok: true }
})
