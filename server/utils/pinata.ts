import { createError } from 'h3'

const PINATA_FILE_URL = 'https://api.pinata.cloud/pinning/pinFileToIPFS'
const PINATA_JSON_URL = 'https://api.pinata.cloud/pinning/pinJSONToIPFS'

function pinataJwt() {
  const jwt = process.env.PINATA_JWT
  if (!jwt) {
    throw createError({ statusCode: 500, statusMessage: 'pinata_not_configured' })
  }
  return jwt
}

async function pinataFetch(url: string, init: RequestInit) {
  const response = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${pinataJwt()}`,
      ...(init.headers || {})
    }
  })
  if (!response.ok) {
    const body = await response.text().catch(() => '')
    throw createError({
      statusCode: 502,
      statusMessage: 'pinata_upload_failed',
      data: { detail: body.slice(0, 300) }
    })
  }
  return response.json()
}

export async function pinPngToIpfs(data: Buffer, filename: string) {
  const form = new FormData()
  form.append('file', new Blob([new Uint8Array(data)], { type: 'image/png' }), filename || 'nft.png')
  form.append('pinataMetadata', JSON.stringify({ name: filename || 'nft.png' }))
  form.append('pinataOptions', JSON.stringify({ cidVersion: 1 }))
  const result = await pinataFetch(PINATA_FILE_URL, { method: 'POST', body: form })
  return String(result.IpfsHash || '')
}

export async function pinJsonToIpfs(payload: Record<string, unknown>, name: string) {
  const result = await pinataFetch(PINATA_JSON_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      pinataContent: payload,
      pinataMetadata: { name },
      pinataOptions: { cidVersion: 1 }
    })
  })
  return String(result.IpfsHash || '')
}

export function ipfsHttpUrl(cid: string) {
  const clean = cid.replace(/^ipfs:\/\//, '').replace(/^\/ipfs\//, '')
  return `https://gateway.pinata.cloud/ipfs/${clean}`
}
