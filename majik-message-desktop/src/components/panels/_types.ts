export interface SignerInfo {
  signerId: string
  signerLabel?: string // contact label if known, undefined if not
  isOwnAccount: boolean
  isKnownContact: boolean
}

export type SignatureVerdict = 'valid' | 'invalid' | 'unsigned' | 'unverified'

export interface DecryptSignatureStatus {
  verdict: SignatureVerdict
  signerId?: string
  signerLabel?: string
  isOwnAccount?: boolean
  isKnownContact?: boolean
  timestamp?: string
  contentType?: string
}

export interface EncryptResult {
  binary: Blob
  signedBinary: Blob
  originalName: string
  originalSize: number
  encryptedSize: number
  hash: string
  effectiveCompressionLevel?: number
  /** Populated when the file was signed during encryption. */
  signerInfo?: SignerInfo | null
}

export interface DecryptResult {
  binary: Blob
  originalName: string
  originalSize: number
  mimeType: string
  /** Deserialized signature from the .mjkb metadata, if present. */
  signatureStatus?: DecryptSignatureStatus | null
}
