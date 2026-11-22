import { Buffer } from 'buffer'

let connector: any = null

function safeToString(value: any): string {
  if (value == null) return ''
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') {
    return String(value)
  }
  try {
    if (typeof value.toString === 'function') {
      const asString = value.toString()
      if (typeof asString === 'string') return asString
    }
  } catch {
    // fall through to JSON
  }
  try {
    return JSON.stringify(value)
  } catch {
    return ''
  }
}

function normalizeTransactionId(value: any): string {
  if (value == null) return ''
  if (typeof value === 'string') return value.trim()
  if (typeof value !== 'object') return safeToString(value)

  if (value.transactionId != null) {
    return normalizeTransactionId(value.transactionId)
  }

  const account = value.accountId
  const accountString =
    typeof account === 'string'
      ? account
      : account && typeof account === 'object'
        ? `${account.shard ?? 0}.${account.realm ?? 0}.${account.num ?? account.accountNum ?? ''}`
        : ''
  const validStart = value.validStart || value.valid_start || {}
  const seconds = safeToString(validStart.seconds ?? validStart.secondsLow ?? '')
  const nanos = safeToString(validStart.nanos ?? validStart.nanosLow ?? '').padStart(9, '0')
  if (accountString && seconds) {
    return `${accountString}-${seconds}-${nanos}`
  }

  return safeToString(value)
}

export function useWallet() {
  const accountId = useState<string>('hederaAccountId', () => '')
  const connecting = useState<boolean>('hederaConnecting', () => false)
  const publicConfig = useState<any>('hederaPublicConfig', () => null)

  async function ensureConfig() {
    if (!publicConfig.value) {
      publicConfig.value = await $fetch('/api/public-config')
    }
    return publicConfig.value
  }

  async function loadSdk() {
    ;(globalThis as any).Buffer = Buffer
    const [hwc, sdk] = await Promise.all([
      import('@hashgraph/hedera-wallet-connect'),
      import('@hiero-ledger/sdk')
    ])
    return { hwc, sdk }
  }

  async function connect() {
    if (accountId.value) return accountId.value
    connecting.value = true
    try {
      const config = await ensureConfig()
      if (!config?.walletConnectProjectId) {
        throw new Error('wallet_not_configured')
      }
      const { hwc, sdk } = await loadSdk()

      if (!connector) {
        connector = new hwc.DAppConnector(
          {
            name: 'Tienda del aventurero',
            description: 'Tienda educativa de NFTs en Hedera Testnet',
            url: window.location.origin,
            icons: []
          },
          sdk.LedgerId.TESTNET,
          config.walletConnectProjectId,
          Object.values(hwc.HederaJsonRpcMethod),
          [hwc.HederaSessionEvent.ChainChanged, hwc.HederaSessionEvent.AccountsChanged],
          [hwc.HederaChainId.Testnet],
          'debug'
        )
        await connector.init({ logger: 'error' })
        await new Promise((resolve) => setTimeout(resolve, 700))
      }

      if (connector.signers?.length) {
        accountId.value = connector.signers[0].getAccountId().toString()
        return accountId.value
      }

      const extensions = connector.extensions || []
      const extension =
        extensions.find((entry: any) => entry.available && String(entry.id).toLowerCase().includes('hashpack')) ||
        extensions.find((entry: any) => entry.available && !entry.availableInIframe) ||
        extensions.find((entry: any) => entry.available)

      const session = extension
        ? await connector.connectExtension(extension.id)
        : await connector.openModal()

      const accounts = hwc.accountAndLedgerFromSession(session)
      accountId.value = accounts[0].account.toString()
      return accountId.value
    } finally {
      connecting.value = false
    }
  }

  async function payOneHbar() {
    if (!accountId.value) {
      throw new Error('wallet_not_connected')
    }
    const config = await ensureConfig()
    if (!config?.operatorId) {
      throw new Error('operator_not_configured')
    }
    const { hwc, sdk } = await loadSdk()
    const client = await sdk.Client.forTestnetAsync({ scheduleNetworkUpdate: false })
    client.setMaxNodesPerTransaction?.(1)
    const payer = sdk.AccountId.fromString(accountId.value)
    const recipient = sdk.AccountId.fromString(config.operatorId)

    const transaction = new sdk.TransferTransaction()
      .addHbarTransfer(payer, new sdk.Hbar(-1))
      .addHbarTransfer(recipient, new sdk.Hbar(1))
      .setTransactionMemo('tienda-aventurero')
      .setMaxTransactionFee(new sdk.Hbar(1))
    transaction.setTransactionId(sdk.TransactionId.generate(payer))
    transaction.freezeWith(client)
    console.debug('[useWallet] frozen transaction', transaction.transactionId?.toString?.())

    const encoded = hwc.transactionToBase64String(transaction)
    console.debug('[useWallet] encoded transaction length', encoded.length)
    const response = await connector.signAndExecuteTransaction({
      signerAccountId: `hedera:testnet:${accountId.value}`,
      transactionList: encoded
    })
    console.debug('[useWallet] signAndExecuteTransaction response', response)
    const transactionId = normalizeTransactionId(
      response?.result?.transactionId ?? response?.result ?? response?.transactionId ?? response
    )
    if (!transactionId) {
      throw new Error('missing_transaction_id')
    }
    return transactionId
  }

  async function disconnect() {
    if (connector) {
      await connector.disconnectAll().catch(() => undefined)
      connector = null
    }
    accountId.value = ''
  }

  return {
    accountId,
    connecting,
    connect,
    payOneHbar,
    disconnect
  }
}
