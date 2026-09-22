// app/login.tsx
import Button from "@/components/Button";
import { isAppleAuthAvailable } from "@/config/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { getFriendlyErrorMessage } from "@/services/api";
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
  const { firebaseUser, signInWithEmail, signInWithGoogle, signInWithApple } =
    useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState<"email" | "google" | "apple" | null>(
    null,
  );

  React.useEffect(() => {
    if (firebaseUser) {
      router.replace("/(tabs)/account");
    }
  }, [firebaseUser, router]);

  const handleEmailLogin = async () => {
    if (!email.trim() || !password) {
      Alert.alert("Validation", "Please enter both email and password.");
      return;
    }
    setLoading("email");
    try {
      await signInWithEmail(email.trim(), password);
      router.replace("/(tabs)/account");
    } catch (err: any) {
      console.error("[Login] error", err);
      Alert.alert(
        "Login Failed",
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
      router.replace("/(tabs)/account");
    } catch (err: any) {
      console.error("[Login] Google error", err);
      Alert.alert("Google Sign-In Failed", getFriendlyErrorMessage(err));
    } finally {
      setLoading(null);
    }
  };

  const handleAppleLogin = async () => {
    setLoading("apple");
    try {
      await signInWithApple();
      router.replace("/(tabs)/account");
    } catch (err: any) {
      if (err?.code !== "ERR_REQUEST_CANCELED") {
        console.error("[Login] Apple error", err);
        Alert.alert("Apple Sign-In Failed", getFriendlyErrorMessage(err));
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
            <Text style={styles.markGlyph}>$</Text>
          </LinearGradient>

          <Text style={[styles.headline, { color: colors.text.primary }]}>
            Welcome back
          </Text>
          <Text style={[styles.lede, { color: colors.text.muted }]}>
            Log in to sync your subscriptions
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
  markGlyph: { fontSize: 28, fontWeight: "800", color: "#fff" },
  headline: { fontSize: 26, fontWeight: "800", textAlign: "center" },
  lede: { fontSize: 14, fontWeight: "500", textAlign: "center", marginBottom: 10 },
  card: { borderRadius: 24, paddingHorizontal: 18 },
  inputRow: { paddingVertical: 12, borderTopWidth: 1, gap: 6 },
  inputLabel: { fontSize: 11, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5 },
  input: { fontSize: 16, fontWeight: "600", padding: 0 },
  primaryButton: { marginTop: 6 },
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
