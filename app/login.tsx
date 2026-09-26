// app/login.tsx
import Button from "@/components/Button";
import { isAppleAuthAvailable } from "@/config/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { getFriendlyErrorMessage, isUserCancelledError } from "@/services/api";
import { Ionicons } from "@expo/vector-icons";
import * as AppleAuthentication from "expo-apple-authentication";
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

export default function LoginScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { signInWithEmail, signInWithGoogle, signInWithApple } =
    useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState<"email" | "google" | "apple" | null>(
    null,
  );

  const handleEmailLogin = async () => {
    if (!email.trim() || !password) {
      Alert.alert("Missing Details", "Please enter both your email and password.");
      return;
    }
    setLoading("email");
    try {
      await signInWithEmail(email.trim(), password);
    } catch (err: any) {
      console.error("[Login] error", err);
      Alert.alert(
        "Couldn't Sign In",
        getFriendlyErrorMessage(
          err,
          "Unable to sign in. Please verify your email and password.",
        ),
      );
    } finally {
      setLoading(null);
    }
  };

  const handleGoogleLogin = async () => {
    setLoading("google");
    try {
      await signInWithGoogle();
    } catch (err: any) {
      if (isUserCancelledError(err)) return;
      console.error("[Login] Google error", err);
      Alert.alert("Couldn't Sign In with Google", getFriendlyErrorMessage(err));
    } finally {
      setLoading(null);
    }
  };

  const handleAppleLogin = async () => {
    setLoading("apple");
    try {
      await signInWithApple();
    } catch (err: any) {
      if (!isUserCancelledError(err)) {
        console.error("[Login] Apple error", err);
        Alert.alert("Couldn't Sign In with Apple", getFriendlyErrorMessage(err));
      }
    } finally {
      setLoading(null);
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
        <View style={styles.body}>
          <LinearGradient
            colors={colors.gradient.mark as readonly [string, string, ...string[]]}
            style={styles.mark}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <Ionicons name="speedometer-outline" size={28} color="#fff" />
          </LinearGradient>

          <Text style={[styles.headline, { color: colors.text.primary }]}>
            Welcome back
          </Text>
          <Text style={[styles.lede, { color: colors.text.muted }]}>
            Log in to keep tracking your subscriptions.
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
            <View style={[styles.inputRow, { borderTopColor: colors.border.light }]}>
              <Text style={[styles.inputLabel, { color: colors.text.muted }]}>Password</Text>
              <TextInput
                style={[styles.input, { color: colors.text.primary }]}
                placeholder="••••••••"
                placeholderTextColor={colors.text.disabled}
                secureTextEntry
                autoComplete="current-password"
                value={password}
                onChangeText={setPassword}
              />
            </View>
          </View>

          <TouchableOpacity
            onPress={() => router.push("/forgot-password")}
            style={styles.forgotRow}
          >
            <Text style={[styles.forgotText, { color: colors.accent.primary }]}>
              Forgot password?
            </Text>
          </TouchableOpacity>

          <Button
            title="Log In"
            onPress={handleEmailLogin}
            loading={loading === "email"}
            style={styles.primaryButton}
          />

          <View style={styles.dividerRow}>
            <View style={[styles.dividerLine, { backgroundColor: colors.border.default }]} />
            <Text style={[styles.dividerText, { color: colors.text.muted }]}>or</Text>
            <View style={[styles.dividerLine, { backgroundColor: colors.border.default }]} />
          </View>

          <TouchableOpacity
            style={[styles.oauthButton, { borderColor: colors.border.default }]}
            onPress={handleGoogleLogin}
            disabled={loading !== null}
            activeOpacity={0.8}
          >
            <Text style={[styles.oauthText, { color: colors.text.primary }]}>
              {loading === "google" ? "Signing in…" : "Continue with Google"}
            </Text>
          </TouchableOpacity>

          {isAppleAuthAvailable && (
            <AppleAuthentication.AppleAuthenticationButton
              buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
              buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.WHITE}
              cornerRadius={18}
              style={styles.appleButton}
              onPress={handleAppleLogin}
            />
          )}

          <TouchableOpacity
            onPress={() => router.push("/signup")}
            style={styles.switchRow}
          >
            <Text style={[styles.switchText, { color: colors.text.muted }]}>
              Don&apos;t have an account?{" "}
              <Text style={{ color: colors.accent.primary }}>Sign up</Text>
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  pageGlow: { position: "absolute", top: 0, left: 0, right: 0, height: 420 },
  safeArea: { flex: 1 },
  body: { flex: 1, justifyContent: "center", paddingHorizontal: 24, gap: 14 },
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
  lede: { fontSize: 14, fontWeight: "500", textAlign: "center", marginBottom: 10 },
  card: { borderRadius: 24, paddingHorizontal: 18 },
  inputRow: { paddingVertical: 12, borderTopWidth: 1, gap: 6 },
  inputLabel: { fontSize: 11, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5 },
  input: { fontSize: 16, fontWeight: "600", padding: 0 },
  forgotRow: { alignSelf: "flex-end", marginTop: 10 },
  forgotText: { fontSize: 13, fontWeight: "700" },
  primaryButton: { marginTop: 14 },
  dividerRow: { flexDirection: "row", alignItems: "center", gap: 10, marginVertical: 4 },
  dividerLine: { flex: 1, height: 1 },
  dividerText: { fontSize: 12, fontWeight: "600" },
  oauthButton: {
    height: 52,
    borderRadius: 18,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  oauthText: { fontSize: 15, fontWeight: "700" },
  appleButton: { height: 52, marginTop: 12 },
  switchRow: { marginTop: 18, alignItems: "center" },
  switchText: { fontSize: 14, fontWeight: "600" },
});
