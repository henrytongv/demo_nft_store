import { defineEventHandler, deleteCookie } from 'h3'
import { ADMIN_COOKIE } from '../../utils/adminAuth'

export default defineEventHandler((event) => {
  deleteCookie(event, ADMIN_COOKIE, { path: '/' })
  return { ok: true }
})
