import { defineEventHandler } from 'h3'
import { ensureSchema, query } from '../../utils/db'

export default defineEventHandler(async () => {
  await ensureSchema()
  const entries = await query<any>`
    SELECT id, hedera_account_id, created_at
    FROM contest_entries
    ORDER BY created_at DESC
  `
  return { entries }
})
