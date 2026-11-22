import { defineEventHandler, readBody } from 'h3'
import { ensureSchema, query } from '../utils/db'
import { getActiveCollection } from '../utils/collection'
import { airdropNft, verifyHbarPayment } from '../utils/hedera'
import { apiErrorResponse, apiErrorFromException } from '../utils/api'

const ACCOUNT_ID_RE = /^0\.0\.\d+$/
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

async function restoreStock(itemId: string) {
  await query`
    UPDATE collection_items
    SET remaining = remaining + 1, sold_count = sold_count - 1
    WHERE id = ${itemId}
  `.catch(() => undefined)
}

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event).catch(() => ({}))
    const itemId = String(body?.itemId || '')
    const transactionId = String(body?.transactionId || '').trim()
    const payerAccountId = String(body?.payerAccountId || '').trim()
    const firstName = String(body?.firstName || '').trim()
    const lastName = String(body?.lastName || '').trim()
    const email = String(body?.email || '').trim()
    const industry = body?.industry ? String(body.industry) : null
    const jobRole = body?.jobRole ? String(body.jobRole) : null
    const interests = Array.isArray(body?.interests) ? body.interests.map(String).filter(Boolean) : []

    if (!firstName || !lastName || !email) {
      return apiErrorResponse(event, 400, 'required_fields')
    }
    if (!EMAIL_RE.test(email)) {
      return apiErrorResponse(event, 400, 'invalid_email')
    }
    if (!ACCOUNT_ID_RE.test(payerAccountId)) {
      return apiErrorResponse(event, 400, 'invalid_account')
    }
    if (!transactionId) {
      return apiErrorResponse(event, 400, 'missing_transaction')
    }
    if (!itemId) {
      return apiErrorResponse(event, 400, 'missing_item')
    }

    const collection = await getActiveCollection()
    if (!collection) {
      return apiErrorResponse(event, 404, 'no_collection')
    }
    const item = collection.items.find((entry: any) => entry.id === itemId)
    if (!item) {
      return apiErrorResponse(event, 404, 'item_not_found')
    }
    if (Number(item.remaining) <= 0) {
      return apiErrorResponse(event, 409, 'out_of_stock')
    }

    const verified = await verifyHbarPayment({ transactionId, payerAccountId })

    await ensureSchema()
    const duplicate = await query<any>`
      SELECT id FROM buyers WHERE payment_transaction_id = ${verified.mirrorTransactionId} LIMIT 1
    `
    if (duplicate.length > 0) {
      return apiErrorResponse(event, 409, 'duplicate_payment')
    }

    const reserved = await query<any>`
      UPDATE collection_items
      SET remaining = remaining - 1, sold_count = sold_count + 1
      WHERE id = ${item.id} AND collection_id = ${collection.id} AND remaining > 0
      RETURNING id, sold_count
    `
    if (reserved.length === 0) {
      return apiErrorResponse(event, 409, 'out_of_stock')
    }

    const serial = Number(item.serialStart) + Number(reserved[0].sold_count) - 1

    let delivery: { transactionId: string; pending: boolean }
    try {
      delivery = await airdropNft({
        tokenId: collection.tokenId,
        serial,
        receiverAccountId: payerAccountId
      })
    } catch (error) {
      await restoreStock(item.id)
      return apiErrorResponse(event, 502, 'delivery_failed')
    }

    try {
      const buyers = await query<any>`
        INSERT INTO buyers (
          collection_id, item_id, first_name, last_name, email, industry,
          interests, job_role, hedera_account_id, payment_transaction_id,
          nft_token_id, nft_serial, airdrop_transaction_id, delivery_status
        ) VALUES (
          ${collection.id}, ${item.id}, ${firstName}, ${lastName}, ${email},
          ${industry}, ${interests}, ${jobRole}, ${payerAccountId},
          ${verified.mirrorTransactionId}, ${collection.tokenId}, ${serial},
          ${delivery.transactionId}, ${delivery.pending ? 'pending' : 'delivered'}
        )
        RETURNING id, first_name, last_name, email, hedera_account_id,
                  payment_transaction_id, nft_token_id, nft_serial,
                  airdrop_transaction_id, delivery_status, created_at
      `
      return {
        ok: true,
        buyer: buyers[0],
        item: {
          id: item.id,
          name: item.name,
          imageUrl: item.imageUrl,
          serial
        },
        delivery
      }
    } catch (error: any) {
      await restoreStock(item.id)
      if (String(error?.code) === '23505') {
        return apiErrorResponse(event, 409, 'duplicate_payment')
      }
      return apiErrorFromException(event, error)
    }
  } catch (error) {
    return apiErrorFromException(event, error)
  }
})
