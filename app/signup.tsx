// app/signup.tsx
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

export default function SignupScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { signUpWithEmail, signInWithGoogle, signInWithApple } =
    useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState<"email" | "google" | "apple" | null>(
    null,
  );

  const handleEmailSignup = async () => {
    if (!name.trim()) {
      Alert.alert("Name Needed", "Please enter your name.");
      return;
    }
    if (!email.trim() || !password) {
      Alert.alert("Missing Details", "Please enter both your email and password.");
      return;
    }
    if (password.length < 8) {
      Alert.alert("Password Too Short", "Please choose a password with at least 8 characters.");
      return;
    }
    setLoading("email");
    try {
      await signUpWithEmail(email.trim(), password, name.trim());
    } catch (err: any) {
      console.error("[Signup] error", err);
      Alert.alert(
        "Couldn't Create Account",
        getFriendlyErrorMessage(
          err,
          "Unable to create account. Please try again.",
        ),
      );
    } finally {
      setLoading(null);
    }
  };

  const handleGoogleSignup = async () => {
    setLoading("google");
    try {
      await signInWithGoogle();
    } catch (err: any) {
      if (isUserCancelledError(err)) return;
      console.error("[Signup] Google error", err);
      Alert.alert("Couldn't Sign In with Google", getFriendlyErrorMessage(err));
    } finally {
      setLoading(null);
    }
  };

  const handleAppleSignup = async () => {
    setLoading("apple");
    try {
      await signInWithApple();
    } catch (err: any) {
      if (!isUserCancelledError(err)) {
        console.error("[Signup] Apple error", err);
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
            Create your account
          </Text>
          <Text style={[styles.lede, { color: colors.text.muted }]}>
            Track every subscription in one place
          </Text>

          <View style={[styles.card, { backgroundColor: colors.background.card }]}>
            <View style={[styles.inputRow, { borderTopColor: colors.border.light, borderTopWidth: 0 }]}>
              <Text style={[styles.inputLabel, { color: colors.text.muted }]}>Name</Text>
              <TextInput
                style={[styles.input, { color: colors.text.primary }]}
                placeholder="Jordan Doe"
                placeholderTextColor={colors.text.disabled}
                autoCapitalize="words"
                autoComplete="name"
                value={name}
                onChangeText={setName}
              />
            </View>
            <View style={[styles.inputRow, { borderTopColor: colors.border.light }]}>
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
                placeholder="At least 8 characters"
                placeholderTextColor={colors.text.disabled}
                secureTextEntry
                autoComplete="new-password"
                value={password}
                onChangeText={setPassword}
              />
            </View>
          </View>

          <Button
            title="Sign Up"
            onPress={handleEmailSignup}
            loading={loading === "email"}
            style={styles.primaryButton}
          />
          <Text style={[styles.terms, { color: colors.text.disabled }]}>
            By continuing you agree to our Terms and Privacy Policy.
          </Text>

          <View style={styles.dividerRow}>
            <View style={[styles.dividerLine, { backgroundColor: colors.border.default }]} />
            <Text style={[styles.dividerText, { color: colors.text.muted }]}>or</Text>
            <View style={[styles.dividerLine, { backgroundColor: colors.border.default }]} />
          </View>

          <TouchableOpacity
            style={[styles.oauthButton, { borderColor: colors.border.default }]}
            onPress={handleGoogleSignup}
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
              onPress={handleAppleSignup}
            />
          )}

          <TouchableOpacity
            onPress={() => router.replace("/login")}
            style={styles.switchRow}
          >
            <Text style={[styles.switchText, { color: colors.text.muted }]}>
              Already have an account?{" "}
              <Text style={{ color: colors.accent.primary }}>Log in</Text>
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
  primaryButton: { marginTop: 6 },
  terms: { fontSize: 11, fontWeight: "500", textAlign: "center", lineHeight: 16 },
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
