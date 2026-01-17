import React from 'react'
import { View, StyleSheet, ViewStyle } from 'react-native'
import { Colors, BorderRadius, Spacing } from '@/constants/theme'

interface CardProps {
  children: React.ReactNode
  style?: ViewStyle
  elevated?: boolean
  highlighted?: boolean
}

export default function Card({ children, style, elevated = false, highlighted = false }: CardProps) {
  return (
    <View
      style={[
        styles.card,
        elevated && styles.elevated,
        highlighted && styles.highlighted,
        style,
      ]}
    >
      {children}
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.background.card,
    borderRadius: BorderRadius.large,
    padding: Spacing.m,
    borderWidth: 1.5,
    borderColor: 'transparent',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 24,
    elevation: 8,
  },
  elevated: {
    backgroundColor: Colors.background.elevated,
  },
  highlighted: {
    borderColor: Colors.accent.gold,
  },
})