import { appendFile, mkdir } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'

const logPath = resolve(process.cwd(), 'logs', 'server-errors.log')
let writeQueue: Promise<void> = Promise.resolve()

export function logServerError(scope: string, error: any) {
  const entry = {
    time: new Date().toISOString(),
    scope,
    name: error?.name || 'Error',
    message: String(error?.message || error || 'unknown error'),
    stack: error?.stack ? String(error.stack) : undefined,
    statusCode: error?.statusCode || error?.status || undefined,
    statusMessage: error?.statusMessage || undefined,
    code: error?.code || error?.data?.code || undefined,
    cause: error?.cause ? String(error.cause?.message || error.cause) : undefined
  }

  console.error(`[server-error] ${scope}: ${entry.message}`)
  if (entry.stack) {
    console.error(entry.stack)
  }

  writeQueue = writeQueue
    .then(async () => {
      await mkdir(dirname(logPath), { recursive: true })
      await appendFile(logPath, `${JSON.stringify(entry)}\n`, 'utf8')
    })
    .catch(() => undefined)
}
