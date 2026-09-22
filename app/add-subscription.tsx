// app/add-subscription.tsx
import Button from "@/components/Button";
import {
  DateInputSheet,
  formatRemindSummary,
  OptionSheet,
  RowCard,
  TextFieldRow,
  ToggleRow,
  ValueRow,
} from "@/components/FormRow";
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
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";

export default function AddSubscriptionScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const isEditMode = Boolean(id);

  const [loadingInitial, setLoadingInitial] = useState(isEditMode);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [currency] = useState("USD");
  const [billingCycle, setBillingCycle] = useState("monthly");
  const [customDays, setCustomDays] = useState("");
  const [category, setCategory] = useState("");
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [isTrial, setIsTrial] = useState(false);
  const [trialEndDate, setTrialEndDate] = useState("");
  const [notifyDays, setNotifyDays] = useState<number[]>([7, 3, 1, 0]);
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);

  const [periodSheetOpen, setPeriodSheetOpen] = useState(false);
  const [remindSheetOpen, setRemindSheetOpen] = useState(false);
  const [dateSheetOpen, setDateSheetOpen] = useState(false);
  const [categorySheetOpen, setCategorySheetOpen] = useState(false);

  useEffect(() => {
    if (!isEditMode) {
      loadTemplates();
      return;
    }

    (async () => {
      try {
        const subscription = await subscriptionsApi.getOne(id!);
        setName(subscription.name);
        setAmount(String(subscription.amount));
        setBillingCycle(subscription.billingCycle.toLowerCase());
        if (subscription.customCycleDays) setCustomDays(String(subscription.customCycleDays));
        setCategory((subscription.category || "").toLowerCase());
        setStartDate(subscription.startDate.slice(0, 10));
        setIsTrial(Boolean(subscription.isTrial));
        setTrialEndDate(subscription.trialEndDate ? subscription.trialEndDate.slice(0, 10) : "");
        setNotifyDays(subscription.notifyDaysBefore?.length ? subscription.notifyDaysBefore : [7, 3, 1, 0]);
        setNotes(subscription.notes || "");
      } catch (error: any) {
        Alert.alert("Error", getFriendlyErrorMessage(error, "Could not load this subscription."));
        router.back();
      } finally {
        setLoadingInitial(false);
      }
    })();
  }, [isEditMode, id, router]);

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

    const parsedStartDate = new Date(startDate);
    if (!startDate || Number.isNaN(parsedStartDate.getTime())) {
      Alert.alert("Error", "Please enter a valid start date (YYYY-MM-DD)");
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
      if (isEditMode) {
        const updated = await subscriptionsApi.update(id!, {
          name: name.trim(),
          amount: parsedAmount,
          currency,
          billingCycle: billingCycle.toUpperCase(),
          customCycleDays: parsedCustomDays || undefined,
          category: category || "other",
          startDate: parsedStartDate.toISOString(),
          isTrial,
          trialEndDate: isTrial ? parsedTrialEndDate?.toISOString() : null,
          notifyDaysBefore: notifyDays,
          notes: notes.trim() || undefined,
        });
        Alert.alert("Saved", "Subscription updated successfully");
        router.replace(`/subscription/${updated.id}`);
        return;
      }

      const subscription = await subscriptionsApi.create({
        name: name.trim(),
        amount: parsedAmount,
        currency,
        // toUpperCase() fixes the lowercase vs UPPERCASE mismatch with backend Zod schema
        billingCycle: billingCycle.toUpperCase(),
        customCycleDays: parsedCustomDays || undefined,
        category: category || "Other",
        startDate: parsedStartDate.toISOString(),
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
        `We could not ${isEditMode ? "update" : "add"} this subscription. Please try again.`,
      );
      Alert.alert(
        error.response?.status === 403 ? "Premium Required" : "Could Not Save",
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

  const selectedCategory = Categories.find((cat) => cat.id === category);
  const selectedCycle = BillingCycles.find((cycle) => cycle.id === billingCycle);

  if (loadingInitial) {
    return (
      <View style={[styles.root, styles.loadingContainer, { backgroundColor: colors.background.primary }]}>
        <ActivityIndicator size="large" color={colors.accent.primary} />
      </View>
    );
  }

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
            {isEditMode ? "Update subscription" : "Add Subscription"}
          </Text>
          <Text style={[styles.subtitle, { color: colors.text.secondary }]}>
            {isEditMode
              ? "Edit the details below to keep this subscription accurate."
              : "Fill in the details below to start tracking this subscription."}
          </Text>
        </View>

        <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
          {!isEditMode && templates.length > 0 && (
            <View style={styles.templatesSection}>
              <Text style={[styles.sectionLabel, { color: colors.text.primary }]}>Quick Add</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.templatesScroll}>
                {templates.map((template) => (
                  <TouchableOpacity
                    key={template.id}
                    style={[styles.templateCard, { backgroundColor: colors.background.card }]}
                    onPress={() => {
                      setName(template.name);
                      if ("suggestedAmount" in template && typeof template.suggestedAmount === "number") {
                        setAmount(template.suggestedAmount.toString());
                      } else if (template.avgPrice) {
                        setAmount(template.avgPrice.toString());
                      }
                      if ("category" in template && typeof template.category === "string") {
                        setCategory(template.category.toLowerCase());
                      }
                      if ("billingCycle" in template && typeof template.billingCycle === "string") {
                        setBillingCycle(template.billingCycle.toLowerCase());
                      }
                    }}
                  >
                    <Text style={styles.templateIcon}>{template.iconUrl || "📱"}</Text>
                    <Text style={[styles.templateName, { color: colors.text.primary }]}>{template.name}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}

          <RowCard style={styles.nameCard}>
            <TextInput
              style={[styles.nameInput, { color: colors.text.primary }]}
              value={name}
              onChangeText={setName}
              placeholder="Subscription name (e.g., Netflix)"
              placeholderTextColor={colors.text.muted}
            />
          </RowCard>

          <RowCard style={styles.formCard}>
            <ToggleRow
              first
              label="Trial"
              subtitle="Get extra alerts before it becomes paid"
              value={isTrial}
              onValueChange={setIsTrial}
            />
            {isTrial && (
              <TextFieldRow
                label="Trial ends"
                value={trialEndDate}
                onChangeText={setTrialEndDate}
                placeholder="YYYY-MM-DD"
              />
            )}
            <TextFieldRow
              label="Price"
              value={amount}
              onChangeText={setAmount}
              placeholder="0.00"
              keyboardType="decimal-pad"
              prefix="$"
            />
            <ValueRow label="Started" value={startDate} onPress={() => setDateSheetOpen(true)} />
            <ValueRow
              label="Period"
              value={selectedCycle?.name || "Monthly"}
              onPress={() => setPeriodSheetOpen(true)}
            />
            {billingCycle === "custom" && (
              <TextFieldRow
                label="Custom days"
                value={customDays}
                onChangeText={setCustomDays}
                placeholder="30"
                keyboardType="number-pad"
              />
            )}
            <ValueRow
              label="Remind me"
              value={formatRemindSummary(notifyDays)}
              onPress={() => setRemindSheetOpen(true)}
            />
          </RowCard>

          <RowCard style={styles.formCard}>
            <ValueRow
              first
              label="Category"
              value={selectedCategory ? `${selectedCategory.icon} ${selectedCategory.name}` : "Other"}
              onPress={() => setCategorySheetOpen(true)}
            />
            <View style={styles.notesRow}>
              <Text style={[styles.notesLabel, { color: colors.text.primary }]}>Notes</Text>
              <TextInput
                style={[
                  styles.notesInput,
                  { color: colors.text.primary, borderColor: colors.border.default },
                ]}
                value={notes}
                onChangeText={setNotes}
                placeholder="Add any notes..."
                placeholderTextColor={colors.text.muted}
                multiline
                numberOfLines={3}
              />
            </View>
          </RowCard>

          <Button
            title={loading ? (isEditMode ? "Saving..." : "Adding...") : isEditMode ? "Save" : "Add Subscription"}
            onPress={handleSubmit}
            disabled={loading}
            style={styles.submitButton}
          />
        </ScrollView>
      </SafeAreaView>

      <OptionSheet
        visible={periodSheetOpen}
        title="Period"
        options={BillingCycles.map((cycle) => ({ id: cycle.id, label: cycle.name }))}
        selectedIds={[billingCycle]}
        onToggle={setBillingCycle}
        onClose={() => setPeriodSheetOpen(false)}
      />
      <OptionSheet
        visible={categorySheetOpen}
        title="Category"
        options={Categories.map((cat) => ({ id: cat.id, label: `${cat.icon} ${cat.name}` }))}
        selectedIds={[category]}
        onToggle={setCategory}
        onClose={() => setCategorySheetOpen(false)}
      />
      <OptionSheet
        visible={remindSheetOpen}
        title="Remind me"
        multiSelect
        options={NotificationOptions.map((option) => ({ id: String(option.days), label: option.label }))}
        selectedIds={notifyDays.map(String)}
        onToggle={(idValue) => {
          const day = Number(idValue);
          setNotifyDays((current) =>
            current.includes(day)
              ? current.filter((d) => d !== day)
              : [...current, day].sort((a, b) => b - a),
          );
        }}
        onClose={() => setRemindSheetOpen(false)}
      />
      <DateInputSheet
        visible={dateSheetOpen}
        value={startDate}
        onChangeText={setStartDate}
        onClose={() => setDateSheetOpen(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  pageGlow: { position: "absolute", top: 0, left: 0, right: 0, height: 420 },
  safeArea: { flex: 1 },
  loadingContainer: { justifyContent: "center", alignItems: "center" },
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
    gap: 14,
  },
  templatesSection: {
    marginBottom: -2,
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
  nameCard: { paddingVertical: 4 },
  nameInput: { fontSize: 18, fontWeight: "800", paddingVertical: 14 },
  formCard: {},
  notesRow: { paddingVertical: 15, gap: 8 },
  notesLabel: { fontSize: 15, fontWeight: "600" },
  notesInput: {
    borderRadius: 10,
    borderWidth: 1,
    padding: 12,
    fontSize: 14,
    minHeight: 70,
    textAlignVertical: "top",
  },
  submitButton: {
    marginTop: 4,
  },
});
