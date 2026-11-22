import { defineEventHandler } from 'h3'

export default defineEventHandler(() => {
  return {
    walletConnectProjectId: process.env.WALLETCONNECT_PROJECT_ID || '',
    operatorId: process.env.OPERATOR_ID || '',
    network: 'testnet'
  }
})
