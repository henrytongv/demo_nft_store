import {
  AccountId,
  Client,
  Hbar,
  PrivateKey,
  TokenAirdropTransaction,
  TokenCreateTransaction,
  TokenId,
  TokenMintTransaction,
  TokenSupplyType,
  TokenType,
  TransactionId,
  TransferTransaction
} from '@hiero-ledger/sdk'
import { createError } from 'h3'

const HBAR_IN_TINYBARS = 100_000_000
const NFT_MINT_BATCH_SIZE = 10

let cachedClient: any = null

function requiredEnv(name: string) {
  const value = process.env[name]
  if (!value) {
    throw createError({ statusCode: 500, statusMessage: `${name.toLowerCase()}_not_configured` })
  }
  return value
}

export async function getHederaClient() {
  if (!cachedClient) {
    const client = await Client.forTestnetAsync({ scheduleNetworkUpdate: false })
    client.setOperator(requiredEnv('OPERATOR_ID'), PrivateKey.fromString(requiredEnv('OPERATOR_KEY')))
    cachedClient = client
  }
  return cachedClient
}

export function operatorAccountId() {
  return requiredEnv('OPERATOR_ID')
}

function truncateMemo(value: string, max = 100) {
  return value.length > max ? value.slice(0, max) : value
}

export async function createNftCollection(options: {
  description: string
  items: Array<{ name: string; metadataCid: string; quantity: number }>
}) {
  const client = await getHederaClient()
  const operatorId = operatorAccountId()
  const privateKey = PrivateKey.fromString(requiredEnv('OPERATOR_KEY'))
  const totalSupply = options.items.reduce((sum, item) => sum + item.quantity, 0)

  const createTx = await new TokenCreateTransaction()
    .setTokenName('Tienda del Aventurero')
    .setTokenSymbol('AVENTURA')
    .setDecimals(0)
    .setInitialSupply(0)
    .setMaxSupply(totalSupply)
    .setTreasuryAccountId(operatorId)
    .setAdminKey(privateKey)
    .setSupplyKey(privateKey)
    .setTokenMemo(truncateMemo(options.description || 'Colección educativa NFT en Hedera Testnet'))
    .setTokenType(TokenType.NonFungibleUnique)
    .setSupplyType(TokenSupplyType.Finite)
    .setFreezeDefault(false)
    .setMaxTransactionFee(new Hbar(50))
    .execute(client)

  const createReceipt = await createTx.getReceipt(client)
  const tokenId = createReceipt.tokenId?.toString()
  if (!tokenId) {
    throw createError({ statusCode: 502, statusMessage: 'hedera_token_id_missing' })
  }

  const mintedItems: Array<{ itemIndex: number; serialStart: number; serialEnd: number; quantity: number }> = []

  for (const [index, item] of options.items.entries()) {
    const serials: number[] = []
    const metadataUri = `ipfs://${item.metadataCid}`
    const metadataBytes = new TextEncoder().encode(metadataUri)
    if (metadataBytes.length > 100) {
      throw createError({ statusCode: 400, statusMessage: 'metadata_uri_too_long' })
    }

    for (let start = 0; start < item.quantity; start += NFT_MINT_BATCH_SIZE) {
      const chunkSize = Math.min(NFT_MINT_BATCH_SIZE, item.quantity - start)
      const mintTx = new TokenMintTransaction()
        .setTokenId(tokenId)
        .setMaxTransactionFee(new Hbar(25))
      for (let i = 0; i < chunkSize; i++) {
        mintTx.addMetadata(metadataBytes)
      }
      const mintResponse = await mintTx.execute(client)
      const mintReceipt = await mintResponse.getReceipt(client)
      serials.push(...(mintReceipt.serials || []).map((serial: any) => Number(serial.toString())))
    }

    serials.sort((a, b) => a - b)
    if (serials.length !== item.quantity) {
      throw createError({ statusCode: 502, statusMessage: 'hedera_mint_incomplete' })
    }
    mintedItems.push({
      itemIndex: index,
      serialStart: serials[0],
      serialEnd: serials[serials.length - 1],
      quantity: serials.length
    })
  }

  return { tokenId, items: mintedItems }
}

export async function airdropNft(options: {
  tokenId: string
  serial: number
  receiverAccountId: string
}) {
  const client = await getHederaClient()
  const operatorId = operatorAccountId()
  const tokenId = TokenId.fromString(options.tokenId)

  const tx = new TokenAirdropTransaction()
    .addNftTransfer(tokenId, options.serial, operatorId, options.receiverAccountId)
    .setTransactionMemo('tienda-aventurero')
    .setMaxTransactionFee(new Hbar(5))

  const txResponse = await tx.execute(client)
  const record = await txResponse.getRecord(client).catch(() => null)
  const pending = (record?.newPendingAirdrops?.length || 0) > 0

  return {
    transactionId: txResponse.transactionId.toString(),
    pending
  }
}

export function toMirrorTransactionId(transactionId: string) {
  const value = transactionId.trim()
  if (value.includes('@')) {
    const [account, timestamp] = value.split('@')
    const cleanTimestamp = timestamp.split('?')[0].split('/')[0]
    const [seconds, nanos = '0'] = cleanTimestamp.split('.')
    return `${account}-${seconds}-${nanos.padStart(9, '0')}`
  }
  return value
}

export async function verifyHbarPayment(options: {
  transactionId: string
  payerAccountId: string
}) {
  const mirrorId = toMirrorTransactionId(options.transactionId)
  const url = `https://testnet.mirrornode.hedera.com/api/v1/transactions/${encodeURIComponent(mirrorId)}`

  let body: any = null
  for (let attempt = 0; attempt < 6; attempt++) {
    const response = await fetch(url, {
      headers: { accept: 'application/json' }
    })
    if (response.ok) {
      body = await response.json()
      break
    }
    if (attempt < 5) {
      await new Promise((resolve) => setTimeout(resolve, 2000))
    }
  }
  if (!body) {
    throw createError({ statusCode: 400, statusMessage: 'payment_not_found' })
  }
  const tx = Array.isArray(body) ? body[0] : Array.isArray(body?.transactions) ? body.transactions[0] : body
  if (!tx) {
    throw createError({ statusCode: 400, statusMessage: 'payment_not_found' })
  }
  if (tx.result !== 'SUCCESS' || tx.name !== 'CRYPTOTRANSFER') {
    throw createError({ statusCode: 400, statusMessage: 'payment_failed' })
  }

  const received = (tx.transfers || []).some((transfer: any) => {
    return transfer.account === operatorAccountId() && Number(transfer.amount) === HBAR_IN_TINYBARS
  })
  if (!received) {
    throw createError({ statusCode: 400, statusMessage: 'payment_amount_invalid' })
  }

  const payerFromTx = String(tx.transaction_id || '').split('-')[0]
  if (options.payerAccountId && payerFromTx && payerFromTx !== options.payerAccountId) {
    throw createError({ statusCode: 400, statusMessage: 'payment_payer_mismatch' })
  }

  return {
    mirrorTransactionId: String(tx.transaction_id || mirrorId),
    payerAccountId: payerFromTx || options.payerAccountId
  }
}

export async function buildPaymentTransaction(options: {
  payerAccountId: string
  recipientAccountId: string
}) {
  const client = await Client.forTestnetAsync()
  const transaction = new TransferTransaction()
    .addHbarTransfer(options.payerAccountId, new Hbar(-1))
    .addHbarTransfer(options.recipientAccountId, new Hbar(1))
    .setTransactionMemo('tienda-aventurero')
    .setMaxTransactionFee(new Hbar(2))
  transaction.setTransactionId(TransactionId.generate(AccountId.fromString(options.payerAccountId)))
  transaction.freezeWith(client)
  return transaction
}
