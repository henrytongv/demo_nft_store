import { requireAdmin } from '../utils/adminAuth'

export default defineEventHandler((event) => {
  const path = event.path || event.node.req.url || ''
  if (path.startsWith('/api/admin/') && path !== '/api/admin/login') {
    requireAdmin(event)
  }
})
