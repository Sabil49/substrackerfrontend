// app/constants/theme.ts
export const Colors = {
  background: {
    primary: "#F6F8FB",
    secondary: "#FFFFFF",
    card: "#FFFFFF",
    elevated: "#F0F4FF",
  },
  accent: {
    gold: "#06B6D4",
    secondary: "#4F46E5",
    dark: "#0F172A",
  },
  text: {
    primary: "#0F172A",
    secondary: "#4B5563",
    muted: "#6B7280",
    disabled: "#9CA3AF",
  },
  status: {
    success: "#10B981",
    warning: "#F59E0B",
    error: "#EF4444",
  },
};

export const Spacing = {
  xs: 4,
  s: 8,
  m: 16,
  l: 24,
  xl: 32,
};

export const BorderRadius = {
  small: 8,
  medium: 16,
  large: 20,
};

export const Typography = {
  title: {
    fontSize: 28,
    fontWeight: "700" as const,
    color: Colors.text.primary,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600" as const,
    color: Colors.text.primary,
  },
  body: {
    fontSize: 15,
    fontWeight: "400" as const,
    color: Colors.text.primary,
  },
  secondary: {
    fontSize: 13,
    fontWeight: "400" as const,
    color: Colors.text.secondary,
  },
  caption: {
    fontSize: 11,
    fontWeight: "500" as const,
    color: Colors.text.muted,
  },
  price: {
    fontSize: 16,
    fontWeight: "600" as const,
    color: Colors.accent.gold,
  },
};

export const Categories = [
  { id: "entertainment", name: "Entertainment", icon: "🎬" },
  { id: "work", name: "Work", icon: "💼" },
  { id: "fitness", name: "Fitness", icon: "🏋️" },
  { id: "shopping", name: "Shopping", icon: "🛍️" },
  { id: "storage", name: "Storage", icon: "☁️" },
  { id: "health", name: "Health", icon: "🏥" },
  { id: "other", name: "Other", icon: "📱" },
];

export const BillingCycles = [
  { id: "weekly", name: "Weekly", days: 7 },
  { id: "monthly", name: "Monthly", days: 30 },
  { id: "yearly", name: "Yearly", days: 365 },
  { id: "custom", name: "Custom", days: 0 },
];

export const NotificationOptions = [
  { days: 7, label: "7 days before" },
  { days: 3, label: "3 days before" },
  { days: 1, label: "1 day before" },
  { days: 0, label: "On renewal day" },
];

export const Currencies = [
  "USD",
  "EUR",
  "GBP",
  "INR",
  "CAD",
  "AUD",
  "JPY",
  "CNY",
];
