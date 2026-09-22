// app/contexts/ThemeContext.tsx
import React, { createContext, useContext } from "react";

export const Colors = {
  background: {
    primary: "#0B0B10",
    secondary: "#131318",
    card: "#131318",
    elevated: "#1A1A22",
  },
  // Radial glow behind screen content — magenta/pink fading through violet to
  // the near-black base. React Native has no CSS radial-gradient, so screens
  // approximate it with a tall vertical LinearGradient pinned to the top.
  gradient: {
    primary: ["#7C3AED", "#3B82F6"] as readonly string[],
    secondary: ["#7C3AED", "#06B6D4"] as readonly string[],
    success: ["#10B981", "#34D399"] as readonly string[],
    danger: ["#EF4444", "#FB7185"] as readonly string[],
    warning: ["#F59E0B", "#F97316"] as readonly string[],
    accent: ["#7C3AED", "#3B82F6"] as readonly string[],
    canceled: ["#6B7280", "#374151"] as readonly string[],
    silent: ["#4B4B58", "#6B6B78"] as readonly string[],
    // Trial Guard hero card — pink -> violet -> blue, 3-stop.
    guard: ["#C026D3", "#7C3AED", "#3B82F6"] as readonly string[],
    // App mark icon (Login/Signup) — pink -> purple.
    mark: ["#C026D3", "#7C3AED"] as readonly string[],
    // Page background glow, top of screen fading to the base dark color.
    pageGlow: ["#3B1140", "#1C1030", "#0B0B10"] as readonly string[],
  },
  accent: {
    primary: "#3B82F6",
    secondary: "#7C3AED",
    dark: "#0B0B10",
    purple: "#A855F7",
    blue: "#3B82F6",
    green: "#34D399",
    pink: "#EC4899",
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
    info: "#3B82F6",
  },
  border: {
    default: "rgba(255,255,255,0.14)",
    light: "rgba(255,255,255,0.07)",
  },
  badge: {
    silent: "#8B8B99",
    silentBg: "rgba(139, 139, 153, 0.14)",
    worthIt: "#34D399",
    worthItBg: "rgba(52, 211, 153, 0.14)",
    fairValue: "#818CF8",
    fairValueBg: "rgba(129, 140, 248, 0.14)",
    overpriced: "#F59E0B",
    overpricedBg: "rgba(245, 158, 11, 0.14)",
    unused: "#8B8B99",
    unusedBg: "rgba(139, 139, 153, 0.14)",
  },
  shadow: {
    small: "rgba(0, 0, 0, 0.3)",
    medium: "rgba(0, 0, 0, 0.4)",
    large: "rgba(59, 130, 246, 0.35)",
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
