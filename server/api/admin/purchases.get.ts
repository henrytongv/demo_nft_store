import { defineEventHandler } from 'h3'
import { ensureSchema, query } from '../../utils/db'
import { getActiveCollection } from '../../utils/collection'

export default defineEventHandler(async () => {
  const collection = await getActiveCollection()
  if (!collection) {
    return { buyers: [] }
  }
  await ensureSchema()
  const buyers = await query<any>`
    SELECT b.id, b.first_name, b.last_name, b.email, b.industry, b.interests,
           b.job_role, b.hedera_account_id, b.payment_transaction_id,
           b.nft_token_id, b.nft_serial, b.airdrop_transaction_id,
           b.delivery_status, b.created_at,
           i.name AS item_name, i.item_index
    FROM buyers b
    JOIN collection_items i ON i.id = b.item_id
    WHERE b.collection_id = ${collection.id}
    ORDER BY b.created_at DESC
  `
  return { buyers }
})
