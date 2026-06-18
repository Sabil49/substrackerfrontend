// app/login.tsx
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

export default function LoginScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  // if already signed in, redirect immediately
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

    setLoading(true);
    try {
      const data = await authApi.login(email.trim(), password);
      await setAuthToken(data.token);
      // erase guestId so backend no longer associates requests with anonymous session
      await clearGuestSession();
      // redirect to profile
      router.replace("/profile");
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
          Sign In
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
          autoComplete="current-password"
          value={password}
          onChangeText={setPassword}
        />

        <Button
          title="Sign In"
          onPress={handleSubmit}
          loading={loading}
          style={styles.button}
        />

        <TouchableOpacity
          onPress={() => router.push("/signup")}
          style={styles.switchRow}
        >
          <Text style={[styles.switchText, { color: colors.accent.primary }]}>
            Don&apos;t have an account? Sign up
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
