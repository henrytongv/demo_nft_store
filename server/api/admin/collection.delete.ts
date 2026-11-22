import { defineEventHandler } from 'h3'
import { ensureSchema, query } from '../../utils/db'

export default defineEventHandler(async () => {
  await ensureSchema()
  await query`UPDATE collections SET is_active = false WHERE is_active = true`
  return { ok: true }
})
