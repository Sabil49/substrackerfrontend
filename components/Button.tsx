// app/components/Button.tsx
import { BorderRadius, Typography } from "@/constants/theme";
import React from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TextStyle,
  TouchableOpacity,
  ViewStyle,
} from "react-native";
import { useTheme } from "@/contexts/ThemeContext";

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: "primary" | "secondary";
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
}

export default function Button({
  title,
  onPress,
  variant = "primary",
  disabled = false,
  loading = false,
  style,
  textStyle,
}: ButtonProps) {
  const { colors } = useTheme();

  if (variant === "primary") {
    return (
      <TouchableOpacity
        onPress={onPress}
        disabled={disabled || loading}
        style={[
          styles.button,
          { backgroundColor: colors.accent.primary },
          disabled && styles.disabled,
          style,
        ]}
        activeOpacity={0.85}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={[styles.primaryText, textStyle]}>{title}</Text>
        )}
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      style={[
        styles.button,
        styles.secondaryButton,
        { borderColor: colors.border.default },
        disabled && styles.disabled,
        style,
      ]}
      activeOpacity={0.8}
    >
      {loading ? (
        <ActivityIndicator color={colors.text.secondary} />
      ) : (
        <Text
          style={[styles.secondaryText, { color: colors.text.secondary }, textStyle]}
        >
          {title}
        </Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    height: 56,
    borderRadius: BorderRadius.medium,
    justifyContent: "center",
    alignItems: "center",
  },
  primaryText: {
    ...Typography.body,
    fontWeight: "800",
    color: "#fff",
  },
  secondaryButton: {
    backgroundColor: "transparent",
    borderWidth: 1.5,
  },
  secondaryText: {
    ...Typography.body,
    fontWeight: "700",
  },
  disabled: {
    opacity: 0.5,
  },
});
