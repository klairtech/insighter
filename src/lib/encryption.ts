import crypto from 'crypto'

// Encryption configuration
const ALGORITHM = 'aes-256-gcm'
const KEY_LENGTH = 32 // 256 bits
const IV_LENGTH = 16 // 128 bits
const TAG_LENGTH = 16 // 128 bits

/**
 * Generate a random encryption key (for initial setup)
 */
export function generateEncryptionKey(): string {
  return crypto.randomBytes(KEY_LENGTH).toString('hex')
}

/**
 * Get encryption key from environment variables
 */
function getEncryptionKey(): Buffer {
  const key = process.env.CHAT_ENCRYPTION_KEY
  if (!key) {
    throw new Error('CHAT_ENCRYPTION_KEY environment variable is required')
  }
  
  // Convert hex string to buffer
  if (key.length !== KEY_LENGTH * 2) {
    throw new Error('CHAT_ENCRYPTION_KEY must be 64 characters (32 bytes) long')
  }
  
  return Buffer.from(key, 'hex')
}

/**
 * Encrypt text data
 */
export function encryptText(plaintext: string): string {
  try {
    const key = getEncryptionKey()
    const iv = crypto.randomBytes(IV_LENGTH)
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv)
    
    cipher.setAAD(Buffer.from('chat-message', 'utf8'))
    
    let encrypted = cipher.update(plaintext, 'utf8', 'hex')
    encrypted += cipher.final('hex')
    
    const tag = cipher.getAuthTag()
    
    // Combine IV + tag + encrypted data
    const combined = iv.toString('hex') + tag.toString('hex') + encrypted
    
    return combined
  } catch (error) {
    console.error('Encryption error:', error)
    throw new Error('Failed to encrypt message')
  }
}

/**
 * Decrypt text data
 */
export function decryptText(encryptedData: string): string {
  try {
    const key = getEncryptionKey()
    
    // Extract IV, tag, and encrypted data
    const ivHex = encryptedData.substring(0, IV_LENGTH * 2)
    const tagHex = encryptedData.substring(IV_LENGTH * 2, (IV_LENGTH + TAG_LENGTH) * 2)
    const encryptedHex = encryptedData.substring((IV_LENGTH + TAG_LENGTH) * 2)
    
    const iv = Buffer.from(ivHex, 'hex')
    const tag = Buffer.from(tagHex, 'hex')
    
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv)
    decipher.setAAD(Buffer.from('chat-message', 'utf8'))
    decipher.setAuthTag(tag)
    
    let decrypted = decipher.update(encryptedHex, 'hex', 'utf8')
    decrypted += decipher.final('utf8')
    
    return decrypted
  } catch (error) {
    console.error('Decryption error:', error)
    throw new Error('Failed to decrypt message')
  }
}

/**
 * Encrypt JSON object
 */
export function encryptObject(obj: Record<string, unknown>): string {
  const jsonString = JSON.stringify(obj)
  return encryptText(jsonString)
}

/**
 * Decrypt JSON object
 */
export function decryptObject<T = Record<string, unknown>>(encryptedData: string): T {
  const jsonString = decryptText(encryptedData)
  return JSON.parse(jsonString)
}

/**
 * Hash sensitive data for indexing (one-way hash)
 */
export function hashForIndex(data: string): string {
  return crypto.createHash('sha256').update(data).digest('hex')
}

/**
 * Validate encryption key format
 */
export function validateEncryptionKey(key: string): boolean {
  return /^[a-fA-F0-9]{64}$/.test(key)
}

/**
 * Generate a secure random salt
 */
export function generateSalt(): string {
  return crypto.randomBytes(16).toString('hex')
}

/**
 * Hash with salt for additional security
 */
export function hashWithSalt(data: string, salt: string): string {
  return crypto.createHash('sha256').update(data + salt).digest('hex')
}
