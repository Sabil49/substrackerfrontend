// app/signup.tsx
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
    if (!email || !password) {
      Alert.alert("Validation", "Please enter both email and password.");
      return;
    }

    setLoading(true);
    try {
      const data = await authApi.signup(email.trim(), password);
      await setAuthToken(data.token);
      AsyncStorage.removeItem(STORAGE_KEYS.GUEST_ID).catch(() => {});
      router.replace("/profile");
    } catch (err: any) {
      console.error("[Signup] error", err);
      let serverMsg: string | undefined;
      const resData = err?.response?.data;
      if (typeof resData === "string") {
        serverMsg = resData;
      } else {
        serverMsg = resData?.message || resData?.error || err?.message;
      }
      // provide friendly text for 500 server errors
      if (err?.response?.status === 500 && !serverMsg) {
        serverMsg =
          "Something went wrong on our end. Please try again later or contact support.";
      }
      Alert.alert(
        "Signup Failed",
        serverMsg || "Unable to create account. Please try again.",
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
