// app/signup.tsx
import Button from "@/components/Button";
import { useTheme } from "@/contexts/ThemeContext";
import { authApi, getFriendlyErrorMessage } from "@/services/api";
import { clearGuestSession, setAuthToken } from "@/utils/storage";
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
  // note: profile is default redirect after signup
  const { colors } = useTheme();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  // redirect if already logged in
  React.useEffect(() => {
    (async () => {
      const existing = await import("@/utils/storage").then((m) =>
        m.getAuthToken(),
      );
      if (existing) {
        router.replace("/profile");
      }
    })();
  }, [router]);

  const handleSubmit = async () => {
    if (!email.trim() || !password) {
      Alert.alert("Validation", "Please enter both email and password.");
      return;
    }
    if (password.length < 8) {
      Alert.alert("Validation", "Password must be at least 8 characters.");
      return;
    }

    setLoading(true);
    try {
      const data = await authApi.signup(email.trim(), password);
      await setAuthToken(data.token);
      await clearGuestSession();
      router.replace("/profile");
    } catch (err: any) {
      console.error("[Signup] error", err);
      Alert.alert(
        "Signup Failed",
        getFriendlyErrorMessage(
          err,
          "Unable to create account. Please try again.",
        ),
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background.primary }]}
      edges={["top"]}
    >
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text.primary }]}>
          Create Account
        </Text>
      </View>

      <View style={styles.form}>
        <TextInput
          style={[styles.input, { borderColor: colors.border.default }]}
          placeholder="Email"
          placeholderTextColor={colors.text.muted}
          autoCapitalize="none"
          keyboardType="email-address"
          autoComplete="email"
          value={email}
          onChangeText={setEmail}
        />
        <TextInput
          style={[styles.input, { borderColor: colors.border.default }]}
          placeholder="Password"
          placeholderTextColor={colors.text.muted}
          secureTextEntry
          autoComplete="new-password"
          value={password}
          onChangeText={setPassword}
        />

        <Button
          title="Sign Up"
          onPress={handleSubmit}
          loading={loading}
          style={styles.button}
        />

        <TouchableOpacity
          onPress={() => router.push("/login")}
          style={styles.switchRow}
        >
          <Text style={[styles.switchText, { color: colors.accent.primary }]}>
            Already have an account? Sign in
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { padding: 16 },
  title: { fontSize: 28, fontWeight: "700" },
  form: { padding: 16, flex: 1, justifyContent: "center" },
  input: {
    height: 48,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    marginBottom: 12,
    color: "#000",
  },
  button: { marginTop: 12 },
  switchRow: { marginTop: 16, alignItems: "center" },
  switchText: { fontSize: 14, fontWeight: "600" },
});
