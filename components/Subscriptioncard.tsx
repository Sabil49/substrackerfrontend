import React, { useRef } from 'react'
import { View, Text, StyleSheet, TouchableOpacity, Animated } from 'react-native'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { LinearGradient } from 'expo-linear-gradient'
import { useTheme } from '@/contexts/ThemeContext'
import { Subscription } from '@/services/api'
import { formatCurrency, formatDate, getDaysUntil } from '@/utils/date'

interface SubscriptionCardProps {
  subscription: Subscription
}

export default function SubscriptionCard({ subscription }: SubscriptionCardProps) {
  const router = useRouter()
  const { colors } = useTheme()
  const scaleAnim = useRef(new Animated.Value(1)).current

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.97,
      useNativeDriver: true,
    }).start()
  }

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      friction: 3,
      useNativeDriver: true,
    }).start()
  }

  const daysUntil = getDaysUntil(subscription.nextBillingDate)
  const isUpcoming = daysUntil >= 0 && daysUntil <= 7
  const isSilent = subscription.isSilent || (!subscription.lastReviewedAt && daysUntil > 30)
  const getValueScoreBadge = () => {
    switch (subscription.valueScore) {
      case 'worth-it': 
        return { label: '✓ Worth it', color: colors.badge.worthIt, bg: colors.badge.worthItBg }
      case 'overpriced': 
        return { label: '! Overpriced', color: colors.badge.overpriced, bg: colors.badge.overpricedBg }
      case 'unused': 
        return { label: '○ Unused', color: colors.badge.unused, bg: colors.badge.unusedBg }
      default: 
        return null
    }
  }

  const valueBadge = getValueScoreBadge()

  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
      <TouchableOpacity
        onPress={() => router.push(`/subscription/${subscription.id}`)}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        activeOpacity={1}
      >
        <View
          style={[
            styles.card,
            { 
              backgroundColor: colors.background.card,
              borderColor: isUpcoming ? colors.status.warning : colors.border.default,
              borderWidth: isUpcoming ? 2 : 1,
              opacity: subscription.isCanceled ? 0.5 : 1,
              shadowColor: colors.shadow.medium,
            }
          ]}
        >
          {isSilent && !subscription.isCanceled && (
            <LinearGradient
              colors={colors.gradient.silent as readonly [string, string, ...string[]]}
              style={styles.badge}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            >
              <Ionicons name="alert-circle" size={12} color="#FFF" />
              <Text style={styles.badgeText}>Silent</Text>
            </LinearGradient>
          )}

          {subscription.isCanceled && (
            <View style={[styles.badge, { backgroundColor: colors.text.disabled }]}>
              <Ionicons name="close-circle" size={12} color="#FFF" />
              <Text style={styles.badgeText}>Canceled</Text>
            </View>
          )}

          <View style={styles.header}>
            <LinearGradient
              colors={colors.gradient.primary as readonly [string, string, ...string[]]}
              style={styles.icon}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <Text style={styles.iconText}>
                {(subscription.name?.charAt(0) || '?').toUpperCase()}
              </Text>            </LinearGradient>

            <View style={styles.info}>
              <Text style={[styles.name, { color: colors.text.primary }]} numberOfLines={1}>
                {subscription.name}
              </Text>
              <Text style={[styles.category, { color: colors.text.secondary }]}>
                {subscription.category || 'Uncategorized'}
              </Text>
            </View>

            <View style={styles.amountContainer}>
              <Text style={[styles.amount, { color: colors.text.primary }]}>
                {formatCurrency(subscription.amount, subscription.currency)}
              </Text>
              <Text style={[styles.cycle, { color: colors.text.muted }]}>
                /{subscription.billingCycle === 'custom' 
                  ? `${subscription.customCycleDays ?? '?'}d` 
                  : subscription.billingCycle.charAt(0)
                }
              </Text>            </View>
          </View>

          <View style={styles.footer}>
            <View style={styles.nextBilling}>
              <Ionicons 
                name="calendar-outline" 
                size={14} 
                color={isUpcoming ? colors.status.warning : colors.text.muted} 
              />
              <Text style={[
                styles.nextBillingText, 
                { 
                  color: isUpcoming ? colors.status.warning : colors.text.secondary,
                  fontWeight: isUpcoming ? '600' : '400'
                }
              ]}>
                {formatDate(subscription.nextBillingDate)} • {daysUntil}d
              </Text>
            </View>

            {valueBadge && (
              <View style={[styles.valueScore, { backgroundColor: valueBadge.bg }]}>
                <Text style={[styles.valueScoreText, { color: valueBadge.color }]}>
                  {valueBadge.label}
                </Text>
              </View>
            )}

            {subscription.usageCount !== undefined && subscription.usageCount > 0 && (
              <View style={styles.usageIndicator}>
                <Ionicons name="checkmark-circle" size={14} color={colors.accent.green} />
                <Text style={[styles.usageText, { color: colors.text.secondary }]}>
                  {subscription.usageCount}x
                </Text>
              </View>
            )}
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 20,
    padding: 18,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
  },
  badge: {
    position: 'absolute',
    top: 14,
    right: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    zIndex: 1,
  },
  badgeText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  icon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  iconText: {
    fontSize: 22,
    fontWeight: '800',
    color: '#FFF',
  },
  info: {
    flex: 1,
  },
  name: {
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 3,
    letterSpacing: 0.2,
  },
  category: {
    fontSize: 13,
    fontWeight: '500',
  },
  amountContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  amount: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  cycle: {
    fontSize: 13,
    fontWeight: '600',
    marginLeft: 2,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 10,
  },
  nextBilling: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  nextBillingText: {
    fontSize: 13,
    letterSpacing: 0.2,
  },
  valueScore: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
  },
  valueScoreText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  usageIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  usageText: {
    fontSize: 12,
    fontWeight: '600',
  },
})