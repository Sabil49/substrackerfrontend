// app/constants/theme.ts
export const Colors = {
  background: {
    primary: "#0B0B10",
    secondary: "#131318",
    card: "#131318",
    elevated: "#1A1A22",
  },
  accent: {
    gold: "#3B82F6",
    secondary: "#7C3AED",
    dark: "#0B0B10",
  },
  text: {
    primary: "#FFFFFF",
    secondary: "#C9C9D3",
    muted: "#8B8B99",
    disabled: "#6B6B78",
  },
  status: {
    success: "#34D399",
    warning: "#F59E0B",
    error: "#F87171",
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
  small: 10,
  medium: 18,
  large: 26,
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

// Maps any category text (e.g. from a scanned receipt) onto one of ours.
const CATEGORY_ALIASES: Record<string, string> = {
  software: "work",
  productivity: "work",
  business: "work",
  ai: "work",
  education: "work",
  streaming: "entertainment",
  music: "entertainment",
  video: "entertainment",
  gaming: "entertainment",
  games: "entertainment",
  news: "entertainment",
  cloud: "storage",
  backup: "storage",
  gym: "fitness",
  sports: "fitness",
  medical: "health",
  wellness: "health",
  meditation: "health",
  retail: "shopping",
  delivery: "shopping",
  food: "shopping",
};

export function normalizeCategory(raw?: string | null): string {
  const key = (raw ?? "").trim().toLowerCase();
  if (!key) return "other";
  if (Categories.some((cat) => cat.id === key)) return key;
  return CATEGORY_ALIASES[key] ?? "other";
}

// "🎬 Entertainment" for our categories; anything else just capitalized.
export function categoryLabel(raw?: string | null): string {
  const key = (raw ?? "").trim().toLowerCase();
  const known = Categories.find((cat) => cat.id === key);
  if (known) return `${known.icon} ${known.name}`;
  if (!key) return "📱 Other";
  return key.charAt(0).toUpperCase() + key.slice(1);
}

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
