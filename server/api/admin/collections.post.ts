import { defineEventHandler, readMultipartFormData, setResponseStatus } from 'h3'
import { ensureSchema, getSql, uuid } from '../../utils/db'
import { pinJsonToIpfs, pinPngToIpfs } from '../../utils/pinata'
import { createNftCollection } from '../../utils/hedera'
import { apiErrorResponse, apiErrorFromException } from '../../utils/api'

const MAX_NFT_TYPES = 5
const DEFAULT_QUANTITY = 30
const MAX_PNG_BYTES = 8 * 1024 * 1024

export default defineEventHandler(async (event) => {
  try {
    const parts = await readMultipartFormData(event)
    if (!parts || parts.length === 0) {
      return apiErrorResponse(event, 400, 'invalid_form')
    }

    const fields = new Map<string, string>()
    const files = new Map<string, any>()
    for (const part of parts) {
      if (!part.name) continue
      if (part.filename) {
        files.set(part.name, part)
      } else {
        fields.set(part.name, part.data.toString('utf8'))
      }
    }

    const description = (fields.get('description') || '').trim()
    if (!description) {
      return apiErrorResponse(event, 400, 'description_required')
    }

    const itemIndexes = new Set<number>()
    for (const key of fields.keys()) {
      const match = key.match(/^name(\d+)$/)
      if (match) itemIndexes.add(Number(match[1]))
    }
    for (const key of files.keys()) {
      const match = key.match(/^file(\d+)$/)
      if (match) itemIndexes.add(Number(match[1]))
    }
    const sortedIndexes = Array.from(itemIndexes).sort((a, b) => a - b)
    if (sortedIndexes.length < 1 || sortedIndexes.length > MAX_NFT_TYPES) {
      return apiErrorResponse(event, 400, 'item_count_invalid')
    }

    const preparedItems: Array<{ name: string; imageCid: string; metadataCid: string }> = []
    for (const index of sortedIndexes) {
      const name = (fields.get(`name${index}`) || '').trim()
      const file = files.get(`file${index}`)
      if (!name || !file?.data) {
        return apiErrorResponse(event, 400, 'item_required')
      }
      if (!file.filename?.toLowerCase().endsWith('.png') || file.type !== 'image/png') {
        return apiErrorResponse(event, 400, 'png_required')
      }
      if (file.data.length > MAX_PNG_BYTES) {
        return apiErrorResponse(event, 400, 'png_too_large')
      }

      const imageCid = await pinPngToIpfs(file.data, file.filename || `nft-${index + 1}.png`)
      if (!imageCid) {
        return apiErrorResponse(event, 502, 'image_pin_failed')
      }

      const metadataCid = await pinJsonToIpfs(
        {
          name,
          creator: 'Tienda del aventurero',
          description,
          image: `ipfs://${imageCid}`,
          type: 'image/png'
        },
        `${name}-metadata.json`
      )
      if (!metadataCid) {
        return apiErrorResponse(event, 502, 'metadata_pin_failed')
      }

      preparedItems.push({ name, imageCid, metadataCid })
    }

    const minted = await createNftCollection({
      description,
      items: preparedItems.map((item) => ({
        name: item.name,
        metadataCid: item.metadataCid,
        quantity: DEFAULT_QUANTITY
      }))
    })

    await ensureSchema()
    const collectionId = uuid()
    const sql = getSql() as any
    await sql.transaction((txn: any) => [
      txn`UPDATE collections SET is_active = false WHERE is_active = true`,
      txn`
        INSERT INTO collections (id, name, description, token_id, token_symbol, is_active)
        VALUES (${collectionId}, 'Tienda del aventurero', ${description}, ${minted.tokenId}, 'AVENTURA', true)
      `,
      ...preparedItems.map((item, index) => {
        const range = minted.items[index]
        return txn`
          INSERT INTO collection_items (
            collection_id, item_index, name, description, image_cid, metadata_cid,
            quantity, remaining, sold_count, serial_start, serial_end
          ) VALUES (
            ${collectionId}, ${index}, ${item.name}, ${description}, ${item.imageCid}, ${item.metadataCid},
            ${range.quantity}, ${range.quantity}, 0, ${range.serialStart}, ${range.serialEnd}
          )
        `
      })
    ])

    setResponseStatus(event, 201)
    return { ok: true, collectionId, tokenId: minted.tokenId }
  } catch (error) {
    return apiErrorFromException(event, error)
  }
})
