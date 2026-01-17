export const Colors = {
  background: {
    primary: '#0B0B0E',
    secondary: '#121214',
    card: '#1A1A1E',
    elevated: '#0F0F12',
  },
  accent: {
    gold: '#F5B65A',
    secondary: '#E58B2A',
    dark: '#C86A12',
  },
  text: {
    primary: '#FFFFFF',
    secondary: '#A1A1A6',
    muted: '#7C7C80',
    disabled: '#5A5A5F',
  },
  status: {
    success: '#3ED598',
    warning: '#F5B65A',
    error: '#FF6B6B',
  },
}

export const Spacing = {
  xs: 4,
  s: 8,
  m: 16,
  l: 24,
  xl: 32,
}

export const BorderRadius = {
  small: 8,
  medium: 16,
  large: 20,
}

export const Typography = {
  title: {
    fontSize: 28,
    fontWeight: '700' as const,
    color: Colors.text.primary,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: Colors.text.primary,
  },
  body: {
    fontSize: 15,
    fontWeight: '400' as const,
    color: Colors.text.primary,
  },
  secondary: {
    fontSize: 13,
    fontWeight: '400' as const,
    color: Colors.text.secondary,
  },
  caption: {
    fontSize: 11,
    fontWeight: '500' as const,
    color: Colors.text.muted,
  },
  price: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.accent.primary,
  },
}

export const Categories = [
  { id: 'entertainment', name: 'Entertainment', icon: '🎬' },
  { id: 'work', name: 'Work', icon: '💼' },
  { id: 'fitness', name: 'Fitness', icon: '🏋️' },
  { id: 'shopping', name: 'Shopping', icon: '🛍️' },
  { id: 'storage', name: 'Storage', icon: '☁️' },
  { id: 'health', name: 'Health', icon: '🏥' },
  { id: 'other', name: 'Other', icon: '📱' },
]

export const BillingCycles = [
  { id: 'weekly', name: 'Weekly', days: 7 },
  { id: 'monthly', name: 'Monthly', days: 30 },
  { id: 'yearly', name: 'Yearly', days: 365 },
  { id: 'custom', name: 'Custom', days: 0 },
]

export const NotificationOptions = [
  { days: 7, label: '7 days before' },
  { days: 3, label: '3 days before' },
  { days: 1, label: '1 day before' },
  { days: 0, label: 'On renewal day' },
]

export const Currencies = ['USD', 'EUR', 'GBP', 'INR', 'CAD', 'AUD', 'JPY', 'CNY']