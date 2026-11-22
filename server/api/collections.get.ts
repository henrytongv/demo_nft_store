import { defineEventHandler } from 'h3'
import { getActiveCollection } from '../utils/collection'

export default defineEventHandler(async () => {
  return { collection: await getActiveCollection() }
})
