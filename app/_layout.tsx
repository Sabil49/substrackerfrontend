import { useEffect, useState } from 'react'
import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { View, ActivityIndicator, StyleSheet } from 'react-native'
import { ThemeProvider, useTheme } from '@/contexts/ThemeContext'
import { getGuestId } from '@/utils/storage'
import { registerForPushNotifications } from '@/services/notifications'

function RootLayoutContent() {
  const [isReady, setIsReady] = useState(false)
  const { colors } = useTheme()

  useEffect(() => {
    async function initializeApp() {
      try {
        await getGuestId()
        await registerForPushNotifications()
      } catch (error) {
        console.log('Init error:', error)
      } finally {
        setIsReady(true)
      }
    }
    
    initializeApp()
  }, [])

  if (!isReady) {
    return (
      <View style={[styles.loading, { backgroundColor: colors.background.primary }]}>
        <StatusBar style="dark" />
        <ActivityIndicator size="large" color={colors.accent.primary} />
      </View>
    )
  }

  return (
    <>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: {
            backgroundColor: colors.background.primary,
          },
          animation: 'slide_from_right',
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="subscription/[id]" />
        <Stack.Screen name="add-subscription" />
        <Stack.Screen name="settings" />
        <Stack.Screen name="premium" />
      </Stack>
    </>
  )
}

export default function RootLayout() {
  return (
    <ThemeProvider>
      <RootLayoutContent />
    </ThemeProvider>
  )
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
})