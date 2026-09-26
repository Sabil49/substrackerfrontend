// app/forgot-password.tsx
import Button from "@/components/Button";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { getFriendlyErrorMessage } from "@/services/api";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  Alert,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { resetPassword } = useAuth();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSendReset = async () => {
    if (!email.trim()) {
      Alert.alert("Email Needed", "Please enter your email address.");
      return;
    }
    setLoading(true);
    try {
      await resetPassword(email.trim());
      setSent(true);
    } catch (err: any) {
      console.error("[ForgotPassword] error", err);
      Alert.alert(
        "Couldn't Send Reset Email",
        getFriendlyErrorMessage(
          err,
          "We could not send a reset email. Please check the address and try again.",
        ),
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background.primary }]}>
      <LinearGradient
        colors={colors.gradient.pageGlow as readonly [string, string, ...string[]]}
        style={styles.pageGlow}
        pointerEvents="none"
      />
      <SafeAreaView style={styles.safeArea} edges={["top"]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={20} color={colors.accent.primary} />
          <Text style={[styles.backText, { color: colors.accent.primary }]}>Back</Text>
        </TouchableOpacity>

        <View style={styles.body}>
          <LinearGradient
            colors={colors.gradient.mark as readonly [string, string, ...string[]]}
            style={styles.mark}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <Ionicons
              name={sent ? "mail-open-outline" : "key-outline"}
              size={28}
              color="#fff"
            />
          </LinearGradient>

          {sent ? (
            <>
              <Text style={[styles.headline, { color: colors.text.primary }]}>
                Check your email
              </Text>
              <Text style={[styles.lede, { color: colors.text.muted }]}>
                We sent a password reset link to {email.trim()}. Follow it to
                choose a new password, then log in below.
              </Text>
              <Button
                title="Back to Log In"
                onPress={() => router.replace("/login")}
                style={styles.primaryButton}
              />
            </>
          ) : (
            <>
              <Text style={[styles.headline, { color: colors.text.primary }]}>
                Reset your password
              </Text>
              <Text style={[styles.lede, { color: colors.text.muted }]}>
                Enter your email and we&apos;ll send you a link to reset it.
              </Text>

              <View style={[styles.card, { backgroundColor: colors.background.card }]}>
                <View style={[styles.inputRow, { borderTopColor: colors.border.light, borderTopWidth: 0 }]}>
                  <Text style={[styles.inputLabel, { color: colors.text.muted }]}>Email</Text>
                  <TextInput
                    style={[styles.input, { color: colors.text.primary }]}
                    placeholder="you@email.com"
                    placeholderTextColor={colors.text.disabled}
                    autoCapitalize="none"
                    keyboardType="email-address"
                    autoComplete="email"
                    value={email}
                    onChangeText={setEmail}
                  />
                </View>
              </View>

              <Button
                title="Send Reset Link"
                onPress={handleSendReset}
                loading={loading}
                style={styles.primaryButton}
              />
            </>
          )}
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  pageGlow: { position: "absolute", top: 0, left: 0, right: 0, height: 420 },
  safeArea: { flex: 1 },
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingTop: 8,
    height: 40,
  },
  backText: { fontSize: 16, fontWeight: "600" },
  body: { flex: 1, justifyContent: "center", paddingHorizontal: 24, gap: 14, marginTop: -40 },
  mark: {
    width: 64,
    height: 64,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    marginBottom: 4,
  },
  headline: { fontSize: 26, fontWeight: "800", textAlign: "center" },
  lede: { fontSize: 14, fontWeight: "500", textAlign: "center", marginBottom: 10, lineHeight: 20 },
  card: { borderRadius: 24, paddingHorizontal: 18 },
  inputRow: { paddingVertical: 12, borderTopWidth: 1, gap: 6 },
  inputLabel: { fontSize: 11, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5 },
  input: { fontSize: 16, fontWeight: "600", padding: 0 },
  primaryButton: { marginTop: 14 },
});
