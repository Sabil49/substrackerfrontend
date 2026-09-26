// app/add-subscription.tsx
import Button from "@/components/Button";
import {
  DateInputSheet,
  FieldLabel,
  formatDateLabel,
  formatRemindSummary,
  OptionSheet,
  parseYmd,
  RowCard,
  TextFieldRow,
  toYmd,
  ToggleRow,
  ValueRow,
} from "@/components/FormRow";
import ServiceIcon from "@/components/ServiceIcon";
import { filterServices, PopularService } from "@/constants/services";
import { BillingCycles, Categories, NotificationOptions } from "@/constants/theme";
import { useTheme } from "@/contexts/ThemeContext";
import { getFriendlyErrorMessage, subscriptionsApi } from "@/services/api";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
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

// A picked calendar day as an ISO timestamp at 12:00 UTC, so the same calendar
// day shows up in every timezone (midnight can slip a day either way).
const dayToIso = (day: Date) =>
  new Date(Date.UTC(day.getFullYear(), day.getMonth(), day.getDate(), 12)).toISOString();

export default function AddSubscriptionScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const isEditMode = Boolean(id);

  const [loadingInitial, setLoadingInitial] = useState(isEditMode);
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [currency] = useState("USD");
  const [billingCycle, setBillingCycle] = useState("monthly");
  const [customDays, setCustomDays] = useState("");
  const [category, setCategory] = useState("");
  const [startDate, setStartDate] = useState(toYmd(new Date()));
  const [isTrial, setIsTrial] = useState(false);
  const [trialEndDate, setTrialEndDate] = useState("");
  const [notifyDays, setNotifyDays] = useState<number[]>([7, 3, 1, 0]);
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);

  const [periodSheetOpen, setPeriodSheetOpen] = useState(false);
  const [remindSheetOpen, setRemindSheetOpen] = useState(false);
  const [dateSheetOpen, setDateSheetOpen] = useState(false);
  const [trialSheetOpen, setTrialSheetOpen] = useState(false);
  const [categorySheetOpen, setCategorySheetOpen] = useState(false);

  useEffect(() => {
    if (!isEditMode) return;

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
        Alert.alert("Couldn't Load Subscription", getFriendlyErrorMessage(error, "We couldn't load this subscription. Please try again."));
        router.back();
      } finally {
        setLoadingInitial(false);
      }
    })();
  }, [isEditMode, id, router]);

  // Popular services, A–Z, narrowed live by whatever is typed in the name box.
  const matchingServices = filterServices(name);

  const applyService = (service: PopularService) => {
    setName(service.name);
    setAmount(String(service.price));
    setCategory(service.category);
    setBillingCycle(service.billingCycle);
  };

  // Required-field check. Computed on every render so an error disappears the
  // moment the user fixes that field, but only shown after the first Save tap.
  const [submitted, setSubmitted] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  const parsedAmount = parseFloat(amount);
  const parsedCustomDays = billingCycle === "custom" ? parseInt(customDays, 10) : undefined;
  const parsedStartDate = parseYmd(startDate);
  const parsedTrialEndDate = isTrial ? (parseYmd(trialEndDate) ?? undefined) : undefined;

  const problems: Partial<
    Record<"name" | "amount" | "customDays" | "startDate" | "trialEndDate", string>
  > = {};
  if (!name.trim()) problems.name = "Enter a name for this subscription";
  if (!amount.trim() || !Number.isFinite(parsedAmount) || parsedAmount <= 0) {
    problems.amount = "Enter the price you pay, e.g. 9.99";
  }
  if (billingCycle === "custom" && (!Number.isFinite(parsedCustomDays) || parsedCustomDays! <= 0)) {
    problems.customDays = "Enter how many days";
  }
  if (!parsedStartDate) problems.startDate = "Choose the start date";
  if (isTrial && !parsedTrialEndDate) problems.trialEndDate = "Choose the trial end date";

  const hasProblems = Object.keys(problems).length > 0;
  const errors = submitted ? problems : {};

  const handleSubmit = async () => {
    setSubmitted(true);
    if (hasProblems || !parsedStartDate) {
      scrollRef.current?.scrollTo({ y: 0, animated: true });
      return;
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
          category: category || "Other",
          startDate: dayToIso(parsedStartDate),
          isTrial,
          trialEndDate: isTrial && parsedTrialEndDate ? dayToIso(parsedTrialEndDate) : null,
          notifyDaysBefore: notifyDays,
          notes: notes.trim() || undefined,
        });
        Alert.alert("Subscription Updated", "Your changes have been saved.");
        router.replace(`/subscription/${updated.id}`);
        return;
      }

      await subscriptionsApi.create({
        name: name.trim(),
        amount: parsedAmount,
        currency,
        // toUpperCase() fixes the lowercase vs UPPERCASE mismatch with backend Zod schema
        billingCycle: billingCycle.toUpperCase(),
        customCycleDays: parsedCustomDays || undefined,
        category: category || "Other",
        startDate: dayToIso(parsedStartDate),
        isTrial,
        trialEndDate: parsedTrialEndDate ? dayToIso(parsedTrialEndDate) : undefined,
        // Pass array directly — backend expects z.array(z.number()), not a JSON string
        notifyDaysBefore: notifyDays,
        notes: notes.trim() || undefined,
        isActive: true,
      });
      // Reminders are rebuilt from the subscription list when the dashboard loads.
      router.back();
    } catch (error: any) {
      const errorMessage = getFriendlyErrorMessage(
        error,
        `We could not ${isEditMode ? "update" : "add"} this subscription. Please try again.`,
      );
      const isPremiumRequired = error?.code === "functions/resource-exhausted";
      Alert.alert(
        isPremiumRequired ? "Free Plan Limit Reached" : "Couldn't Save",
        errorMessage,
        isPremiumRequired
          ? [
              { text: "Not Now", style: "cancel" },
              { text: "Upgrade", onPress: () => router.push("/premium") },
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
          <Text style={[styles.legend, { color: colors.text.muted }]}>
            <Text style={{ color: colors.status.error, fontWeight: "800" }}>*</Text>
            {" Required   ·   Everything else is optional"}
          </Text>
        </View>

        <ScrollView
          ref={scrollRef}
          style={styles.scrollView}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          {!isEditMode && matchingServices.length > 0 && (
            <View style={styles.templatesSection}>
              <Text style={[styles.sectionLabel, { color: colors.text.primary }]}>
                {name.trim() ? "Suggestions" : "Popular services"}
              </Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                style={styles.templatesScroll}
              >
                {matchingServices.map((service) => (
                  <TouchableOpacity
                    key={service.name}
                    style={[styles.templateCard, { backgroundColor: colors.background.card }]}
                    onPress={() => applyService(service)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.templateIcon}>
                      <ServiceIcon
                        name={service.name}
                        domain={service.domain}
                        color={service.color}
                        size={44}
                      />
                    </View>
                    <Text
                      style={[styles.templateName, { color: colors.text.primary }]}
                      numberOfLines={2}
                    >
                      {service.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}

          <RowCard style={styles.nameCard}>
            <View style={styles.nameLabel}>
              <FieldLabel label="Name" required error={errors.name} />
            </View>
            <TextInput
              style={[styles.nameInput, { color: colors.text.primary }]}
              value={name}
              onChangeText={setName}
              placeholder="Type a name, e.g. Netflix"
              placeholderTextColor={colors.text.muted}
            />
          </RowCard>

          <RowCard style={styles.formCard}>
            <ToggleRow
              first
              label="Trial"
              optional
              subtitle="Get extra alerts before it becomes paid"
              value={isTrial}
              onValueChange={setIsTrial}
            />
            {isTrial && (
              <ValueRow
                label="Trial ends"
                required
                error={errors.trialEndDate}
                value={formatDateLabel(trialEndDate)}
                onPress={() => setTrialSheetOpen(true)}
              />
            )}
            <TextFieldRow
              label="Price"
              required
              error={errors.amount}
              value={amount}
              onChangeText={setAmount}
              placeholder="0.00"
              keyboardType="decimal-pad"
              prefix="$"
            />
            <ValueRow
              label="Started"
              required
              error={errors.startDate}
              value={formatDateLabel(startDate)}
              onPress={() => setDateSheetOpen(true)}
            />
            <ValueRow
              label="Period"
              required
              value={selectedCycle?.name || "Monthly"}
              onPress={() => setPeriodSheetOpen(true)}
            />
            {billingCycle === "custom" && (
              <TextFieldRow
                label="Custom days"
                required
                error={errors.customDays}
                value={customDays}
                onChangeText={setCustomDays}
                placeholder="30"
                keyboardType="number-pad"
              />
            )}
            <ValueRow
              label="Remind me"
              optional
              value={formatRemindSummary(notifyDays)}
              onPress={() => setRemindSheetOpen(true)}
            />
          </RowCard>

          <RowCard style={styles.formCard}>
            <ValueRow
              first
              label="Category"
              optional
              value={selectedCategory ? `${selectedCategory.icon} ${selectedCategory.name}` : "Other"}
              onPress={() => setCategorySheetOpen(true)}
            />
            <View style={styles.notesRow}>
              <FieldLabel label="Notes" optional />
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

          {submitted && hasProblems ? (
            <Text style={[styles.formError, { color: colors.status.error }]}>
              Please fill in the required fields marked in red.
            </Text>
          ) : null}

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
        title="Started"
        value={startDate}
        onChangeText={setStartDate}
        onClose={() => setDateSheetOpen(false)}
      />
      <DateInputSheet
        visible={trialSheetOpen}
        title="Trial ends"
        value={trialEndDate}
        onChangeText={setTrialEndDate}
        onClose={() => setTrialSheetOpen(false)}
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
  legend: { fontSize: 12, fontWeight: "600", marginTop: 8 },
  nameLabel: { paddingTop: 14 },
  formError: { fontSize: 13, fontWeight: "700", textAlign: "center", marginBottom: 2 },
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
    width: 96,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 14,
    alignItems: "center",
    marginRight: 10,
  },
  templateIcon: {
    marginBottom: 8,
  },
  templateName: {
    fontSize: 12,
    fontWeight: "600",
    textAlign: "center",
  },
  nameCard: { paddingVertical: 0 },
  nameInput: { fontSize: 18, fontWeight: "800", paddingTop: 6, paddingBottom: 14 },
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
