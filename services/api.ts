import axios from 'axios'
import AsyncStorage from '@react-native-async-storage/async-storage'

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000'

const api = axios.create({
  baseURL: `${API_URL}/api`,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
})

api.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem('authToken')
  const guestId = await AsyncStorage.getItem('guestId')
  
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  } else if (guestId) {
    if (config.method === 'get') {
      config.params = { ...config.params, guestId }
    } else {
      config.data = { ...config.data, guestId }
    }
  }
  
  return config
})

export interface Subscription {
  id: string
  name: string
  amount: number
  currency: string
  billingCycle: string
  customCycleDays?: number
  startDate: string
  nextBillingDate: string
  category?: string
  notes?: string
  iconUrl?: string
  color?: string
  isTrial: boolean
  trialEndDate?: string
  notifyDaysBefore: number[] | string
  isActive: boolean
  // New fields for features
  lastReviewedAt?: string
  isSilent?: boolean
  usageCount?: number
  lastUsedAt?: string
  valueScore?: 'worth-it' | 'overpriced' | 'unused'
  cancelUrl?: string
  cancelEmail?: string
  cancelSteps?: string
  isCanceled?: boolean
  canceledAt?: string
  cancelReason?: string
}

export interface Template {
  id: string
  name: string
  category: string
  iconUrl?: string
  color?: string
  avgPrice?: number
}

export interface Analytics {
  monthlyTotal: number
  yearlyTotal: number
  totalSubscriptions: number
  categoryBreakdown: Record<string, number>
  upcomingCharges: {
    id: string
    name: string
    amount: number
    currency: string
    nextBillingDate: string
    daysUntil: number
  }[]
  mostExpensive: {
    id: string
    name: string
    amount: number
    currency: string
  } | null
}

export interface User {
  id: string
  email?: string
  isPro: boolean
  proExpiresAt?: string
  subscriptionCount: number
  subscriptionLimit: number | null
}

export const subscriptionsApi = {
  getAll: async () => {
    const response = await api.get<{ subscriptions: Subscription[] }>('/subscriptions')
    return response.data.subscriptions
  },
  
  getOne: async (id: string) => {
    const guestId = await AsyncStorage.getItem('guestId')
    const config = guestId ? { params: { guestId } } : {}
    const response = await api.get<{ subscription: Subscription }>(`/subscriptions/${id}`, config)
    return response.data.subscription
  },
  
  create: async (data: Partial<Subscription>) => {
    let parsedNotifyDays = [7, 3, 1, 0]
    if (Array.isArray(data.notifyDaysBefore)) {
      parsedNotifyDays = data.notifyDaysBefore
    } else if (data.notifyDaysBefore) {
      try {
        const parsed = JSON.parse(data.notifyDaysBefore as string)
        if (Array.isArray(parsed) && parsed.every((n) => typeof n === 'number')) {
          parsedNotifyDays = parsed
        } else {
          console.warn('Invalid notifyDaysBefore format, using defaults')
        }
      } catch {
        console.warn('Invalid notifyDaysBefore format, using defaults')
      }
    }    const payload = {
      ...data,
      notifyDaysBefore: parsedNotifyDays
    }
    const response = await api.post<{ subscription: Subscription }>('/subscriptions', payload)
    return response.data.subscription
  },  
  update: async (id: string, data: Partial<Subscription>) => {
    const guestId = await AsyncStorage.getItem('guestId')
    const payload = guestId ? { ...data, guestId } : data
    const response = await api.patch<{ subscription: Subscription }>(`/subscriptions/${id}`, payload)
    return response.data.subscription
  },
  
  delete: async (id: string) => {
    const guestId = await AsyncStorage.getItem('guestId')
    const config = guestId ? { params: { guestId } } : {}
    await api.delete(`/subscriptions/${id}`, config)
  },

  // New feature methods
  markReviewed: async (id: string) => {
    const guestId = await AsyncStorage.getItem('guestId')
    const payload = { lastReviewedAt: new Date().toISOString(), isSilent: false }
    const data = guestId ? { ...payload, guestId } : payload
    const response = await api.patch<{ subscription: Subscription }>(`/subscriptions/${id}`, data)
    return response.data.subscription
  },

  logUsage: async (id: string) => {
    // Call server-side atomic increment endpoint to avoid race conditions
    // on concurrent calls that would lose increments with a client-side read-modify-write pattern
    const guestId = await AsyncStorage.getItem('guestId')
    const payload = guestId ? { guestId } : {}
    const response = await api.post<{ subscription: Subscription }>(`/subscriptions/${id}/log-usage`, payload)
    return response.data.subscription
  },

  cancel: async (id: string, reason?: string) => {
    const guestId = await AsyncStorage.getItem('guestId')
    const payload = { 
      isCanceled: true, 
      canceledAt: new Date().toISOString(),
      cancelReason: reason,
      isActive: false
    }
    const data = guestId ? { ...payload, guestId } : payload
    const response = await api.patch<{ subscription: Subscription }>(`/subscriptions/${id}`, data)
    return response.data.subscription
  },
}

export const analyticsApi = {
  get: async () => {
    const response = await api.get<Analytics>('/analytics')
    return response.data
  },
}

export const templatesApi = {
  getAll: async () => {
    const response = await api.get<{ templates: Template[] }>('/templates')
    return response.data.templates
  },
}

export const userApi = {
  get: async () => {
    const response = await api.get<{ user: User }>('/user')
    return response.data.user
  },
  
  update: async (data: Partial<User>) => {
    const response = await api.patch<{ user: User }>('/user', data)
    return response.data.user
  },
}

export const deviceApi = {
  register: async (deviceToken: string, platform: 'ios' | 'android') => {
    await api.post('/devices', { deviceToken, platform })
  },
  
  unregister: async (deviceToken: string) => {
    await api.delete('/devices', { params: { deviceToken } })
  },
}

export default api