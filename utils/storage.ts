import AsyncStorage from '@react-native-async-storage/async-storage'
import * as SecureStore from 'expo-secure-store'
import uuid from 'react-native-uuid'

export const STORAGE_KEYS = {
  GUEST_ID: 'guestId',
  AUTH_TOKEN: 'authToken',
  DEVICE_TOKEN: 'deviceToken',
  ONBOARDING_COMPLETED: 'onboardingCompleted',
  NOTIFICATION_PERMISSION_ASKED: 'notificationPermissionAsked',
}
let guestIdPromise: Promise<string> | null = null

export function getGuestId(): Promise<string> {
  if (!guestIdPromise) {
    guestIdPromise = (async () => {
      try {
        let guestId = await AsyncStorage.getItem(STORAGE_KEYS.GUEST_ID)
        if (!guestId) {
          guestId = `guest_${uuid.v4()}`
          await AsyncStorage.setItem(STORAGE_KEYS.GUEST_ID, guestId)
        }
        return guestId
      } catch (error) {
        guestIdPromise = null // Reset to allow retry
        throw error
      }
    })()
  }
  return guestIdPromise
}
export async function setAuthToken(token: string) {
  try {
    await SecureStore.setItemAsync(STORAGE_KEYS.AUTH_TOKEN, token)
  } catch (error) {
    console.error('[setAuthToken] Failed to store auth token securely:', error)
    throw new Error('Failed to securely store authentication token')
  }
}

export async function getAuthToken(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(STORAGE_KEYS.AUTH_TOKEN)
  } catch (error) {
    console.error('[getAuthToken] Failed to retrieve auth token from secure store:', error)
    return null
  }
}

export async function clearAuthToken() {
  try {
    await SecureStore.deleteItemAsync(STORAGE_KEYS.AUTH_TOKEN)
  } catch (error) {
    console.error('[clearAuthToken] Failed to delete auth token from secure store:', error)
    throw new Error('Failed to clear authentication token')
  }
}

export async function setOnboardingCompleted() {
  await AsyncStorage.setItem(STORAGE_KEYS.ONBOARDING_COMPLETED, 'true')
}

export async function isOnboardingCompleted(): Promise<boolean> {
  const completed = await AsyncStorage.getItem(STORAGE_KEYS.ONBOARDING_COMPLETED)
  return completed === 'true'
}

export async function setNotificationPermissionAsked() {
  await AsyncStorage.setItem(STORAGE_KEYS.NOTIFICATION_PERMISSION_ASKED, 'true')
}

export async function wasNotificationPermissionAsked(): Promise<boolean> {
  const asked = await AsyncStorage.getItem(STORAGE_KEYS.NOTIFICATION_PERMISSION_ASKED)
  return asked === 'true'
}