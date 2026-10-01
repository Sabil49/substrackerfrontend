// app/onboarding.tsx
import Button from "@/components/Button";
import { useOnboarding } from "@/contexts/OnboardingContext";
import { useTheme } from "@/contexts/ThemeContext";
import { requestNotificationPermission } from "@/services/notifications";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import React, { useRef, useState } from "react";
import {
  NativeScrollEvent,
  NativeSyntheticEvent,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

// Shown once, on first launch, before login. Explains the app in three steps
// and asks for notifications where the reason is obvious.
const SLIDES = [
  {
    icon: "albums-outline",
    title: "All your subscriptions in one place",
    text: "See what you pay for, what it costs each month, and when each one renews — no bank linking needed.",
  },
  {
    icon: "notifications-outline",
    title: "Never get surprise-charged",
    text: "Get a reminder before a subscription renews or a free trial turns into a charge, so you can cancel in time.",
    asksForNotifications: true,
  },
  // "How to add a subscription / scan a receipt" is taught after sign-in by the
  // arrow tour on the dashboard, which points at the real buttons.
] as const;

type ReminderState = "idle" | "asking" | "on" | "off";

export default function OnboardingScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { complete } = useOnboarding();
  const { width } = useWindowDimensions();

  const scrollRef = useRef<ScrollView>(null);
  const [index, setIndex] = useState(0);
  const [reminders, setReminders] = useState<ReminderState>("idle");

  const isLast = index === SLIDES.length - 1;

  const goTo = (next: number) => {
    scrollRef.current?.scrollTo({ x: next * width, animated: true });
    setIndex(next);
  };

  const onScrollEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    setIndex(Math.round(event.nativeEvent.contentOffset.x / width));
  };

  const finish = async (to: "/signup" | "/login") => {
    await complete();
    router.replace(to);
  };

  const turnOnReminders = async () => {
    setReminders("asking");
    const allowed = await requestNotificationPermission().catch(() => false);
    setReminders(allowed ? "on" : "off");
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background.primary }]}>
      <LinearGradient
        colors={colors.gradient.pageGlow as readonly [string, string, ...string[]]}
        style={styles.pageGlow}
        pointerEvents="none"
      />
      <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
        <View style={styles.header}>
          {!isLast && (
            <TouchableOpacity onPress={() => finish("/signup")} hitSlop={12}>
              <Text style={[styles.skip, { color: colors.text.muted }]}>Skip</Text>
            </TouchableOpacity>
          )}
        </View>

        <ScrollView
          ref={scrollRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={onScrollEnd}
          style={styles.pager}
        >
          {SLIDES.map((slide) => (
            <View key={slide.title} style={[styles.slide, { width }]}>
              <LinearGradient
                colors={colors.gradient.mark as readonly [string, string, ...string[]]}
                style={styles.mark}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <Ionicons name={slide.icon} size={44} color="#fff" />
              </LinearGradient>
              <Text style={[styles.title, { color: colors.text.primary }]}>{slide.title}</Text>
              <Text style={[styles.text, { color: colors.text.secondary }]}>{slide.text}</Text>

              {"asksForNotifications" in slide && (
                <View style={styles.reminderArea}>
                  {reminders === "on" ? (
                    <View style={[styles.reminderDone, { backgroundColor: colors.badge.worthItBg }]}>
                      <Ionicons name="checkmark-circle" size={18} color={colors.status.success} />
                      <Text style={[styles.reminderDoneText, { color: colors.status.success }]}>
                        Reminders are on
                      </Text>
                    </View>
                  ) : reminders === "off" ? (
                    <Text style={[styles.reminderNote, { color: colors.text.muted }]}>
                      No problem — you can turn reminders on later in Account.
                    </Text>
                  ) : (
                    <Button
                      title="Turn On Reminders"
                      variant="secondary"
                      onPress={turnOnReminders}
                      loading={reminders === "asking"}
                      style={styles.reminderButton}
                    />
                  )}
                </View>
              )}
            </View>
          ))}
        </ScrollView>

        <View style={styles.footer}>
          <View style={styles.dots}>
            {SLIDES.map((slide, i) => (
              <View
                key={slide.title}
                style={[
                  styles.dot,
                  i === index
                    ? { backgroundColor: colors.accent.primary, width: 22 }
                    : { backgroundColor: colors.border.default },
                ]}
              />
            ))}
          </View>

          <Button
            title={isLast ? "Get Started" : "Next"}
            onPress={() => (isLast ? finish("/signup") : goTo(index + 1))}
          />

          <TouchableOpacity onPress={() => finish("/login")} style={styles.loginRow}>
            <Text style={[styles.loginText, { color: colors.text.muted }]}>
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
  pageGlow: { position: "absolute", top: 0, left: 0, right: 0, height: 480 },
  safeArea: { flex: 1 },
  header: { height: 44, flexDirection: "row", justifyContent: "flex-end", alignItems: "center", paddingHorizontal: 24 },
  skip: { fontSize: 15, fontWeight: "700" },
  pager: { flex: 1 },
  slide: { justifyContent: "center", alignItems: "center", paddingHorizontal: 32 },
  mark: {
    width: 96,
    height: 96,
    borderRadius: 30,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 32,
  },
  title: { fontSize: 26, fontWeight: "800", textAlign: "center", marginBottom: 12, letterSpacing: 0.2 },
  text: { fontSize: 15, fontWeight: "500", textAlign: "center", lineHeight: 22 },
  reminderArea: { marginTop: 28, alignSelf: "stretch", alignItems: "center" },
  reminderButton: { alignSelf: "stretch" },
  reminderDone: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 14,
  },
  reminderDoneText: { fontSize: 15, fontWeight: "700" },
  reminderNote: { fontSize: 13, fontWeight: "500", textAlign: "center", lineHeight: 19 },
  footer: { paddingHorizontal: 24, paddingBottom: 12, gap: 14 },
  dots: { flexDirection: "row", justifyContent: "center", gap: 6, marginBottom: 6 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  loginRow: { alignItems: "center", paddingVertical: 4 },
  loginText: { fontSize: 14, fontWeight: "600" },
});
