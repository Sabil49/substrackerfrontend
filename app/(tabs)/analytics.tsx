import React, { useState, useCallback } from 'react'
import { View, Text, StyleSheet, ScrollView, RefreshControl, Alert, ActivityIndicator } from 'react-native'
import { useFocusEffect } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { LinearGradient } from 'expo-linear-gradient'
import { analyticsApi, Analytics } from '@/services/api'
import { useTheme } from '@/contexts/ThemeContext'
import { formatCurrency, formatShortDate } from '@/utils/date'

export default function AnalyticsScreen() {
  const { colors } = useTheme()
  const [analytics, setAnalytics] = useState<Analytics | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const loadAnalytics = async () => {
    try {
      const data = await analyticsApi.get()
      setAnalytics(data)
    } catch {
      Alert.alert('Error', 'Failed to load analytics')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useFocusEffect(
    useCallback(() => {
      loadAnalytics()
    }, [])
  )

  const onRefresh = () => {
    setRefreshing(true)
    loadAnalytics()
  }

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background.primary }]} edges={['top']}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.text.primary }]}>Analytics</Text>
        </View>
        <View style={styles.emptyContainer}>
          <ActivityIndicator size="large" color={colors.accent.primary} />
        </View>
      </SafeAreaView>
    )
  }

  if (!analytics && !loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background.primary }]} edges={['top']}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.text.primary }]}>Analytics</Text>
        </View>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={{ flex: 1 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.accent.primary}
            />
          }
        >
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>📊</Text>
            <Text style={[styles.emptyText, { color: colors.text.secondary }]}>
              Add subscriptions to see your spending insights
            </Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    )
  }
  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background.primary }]} edges={['top']}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text.primary }]}>Analytics</Text>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.accent.primary}
          />
        }
      >
        {analytics && (
          <>
            <LinearGradient
              colors={[colors.gradient.primary[0], colors.gradient.primary[1]]}
              style={styles.heroCard}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <Text style={styles.heroLabel}>Total Monthly</Text>
              <Text style={styles.heroAmount}>
                {formatCurrency(analytics.monthlyTotal || 0, 'USD')}
              </Text>
              <Text style={styles.heroSubtext}>
                {analytics.totalSubscriptions || 0} subscription{analytics.totalSubscriptions !== 1 ? 's' : ''}
              </Text>
            </LinearGradient>

            <View style={styles.statsGrid}>
              <View style={[styles.statCard, { backgroundColor: colors.background.card }]}>
                <Text style={[styles.statValue, { color: colors.text.primary }]}>
                  {formatCurrency(analytics.yearlyTotal || 0, 'USD')}
                </Text>
                <Text style={[styles.statLabel, { color: colors.text.secondary }]}>Yearly Total</Text>
              </View>

              <View style={[styles.statCard, { backgroundColor: colors.background.card }]}>
                <Text style={[styles.statValue, { color: colors.text.primary }]}>
                  {analytics.totalSubscriptions || 0}
                </Text>
                <Text style={[styles.statLabel, { color: colors.text.secondary }]}>Total Subs</Text>
              </View>
            </View>

            {analytics.upcomingCharges && analytics.upcomingCharges.length > 0 && (
              <View style={[styles.section, { backgroundColor: colors.background.card }]}>
                <Text style={[styles.sectionTitle, { color: colors.text.primary }]}>Upcoming Charges</Text>
                {analytics.upcomingCharges.slice(0, 5).map((charge, index) => (
                  <View key={index} style={[styles.chargeRow, { borderBottomColor: colors.border.light }]}>
                    <View style={styles.chargeInfo}>
                      <Text style={[styles.chargeName, { color: colors.text.primary }]}>{charge.name}</Text>
                      <Text style={[styles.chargeDate, { color: colors.text.secondary }]}>
                        {formatShortDate(charge.nextBillingDate)} • {charge.daysUntil}d
                      </Text>
                    </View>
                    <Text style={[styles.chargeAmount, { color: colors.text.primary }]}>
                      {formatCurrency(charge.amount, charge.currency)}
                    </Text>
                  </View>
                ))}
              </View>
            )}

            {analytics.categoryBreakdown && Object.keys(analytics.categoryBreakdown).length > 0 && (
              <View style={[styles.section, { backgroundColor: colors.background.card }]}>
                <Text style={[styles.sectionTitle, { color: colors.text.primary }]}>By Category</Text>
                {Object.entries(analytics.categoryBreakdown).map(([category, amount], index) => (
                  <View key={index} style={[styles.categoryRow, { borderBottomColor: colors.border.light }]}>
                    <Text style={[styles.categoryName, { color: colors.text.primary }]}>
                      {category || 'Uncategorized'}
                    </Text>
                    <Text style={[styles.categoryAmount, { color: colors.text.primary }]}>
                      {formatCurrency(amount as number, 'USD')}
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingBottom: 100,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 15,
    textAlign: 'center',
  },
  heroCard: {
    borderRadius: 24,
    padding: 32,
    alignItems: 'center',
    marginBottom: 20,
  },
  heroLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.8)',
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  heroAmount: {
    fontSize: 42,
    fontWeight: '800',
    color: '#FFF',
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  heroSubtext: {
    fontSize: 14,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.9)',
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  statCard: {
    flex: 1,
    padding: 20,
    borderRadius: 16,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 6,
    letterSpacing: 0.3,
  },
  statLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  section: {
    marginBottom: 16,
    padding: 18,
    borderRadius: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 16,
    letterSpacing: 0.2,
  },
  chargeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  chargeInfo: {
    flex: 1,
  },
  chargeName: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 3,
  },
  chargeDate: {
    fontSize: 12,
    fontWeight: '500',
  },
  chargeAmount: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  categoryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  categoryName: {
    fontSize: 15,
    fontWeight: '600',
  },
  categoryAmount: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
})