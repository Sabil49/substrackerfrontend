import React, { useState } from 'react'
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native'
import { useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { LinearGradient } from 'expo-linear-gradient'
import { Ionicons } from '@expo/vector-icons'
import Button from '@/components/Button'
import { useTheme } from '@/contexts/ThemeContext'
import { getAuthToken } from '@/utils/storage'

const FEATURES = [
  {
    icon: '∞',
    title: 'Unlimited Subscriptions',
    description: 'Track as many subscriptions as you need',
  },
  {
    icon: '🔔',
    title: 'Smart Reminders',
    description: 'Advanced notification system',
  },
  {
    icon: '📊',
    title: 'Advanced Analytics',
    description: 'Detailed spending insights and trends',
  },
  {
    icon: '☁️',
    title: 'Cloud Backup',
    description: 'Never lose your subscription data',
  },
  {
    icon: '🎨',
    title: 'Custom Categories',
    description: 'Organize subscriptions your way',
  },
  {
    icon: '📱',
    title: 'Multi-Device Sync',
    description: 'Access your data anywhere',
  },
]

const PLANS = [
  {
    id: 'monthly',
    name: 'Monthly',
    price: '$4.99',
    period: '/month',
    popular: false,
  },
  {
    id: 'yearly',
    name: 'Yearly',
    price: '$39.99',
    period: '/year',
    popular: true,
    savings: 'Save 33%',
  },
]

export default function PremiumScreen() {
  const router = useRouter()
  const { colors } = useTheme()
  const [selectedPlan, setSelectedPlan] = useState('yearly')
  const [loading, setLoading] = useState(false)

  const handleUpgrade = async () => {
    setLoading(true)
    try {
      // TODO: PAYMENT INTEGRATION REQUIRED
      // This is a placeholder implementation. Before going live, integrate a real payment provider:
      // - Option 1: RevenueCat (https://www.revenuecat.com/) - recommended for mobile apps
      // - Option 2: Stripe with in-app purchases
      // - Option 3: Native IAP (Google Play Billing or Apple StoreKit)
      // The pattern below shows the expected flow.

      // Step 1: Initiate payment with the selected plan
      let transactionReceipt: string | null = null
      let transactionId: string | null = null

      if (!process.env.EXPO_PUBLIC_PAYMENT_ENABLED) {
        // Development mode: bypass payment (remove before production)
        console.warn('[handleUpgrade] Payment is disabled in development. This must be enabled for production.')
        transactionReceipt = 'dev-receipt-' + Date.now()
        transactionId = 'dev-' + selectedPlan + '-' + Date.now()
      } else {
        // IMPLEMENT: Call your payment provider here
        // Example with RevenueCat (pseudo-code):
        // const result = await Purchases.purchasePackage(packageToPurchase)
        // transactionReceipt = result.productIdentifier
        // transactionId = result.transaction?.transactionIdentifier

        // For now, throw an error to prevent accidental premium grants
        throw new Error(
          'Payment integration not yet implemented. Set up RevenueCat, Stripe, or native IAP before enabling EXPO_PUBLIC_PAYMENT_ENABLED.'
        )
      }

      // Step 2: Send receipt/transaction to backend for validation
      // Backend verifies the receipt with the payment provider and updates isPro
      const authToken = await getAuthToken()
      if (!authToken) {
        throw new Error('Authentication token not found. Please log in again.')
      }

      const verifyResponse = await fetch(`${process.env.EXPO_PUBLIC_API_URL}/api/user/verify-premium-purchase`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          planId: selectedPlan,
          transactionId,
          receipt: transactionReceipt,
        }),
      })

      if (!verifyResponse.ok) {
        const errorData = await verifyResponse.json().catch(() => ({}))
        throw new Error(
          errorData.message || 'Payment verification failed. Please contact support if the charge was applied.'
        )
      }

      const verifyData = await verifyResponse.json()

      // Step 3: On successful backend verification, alert user and navigate
      if (verifyData.isPro) {
        Alert.alert('Success', 'Successfully upgraded to Premium!', [
          { text: 'OK', onPress: () => router.back() },
        ])
      } else {
        throw new Error('Payment verified but user not granted premium status. Please contact support.')
      }
    } catch (error) {
      console.error('[handleUpgrade] Error:', error)
      const errorMessage =
        error instanceof Error
          ? error.message
          : 'Failed to complete upgrade. Please try again or contact support.'
      Alert.alert('Error', errorMessage)
    } finally {
      setLoading(false)
    }
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background.primary }]} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.text.primary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text.primary }]}>Premium</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        <LinearGradient
          colors={colors.gradient.accent as readonly [string, string, ...string[]]}
          style={styles.heroCard}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <Text style={styles.heroIcon}>⭐</Text>
          <Text style={styles.heroTitle}>Upgrade to Premium</Text>
          <Text style={styles.heroSubtitle}>Unlock all features and take full control</Text>
        </LinearGradient>

        <View style={styles.plansSection}>
          <Text style={[styles.sectionTitle, { color: colors.text.primary }]}>Choose Your Plan</Text>
          {PLANS.map((plan) => (
            <TouchableOpacity
              key={plan.id}
              style={[
                styles.planCard,
                { 
                  backgroundColor: colors.background.card,
                  borderColor: selectedPlan === plan.id ? colors.accent.primary : colors.border.default,
                  borderWidth: selectedPlan === plan.id ? 2 : 1,
                }
              ]}
              onPress={() => setSelectedPlan(plan.id)}
            >
              {plan.popular && (
                <View style={[styles.popularBadge, { backgroundColor: colors.accent.primary }]}>
                  <Text style={styles.popularText}>BEST VALUE</Text>
                </View>
              )}
              <View style={styles.planHeader}>
                <View style={styles.planInfo}>
                  <Text style={[styles.planName, { color: colors.text.primary }]}>{plan.name}</Text>
                  {plan.savings && (
                    <Text style={[styles.savings, { color: colors.status.success }]}>{plan.savings}</Text>
                  )}
                </View>
                <View style={styles.planPricing}>
                  <Text style={[styles.planPrice, { color: colors.text.primary }]}>{plan.price}</Text>
                  <Text style={[styles.planPeriod, { color: colors.text.secondary }]}>{plan.period}</Text>
                </View>
              </View>
              <View style={[styles.radioOuter, { borderColor: selectedPlan === plan.id ? colors.accent.primary : colors.border.default }]}>
                {selectedPlan === plan.id && (
                  <View style={[styles.radioInner, { backgroundColor: colors.accent.primary }]} />
                )}
              </View>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.featuresSection}>
          <Text style={[styles.sectionTitle, { color: colors.text.primary }]}>Everything Included</Text>
          {FEATURES.map((feature, index) => (
            <View key={index} style={[styles.featureRow, { backgroundColor: colors.background.card }]}>
              <Text style={styles.featureIcon}>{feature.icon}</Text>
              <View style={styles.featureText}>
                <Text style={[styles.featureTitle, { color: colors.text.primary }]}>{feature.title}</Text>
                <Text style={[styles.featureDescription, { color: colors.text.secondary }]}>
                  {feature.description}
                </Text>
              </View>
            </View>
          ))}
        </View>

        <Button
          title={loading ? "Processing..." : "Continue"}
          onPress={handleUpgrade}
          disabled={loading}
          style={styles.upgradeButton}
        />

        <Text style={[styles.disclaimer, { color: colors.text.muted }]}>
          Cancel anytime. No questions asked.
        </Text>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingBottom: 100,
  },
  heroCard: {
    borderRadius: 24,
    padding: 40,
    alignItems: 'center',
    marginBottom: 24,
  },
  heroIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  heroTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#FFF',
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  heroSubtitle: {
    fontSize: 16,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.9)',
    textAlign: 'center',
  },
  plansSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 16,
    letterSpacing: 0.3,
  },
  planCard: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 12,
    position: 'relative',
  },
  popularBadge: {
    position: 'absolute',
    top: -8,
    right: 16,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  popularText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  planHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  planInfo: {
    flex: 1,
  },
  planName: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 4,
  },
  savings: {
    fontSize: 13,
    fontWeight: '600',
  },
  planPricing: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  planPrice: {
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  planPeriod: {
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 2,
  },
  radioOuter: {
    position: 'absolute',
    top: 20,
    right: 20,
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioInner: {
    width: 14,
    height: 14,
    borderRadius: 7,
  },
  featuresSection: {
    marginBottom: 24,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
  },
  featureIcon: {
    fontSize: 28,
    marginRight: 12,
  },
  featureText: {
    flex: 1,
  },
  featureTitle: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 2,
  },
  featureDescription: {
    fontSize: 13,
    fontWeight: '500',
  },
  upgradeButton: {
    marginBottom: 16,
  },
  disclaimer: {
    fontSize: 12,
    fontWeight: '500',
    textAlign: 'center',
  },
})