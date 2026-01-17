import React, { useState, useCallback } from 'react'
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, Alert, ActivityIndicator } from 'react-native'
import { useRouter, useFocusEffect } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import SubscriptionCard from '@/components/Subscriptioncard'
import Button from '@/components/Button'
import { subscriptionsApi, Subscription } from '@/services/api'
import { useTheme } from '@/contexts/ThemeContext'

export default function HomeScreen() {
  const router = useRouter()
  const { colors } = useTheme()
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadSubscriptions = async () => {
    try {
      setError(null)
      const data = await subscriptionsApi.getAll()
      setSubscriptions(data)
    } catch (error: any) {
      console.error('Failed to load subscriptions:', error)
      const errorMessage = error.response?.data?.error || error.message || 'Failed to connect to server'
      setError(errorMessage)
      
      if (!loading) {
        Alert.alert('Error', errorMessage)
      }
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useFocusEffect(
    useCallback(() => {
      loadSubscriptions()
    }, [])
  )

  const onRefresh = () => {
    setRefreshing(true)
    loadSubscriptions()
  }

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyIcon}>📋</Text>
      <Text style={[styles.emptyTitle, { color: colors.text.primary }]}>No subscriptions yet</Text>
      <Text style={[styles.emptyText, { color: colors.text.secondary }]}>
        Add your first subscription to start tracking your recurring payments
      </Text>
      <Button
        title="Add Subscription"
        onPress={() => router.push('/add-subscription')}
        style={styles.emptyButton}
      />
    </View>
  )

  const renderError = () => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyIcon}>⚠️</Text>
      <Text style={[styles.emptyTitle, { color: colors.text.primary }]}>Connection Error</Text>
      <Text style={[styles.emptyText, { color: colors.text.secondary }]}>
        {error || 'Failed to connect to server'}
      </Text>
      <Text style={[styles.helpText, { color: colors.text.muted }]}>
        Make sure the backend is running and you&apos;re on the same WiFi network.
      </Text>
      <Button
        title="Retry"
        onPress={() => {
          setLoading(true)
          loadSubscriptions()
        }}
        style={styles.emptyButton}
      />
      <Button
        title="Add Subscription Anyway"
        onPress={() => router.push('/add-subscription')}
        variant="secondary"
        style={styles.emptyButton}
      />
    </View>
  )

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background.primary }]} edges={['top']}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.text.primary }]}>Subscriptions</Text>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.accent.primary} />
          <Text style={[styles.loadingText, { color: colors.text.secondary }]}>Loading...</Text>
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background.primary }]} edges={['top']}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text.primary }]}>Subscriptions</Text>
        <TouchableOpacity
          onPress={() => router.push('/settings')}
          style={styles.settingsButton}
          accessible={true}
          accessibilityRole="button"
          accessibilityLabel="Open settings"
          accessibilityHint="Navigate to settings screen to manage your preferences and account"
        >
          <Ionicons name="settings-outline" size={24} color={colors.text.primary} />
        </TouchableOpacity>
      </View>

      {error && subscriptions.length === 0 ? (
        renderError()
      ) : (
        <FlatList
          data={subscriptions}
          renderItem={({ item }) => <SubscriptionCard subscription={item} />}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={renderEmpty}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.accent.primary}
            />
          }
          ItemSeparatorComponent={() => <View style={{ height: 16 }} />}
        />
      )}

      {subscriptions.length > 0 && (
        <View style={styles.fabContainer}>
          <TouchableOpacity
            style={[styles.fab, { backgroundColor: colors.accent.primary }]}
            onPress={() => router.push('/add-subscription')}
            activeOpacity={0.8}
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel="Add subscription"
            accessibilityHint="Open form to add a new subscription to track"
          >
            <Ionicons name="add" size={32} color={colors.background.primary} />
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
  },
  settingsButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  loadingText: {
    fontSize: 13,
    fontWeight: '400',
  },
  listContent: {
    padding: 16,
    paddingBottom: 100,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingTop: 100,
    paddingHorizontal: 32,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyText: {
    fontSize: 13,
    fontWeight: '400',
    textAlign: 'center',
    marginBottom: 24,
  },
  helpText: {
    fontSize: 11,
    fontWeight: '500',
    textAlign: 'center',
    marginBottom: 24,
  },
  emptyButton: {
    width: '100%',
    maxWidth: 300,
    marginBottom: 8,
  },
  fabContainer: {
    position: 'absolute',
    bottom: 100,
    right: 16,
  },
  fab: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
})