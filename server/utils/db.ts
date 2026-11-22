import { neon } from '@neondatabase/serverless'
import { createError } from 'h3'

let sqlClient: ReturnType<typeof neon> | null = null
let schemaReady: Promise<void> | null = null

export function getSql() {
  if (!process.env.NEON_DB) {
    throw createError({ statusCode: 500, statusMessage: 'database_not_configured' })
  }
  if (!sqlClient) {
    sqlClient = neon(process.env.NEON_DB)
  }
  return sqlClient
}

export function ensureSchema() {
  if (!schemaReady) {
    schemaReady = (async () => {
      const sql = getSql()
      await sql`
        CREATE TABLE IF NOT EXISTS collections (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          name text NOT NULL DEFAULT 'Tienda del aventurero',
          description text NOT NULL DEFAULT '',
          token_id text,
          token_symbol text NOT NULL DEFAULT 'AVENTURA',
          is_active boolean NOT NULL DEFAULT false,
          created_at timestamptz NOT NULL DEFAULT now()
        )
      `
      await sql`
        CREATE TABLE IF NOT EXISTS collection_items (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          collection_id uuid NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
          item_index integer NOT NULL,
          name text NOT NULL,
          description text NOT NULL DEFAULT '',
          image_cid text NOT NULL,
          metadata_cid text NOT NULL,
          quantity integer NOT NULL DEFAULT 0,
          remaining integer NOT NULL DEFAULT 0,
          sold_count integer NOT NULL DEFAULT 0,
          serial_start integer,
          serial_end integer,
          created_at timestamptz NOT NULL DEFAULT now(),
          UNIQUE (collection_id, item_index)
        )
      `
      await sql`
        CREATE TABLE IF NOT EXISTS buyers (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          collection_id uuid NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
          item_id uuid NOT NULL REFERENCES collection_items(id) ON DELETE CASCADE,
          first_name text NOT NULL,
          last_name text NOT NULL,
          email text NOT NULL,
          industry text,
          interests text[],
          job_role text,
          hedera_account_id text NOT NULL,
          payment_transaction_id text NOT NULL UNIQUE,
          nft_token_id text NOT NULL,
          nft_serial integer NOT NULL,
          airdrop_transaction_id text,
          delivery_status text NOT NULL DEFAULT 'delivered',
          created_at timestamptz NOT NULL DEFAULT now()
        )
      `
      await sql`
        CREATE UNIQUE INDEX IF NOT EXISTS one_active_collection
        ON collections (is_active)
        WHERE is_active = true
      `
      await sql`
        CREATE INDEX IF NOT EXISTS buyers_collection_created_idx
        ON buyers (collection_id, created_at DESC)
      `
    })().catch((error) => {
      schemaReady = null
      throw error
    })
  }
  return schemaReady
}

export async function query<T = any>(strings: TemplateStringsArray, ...values: any[]): Promise<T[]> {
  await ensureSchema()
  const sql = getSql()
  return (await sql(strings, ...values)) as T[]
}

export function uuid() {
  return crypto.randomUUID()
}
