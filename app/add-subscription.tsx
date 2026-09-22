// app/add-subscription.tsx
import Button from "@/components/Button";
import { BillingCycles, Categories, NotificationOptions } from "@/constants/theme";
import { useTheme } from "@/contexts/ThemeContext";
import {
  getFriendlyErrorMessage,
  subscriptionsApi,
  Template,
  templatesApi,
} from "@/services/api";
import {
  checkNotificationPermissions,
  scheduleLocalNotification,
} from "@/services/notifications";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function AddSubscriptionScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [currency] = useState("USD");
  const [billingCycle, setBillingCycle] = useState("monthly");
  const [customDays, setCustomDays] = useState("");
  const [category, setCategory] = useState("");
  const [startDate] = useState(new Date());
  const [isTrial, setIsTrial] = useState(false);
  const [trialEndDate, setTrialEndDate] = useState("");
  const [notifyDays, setNotifyDays] = useState<number[]>([7, 3, 1, 0]);
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    try {
      const data = await templatesApi.getAll();
      setTemplates(data);
    } catch {
      console.error("Failed to load templates");
    }
  };

  const scheduleLocalReminders = async (
    subscription: Awaited<ReturnType<typeof subscriptionsApi.create>>,
  ) => {
    const permissionsEnabled = await checkNotificationPermissions();
    if (!permissionsEnabled) return;

    const nextBillingDate = new Date(subscription.nextBillingDate);
    if (Number.isNaN(nextBillingDate.getTime())) return;

    const reminderDays = subscription.notifyDaysBefore?.length
      ? subscription.notifyDaysBefore
      : notifyDays;

    await Promise.all(
      reminderDays.map((daysBefore) => {
        const scheduledDate = new Date(nextBillingDate);
        scheduledDate.setDate(scheduledDate.getDate() - daysBefore);

        return scheduleLocalNotification(
          subscription.name,
          Number(subscription.amount),
          subscription.currency,
          daysBefore,
          scheduledDate,
          subscription.id,
        );
      }),
    );
  };

  const handleSubmit = async () => {
    if (!name.trim()) {
      Alert.alert("Error", "Please enter a subscription name");
      return;
    }

    const parsedAmount = parseFloat(amount);
    if (!amount || !Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      Alert.alert("Error", "Please enter a valid amount");
      return;
    }

    const parsedCustomDays =
      billingCycle === "custom" ? parseInt(customDays, 10) : undefined;
    if (
      billingCycle === "custom" &&
      (!Number.isFinite(parsedCustomDays) || parsedCustomDays! <= 0)
    ) {
      Alert.alert("Error", "Please enter a valid number of days");
      return;
    }

    let parsedTrialEndDate: Date | undefined;
    if (isTrial) {
      parsedTrialEndDate = new Date(trialEndDate);
      if (!trialEndDate || Number.isNaN(parsedTrialEndDate.getTime())) {
        Alert.alert("Error", "Please enter a valid trial end date");
        return;
      }
    }

    setLoading(true);

    try {
      const subscription = await subscriptionsApi.create({
        name: name.trim(),
        amount: parsedAmount,
        currency,
        // toUpperCase() fixes the lowercase vs UPPERCASE mismatch with backend Zod schema
        billingCycle: billingCycle.toUpperCase(),
        customCycleDays: parsedCustomDays || undefined,
        category: category || "Other",
        startDate: startDate.toISOString(),
        isTrial,
        trialEndDate: parsedTrialEndDate?.toISOString(),
        // Pass array directly — backend expects z.array(z.number()), not a JSON string
        notifyDaysBefore: notifyDays,
        notes: notes.trim() || undefined,
        isActive: true,
      });
      try {
        await scheduleLocalReminders(subscription);
      } catch (notificationError) {
        console.warn("Failed to schedule local reminders:", notificationError);
      }

      Alert.alert("Success", "Subscription added successfully");
      router.back();
    } catch (error: any) {
      const errorMessage = getFriendlyErrorMessage(
        error,
        "We could not add this subscription. Please try again.",
      );
      Alert.alert(
        error.response?.status === 403 ? "Premium Required" : "Could Not Add",
        errorMessage,
        error.response?.status === 403
          ? [
              { text: "Not Now", style: "cancel" },
              { text: "View Premium", onPress: () => router.push("/premium") },
            ]
          : undefined,
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
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.cancelButton}>
          <Text style={[styles.cancelText, { color: colors.accent.primary }]}>Cancel</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.titleBlock}>
        <Text style={[styles.title, { color: colors.text.primary }]}>
          Add Subscription
        </Text>
        <Text style={[styles.subtitle, { color: colors.text.secondary }]}>
          Fill in the details below to start tracking this subscription.
        </Text>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
      >
        {templates.length > 0 && (
          <View style={styles.templatesSection}>
            <Text style={[styles.sectionLabel, { color: colors.text.primary }]}>
              Quick Add
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.templatesScroll}
            >
              {templates.map((template) => (
                <TouchableOpacity
                  key={template.id}
                  style={[
                    styles.templateCard,
                    { backgroundColor: colors.background.card },
                  ]}
                  onPress={() => {
                    setName(template.name);
                    if (
                      "suggestedAmount" in template &&
                      typeof template.suggestedAmount === "number"
                    ) {
                      setAmount(template.suggestedAmount.toString());
                    } else if (template.avgPrice) {
                      setAmount(template.avgPrice.toString());
                    }
                    if (
                      "category" in template &&
                      typeof template.category === "string"
                    ) {
                      setCategory(template.category.toLowerCase());
                    }
                    if (
                      "billingCycle" in template &&
                      typeof template.billingCycle === "string"
                    ) {
                      setBillingCycle(template.billingCycle.toLowerCase());
                    }
                  }}
                >
                  <Text style={styles.templateIcon}>
                    {template.iconUrl || "📱"}
                  </Text>
                  <Text
                    style={[
                      styles.templateName,
                      { color: colors.text.primary },
                    ]}
                  >
                    {template.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        <View
          style={[styles.form, { backgroundColor: colors.background.card }]}
        >
          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: colors.text.primary }]}>
              Subscription Name *
            </Text>
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: colors.background.elevated,
                  color: colors.text.primary,
                  borderColor: colors.border.default,
                },
              ]}
              value={name}
              onChangeText={setName}
              placeholder="e.g., Netflix, Spotify"
              placeholderTextColor={colors.text.muted}
            />
          </View>

          <View style={styles.inputRow}>
            <View style={[styles.inputGroup, { flex: 2 }]}>
              <Text style={[styles.label, { color: colors.text.primary }]}>
                Amount *
              </Text>
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: colors.background.elevated,
                    color: colors.text.primary,
                    borderColor: colors.border.default,
                  },
                ]}
                value={amount}
                onChangeText={setAmount}
                placeholder="0.00"
                keyboardType="decimal-pad"
                placeholderTextColor={colors.text.muted}
              />
            </View>

            <View style={[styles.inputGroup, { flex: 1 }]}>
              <Text style={[styles.label, { color: colors.text.primary }]}>
                Currency
              </Text>
              <View
                style={[
                  styles.pickerContainer,
                  {
                    backgroundColor: colors.background.elevated,
                    borderColor: colors.border.default,
                  },
                ]}
              >
                <Text
                  style={[styles.pickerText, { color: colors.text.primary }]}
                >
                  {currency}
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: colors.text.primary }]}>
              Billing Cycle *
            </Text>
            <View style={styles.cycleButtons}>
              {BillingCycles.map((cycle) => (
                <TouchableOpacity
                  key={cycle.id}
                  style={[
                    styles.cycleButton,
                    {
                      backgroundColor: colors.background.elevated,
                      borderColor: colors.border.default,
                    },
                    billingCycle === cycle.id && {
                      borderColor: colors.accent.primary,
                      backgroundColor: colors.badge.worthItBg,
                    },
                  ]}
                  onPress={() => setBillingCycle(cycle.id)}
                >
                  <Text
                    style={[
                      styles.cycleButtonText,
                      {
                        color:
                          billingCycle === cycle.id
                            ? colors.accent.primary
                            : colors.text.primary,
                      },
                    ]}
                  >
                    {cycle.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {billingCycle === "custom" && (
            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: colors.text.primary }]}>
                Custom Days
              </Text>
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: colors.background.elevated,
                    color: colors.text.primary,
                    borderColor: colors.border.default,
                  },
                ]}
                value={customDays}
                onChangeText={setCustomDays}
                placeholder="30"
                keyboardType="number-pad"
                placeholderTextColor={colors.text.muted}
              />
            </View>
          )}

          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: colors.text.primary }]}>
              Category
            </Text>
            <View style={styles.categoryButtons}>
              {Categories.map((cat) => (
                <TouchableOpacity
                  key={cat.id}
                  style={[
                    styles.categoryButton,
                    {
                      backgroundColor: colors.background.elevated,
                      borderColor: colors.border.default,
                    },
                    category === cat.id && {
                      borderColor: colors.accent.primary,
                      backgroundColor: colors.badge.worthItBg,
                    },
                  ]}
                  onPress={() => setCategory(cat.id)}
                >
                  <Text style={styles.categoryIcon}>{cat.icon}</Text>
                  <Text
                    style={[
                      styles.categoryLabel,
                      {
                        color:
                          category === cat.id
                            ? colors.accent.primary
                            : colors.text.primary,
                      },
                    ]}
                  >
                    {cat.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: colors.text.primary }]}>Trial Protection</Text>
            <TouchableOpacity
              style={[
                styles.toggleRow,
                {
                  backgroundColor: colors.background.elevated,
                  borderColor: isTrial ? colors.accent.primary : colors.border.default,
                },
              ]}
              onPress={() => setIsTrial((current) => !current)}
            >
              <View style={{ flex: 1 }}>
                <Text style={[styles.toggleTitle, { color: colors.text.primary }]}>This is a free trial</Text>
                <Text style={[styles.toggleText, { color: colors.text.secondary }]}>Get extra alerts before it becomes paid</Text>
              </View>
              <Ionicons
                name={isTrial ? "toggle" : "toggle-outline"}
                size={34}
                color={isTrial ? colors.accent.primary : colors.text.muted}
              />
            </TouchableOpacity>
          </View>

          {isTrial && (
            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: colors.text.primary }]}>Trial End Date</Text>
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: colors.background.elevated,
                    color: colors.text.primary,
                    borderColor: colors.border.default,
                  },
                ]}
                value={trialEndDate}
                onChangeText={setTrialEndDate}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={colors.text.muted}
              />
            </View>
          )}

          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: colors.text.primary }]}>Smart Reminders</Text>
            <View style={styles.reminderButtons}>
              {NotificationOptions.map((option) => {
                const selected = notifyDays.includes(option.days);
                return (
                  <TouchableOpacity
                    key={option.days}
                    style={[
                      styles.reminderButton,
                      {
                        backgroundColor: selected ? colors.badge.worthItBg : colors.background.elevated,
                        borderColor: selected ? colors.accent.primary : colors.border.default,
                      },
                    ]}
                    onPress={() =>
                      setNotifyDays((current) =>
                        selected
                          ? current.filter((day) => day !== option.days)
                          : [...current, option.days].sort((a, b) => b - a),
                      )
                    }
                  >
                    <Text
                      style={[
                        styles.reminderText,
                        { color: selected ? colors.accent.primary : colors.text.primary },
                      ]}
                    >
                      {option.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: colors.text.primary }]}>
              Notes (Optional)
            </Text>
            <TextInput
              style={[
                styles.textArea,
                {
                  backgroundColor: colors.background.elevated,
                  color: colors.text.primary,
                  borderColor: colors.border.default,
                },
              ]}
              value={notes}
              onChangeText={setNotes}
              placeholder="Add any notes..."
              placeholderTextColor={colors.text.muted}
              multiline
              numberOfLines={3}
            />
          </View>
        </View>

        <Button
          title={loading ? "Adding..." : "Add Subscription"}
          onPress={handleSubmit}
          disabled={loading}
          style={styles.submitButton}
        />
      </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  pageGlow: { position: "absolute", top: 0, left: 0, right: 0, height: 420 },
  safeArea: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  cancelButton: {
    height: 32,
    justifyContent: "center",
  },
  cancelText: {
    fontSize: 16,
    fontWeight: "600",
  },
  titleBlock: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 16,
  },
  title: {
    fontSize: 26,
    fontWeight: "800",
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 13,
    lineHeight: 18,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingBottom: 100,
  },
  templatesSection: {
    marginBottom: 20,
  },
  sectionLabel: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 12,
  },
  templatesScroll: {
    marginHorizontal: -16,
    paddingHorizontal: 16,
  },
  templateCard: {
    width: 100,
    padding: 12,
    borderRadius: 12,
    alignItems: "center",
    marginRight: 12,
  },
  templateIcon: {
    fontSize: 32,
    marginBottom: 6,
  },
  templateName: {
    fontSize: 12,
    fontWeight: "600",
    textAlign: "center",
  },
  form: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputRow: {
    flexDirection: "row",
    gap: 12,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 8,
  },
  input: {
    borderRadius: 10,
    padding: 12,
    fontSize: 15,
    borderWidth: 1,
  },
  textArea: {
    borderRadius: 10,
    padding: 12,
    fontSize: 15,
    borderWidth: 1,
    minHeight: 80,
    textAlignVertical: "top",
  },
  pickerContainer: {
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  pickerText: {
    fontSize: 15,
    fontWeight: "500",
  },
  cycleButtons: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  cycleButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 2,
  },
  cycleButtonText: {
    fontSize: 14,
    fontWeight: "600",
  },
  categoryButtons: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  categoryButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 2,
  },
  categoryIcon: {
    fontSize: 16,
  },
  categoryLabel: {
    fontSize: 13,
    fontWeight: "600",
  },
  toggleRow: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
  },
  toggleTitle: {
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 3,
  },
  toggleText: {
    fontSize: 12,
    fontWeight: "500",
  },
  reminderButtons: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  reminderButton: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  reminderText: {
    fontSize: 12,
    fontWeight: "700",
  },  submitButton: {
    marginTop: 8,
  },
});







