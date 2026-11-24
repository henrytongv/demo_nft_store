import { defineEventHandler, readBody } from 'h3'
import { ensureSchema, query } from '../utils/db'
import { apiErrorResponse, apiErrorFromException } from '../utils/api'

const ACCOUNT_ID_RE = /^0\.0\.\d+$/

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event).catch(() => ({}))
    if (String(body?.website || '').trim()) {
      return { ok: true }
    }
    const accountId = String(body?.accountId || '').trim()
    if (!ACCOUNT_ID_RE.test(accountId)) {
      return apiErrorResponse(event, 400, 'invalid_account')
    }

    await ensureSchema()
    await query`
      INSERT INTO contest_entries (hedera_account_id)
      VALUES (${accountId})
    `
    return { ok: true }
  } catch (error) {
    return apiErrorFromException(event, error)
  }
})
