import { ensureSchema, query } from './db'
import { ipfsHttpUrl } from './pinata'

export async function getActiveCollection() {
  await ensureSchema()
  const collections = await query<any>`
    SELECT id, name, description, token_id, token_symbol, created_at
    FROM collections
    WHERE is_active = true
    LIMIT 1
  `
  const collection = collections[0]
  if (!collection) return null

  const items = await query<any>`
    SELECT id, item_index, name, description, image_cid, metadata_cid,
           quantity, remaining, sold_count, serial_start, serial_end
    FROM collection_items
    WHERE collection_id = ${collection.id}
    ORDER BY item_index ASC
  `

  return {
    id: collection.id,
    name: collection.name,
    description: collection.description,
    tokenId: collection.token_id,
    tokenSymbol: collection.token_symbol,
    createdAt: collection.created_at,
    hashscanUrl: collection.token_id ? `https://hashscan.io/testnet/token/${collection.token_id}` : null,
    items: items.map((item: any) => ({
      id: item.id,
      itemIndex: item.item_index,
      name: item.name,
      description: item.description,
      imageUrl: ipfsHttpUrl(item.image_cid),
      quantity: item.quantity,
      remaining: item.remaining,
      soldCount: item.sold_count,
      serialStart: item.serial_start,
      serialEnd: item.serial_end
    }))
  }
}
