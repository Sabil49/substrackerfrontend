// app/login.tsx
import Button from "@/components/Button";
import { useTheme } from "@/contexts/ThemeContext";
import { authApi } from "@/services/api";
import { setAuthToken, STORAGE_KEYS } from "@/utils/storage";
import AsyncStorage from "@react-native-async-storage/async-storage";
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
    if (!email || !password) {
      Alert.alert("Validation", "Please enter both email and password.");
      return;
    }

    setLoading(true);
    try {
      const data = await authApi.login(email.trim(), password);
      await setAuthToken(data.token);
      // erase guestId so backend no longer associates requests with anonymous session
      AsyncStorage.removeItem(STORAGE_KEYS.GUEST_ID).catch(() => {});
      // redirect to profile
      router.replace("/profile");
    } catch (err: any) {
      console.error("[Login] error", err);
      // prefer server-provided message when available
      let serverMsg: string | undefined;
      const resData = err?.response?.data;
      if (typeof resData === "string") {
        serverMsg = resData;
      } else {
        serverMsg = resData?.message || resData?.error || err?.message;
      }
      if (err?.response?.status === 500 && !serverMsg) {
        serverMsg =
          "Something went wrong on our end. Please try again later or contact support.";
      }
      Alert.alert(
        "Login Failed",
        serverMsg ||
          "Unable to sign in. Please verify your email and password.",
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
          value={email}
          onChangeText={setEmail}
        />
        <TextInput
          style={[styles.input, { borderColor: colors.border.default }]}
          placeholder="Password"
          placeholderTextColor={colors.text.muted}
          secureTextEntry
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
