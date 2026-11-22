import { defineEventHandler } from 'h3'
import { getActiveCollection } from '../../utils/collection'
import { ensureSchema, query } from '../../utils/db'

export default defineEventHandler(async () => {
  const collection = await getActiveCollection()
  let buyersCount = 0
  if (collection) {
    await ensureSchema()
    const rows = await query<any>`SELECT COUNT(*)::int AS count FROM buyers WHERE collection_id = ${collection.id}`
    buyersCount = Number(rows[0]?.count || 0)
  }
  return { collection, buyersCount }
})
