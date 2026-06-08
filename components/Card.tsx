// app/components/Card.tsx
import { BorderRadius, Spacing } from "@/constants/theme";
import React from "react";
import { StyleSheet, View, ViewStyle } from "react-native";
import { useTheme } from "@/contexts/ThemeContext";

interface CardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  elevated?: boolean;
  highlighted?: boolean;
}

export default function Card({
  children,
  style,
  elevated = false,
  highlighted = false,
}: CardProps) {
  const { colors } = useTheme();
  return (
    <View
      style={[
        styles.card,
        { backgroundColor: colors.background.card },
        elevated && { backgroundColor: colors.background.elevated },
        highlighted && { borderColor: colors.accent.primary },
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: BorderRadius.large,
    padding: Spacing.m,
    borderWidth: 1.5,
    borderColor: "transparent",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 24,
    elevation: 8,
  },
  elevated: {},
  highlighted: {},
});
