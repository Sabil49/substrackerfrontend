// app/contexts/ThemeContext.tsx
import React, { createContext, useContext } from "react";

export const Colors = {
  background: {
    primary: "#F6F8FB",
    secondary: "#FFFFFF",
    card: "#FFFFFF",
    elevated: "#F0F4FF",
  },
  gradient: {
    primary: ["#4F46E5", "#06B6D4"] as readonly string[],
    secondary: ["#7C3AED", "#06B6D4"] as readonly string[],
    success: ["#10B981", "#34D399"] as readonly string[],
    danger: ["#EF4444", "#FB7185"] as readonly string[],
    warning: ["#F59E0B", "#F97316"] as readonly string[],
    accent: ["#06B6D4", "#3B82F6"] as readonly string[],
    canceled: ["#6B7280", "#374151"] as readonly string[],
    silent: ["#E5E7EB", "#F3F4F6"] as readonly string[],
  },
  accent: {
    primary: "#06B6D4",
    secondary: "#4F46E5",
    dark: "#0F172A",
    purple: "#7C3AED",
    blue: "#3B82F6",
    green: "#10B981",
    pink: "#EC4899",
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
    info: "#3B82F6",
  },
  border: {
    default: "#E6EEF8",
    light: "#F3F6FB",
  },
  badge: {
    silent: "#EF4444",
    silentBg: "rgba(239, 68, 68, 0.12)",
    worthIt: "#10B981",
    worthItBg: "rgba(16, 185, 129, 0.12)",
    fairValue: "#6366F1",
    fairValueBg: "rgba(99, 102, 241, 0.12)",
    overpriced: "#F59E0B",
    overpricedBg: "rgba(245, 158, 11, 0.12)",
    unused: "#6B7280",
    unusedBg: "rgba(107, 114, 128, 0.12)",
  },
  shadow: {
    small: "rgba(16, 24, 40, 0.04)",
    medium: "rgba(2, 6, 23, 0.08)",
    large: "rgba(2, 6, 23, 0.12)",
  },
};

interface ThemeContextType {
  colors: typeof Colors;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <ThemeContext.Provider value={{ colors: Colors }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return context;
}
