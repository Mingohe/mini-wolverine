import type { Credentials } from '@/types'

const STORAGE_KEYS = {
  CREDENTIALS: 'mini-wolverine-credentials'
}

export const loadCredentials = (): Credentials => {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.CREDENTIALS)
    if (stored) {
      const credentials = JSON.parse(stored)
      return {
        url: credentials.url || '',
        token: credentials.token || ''
      }
    }
  } catch (error) {
    console.error('Failed to load credentials:', error)
  }
  
  return { url: '', token: '' }
}

export const saveCredentials = (url: string, token: string): boolean => {
  try {
    const credentials = { url: url || '', token: token || '' }
    localStorage.setItem(STORAGE_KEYS.CREDENTIALS, JSON.stringify(credentials))
    return true
  } catch (error) {
    console.error('Failed to save credentials:', error)
    return false
  }
}

export const clearCredentials = (): boolean => {
  try {
    localStorage.removeItem(STORAGE_KEYS.CREDENTIALS)
    return true
  } catch (error) {
    console.error('Failed to clear credentials:', error)
    return false
  }
}
