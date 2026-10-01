// app/add-subscription.tsx
// Two simple steps:
//   1. Pick the service (search, tap a logo) — or add your own.
//   2. Confirm the few details that matter: price, how often, when it started.
// Optional extras (category, reminders, notes) wait under "More options".
// Editing an existing subscription opens straight on step 2.
import BrandLoader from "@/components/BrandLoader";
import Button from "@/components/Button";
import {
  DateInputSheet,
  formatDateLabel,
  parseYmd,
  RowCard,
  toYmd,
  ToggleRow,
  ValueRow,
} from "@/components/FormRow";
import ServiceIcon from "@/components/ServiceIcon";
import { filterServices, findServiceByName, PopularService } from "@/constants/services";
import { BillingCycles, Categories, normalizeCategory, NotificationOptions } from "@/constants/theme";
import { useTheme } from "@/contexts/ThemeContext";
import { getFriendlyErrorMessage, subscriptionsApi } from "@/services/api";
import { formatCurrency } from "@/utils/date";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

// A picked calendar day as an ISO timestamp at 12:00 UTC, so the same calendar
// day shows up in every timezone (midnight can slip a day either way).
const dayToIso = (day: Date) =>
  new Date(Date.UTC(day.getFullYear(), day.getMonth(), day.getDate(), 12)).toISOString();

const DEFAULT_REMINDERS = [7, 3, 1, 0];

// A tappable pill for single- or multi-choice options (category, reminders).
function Chip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      style={[
        styles.chip,
        selected
          ? { backgroundColor: `${colors.accent.primary}26`, borderColor: colors.accent.primary }
          : { backgroundColor: colors.background.elevated, borderColor: "transparent" },
      ]}
    >
      <Text style={[styles.chipText, { color: selected ? colors.accent.primary : colors.text.secondary }]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

export default function AddSubscriptionScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const isEditMode = Boolean(id);

  const [step, setStep] = useState<"pick" | "details">(isEditMode ? "details" : "pick");
  const [query, setQuery] = useState("");
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
  const [notifyDays, setNotifyDays] = useState<number[]>(DEFAULT_REMINDERS);
  const [notes, setNotes] = useState("");
  const [showMore, setShowMore] = useState(false);
  // Prices are always in $. An older subscription saved in another currency
  // shows its original price here so the user can enter the $ amount once.
  const [foreignPrice, setForeignPrice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [dateSheetOpen, setDateSheetOpen] = useState(false);
  const [trialSheetOpen, setTrialSheetOpen] = useState(false);

  const scrollRef = useRef<ScrollView>(null);
  const nameRef = useRef<TextInput>(null);
  const priceRef = useRef<TextInput>(null);
  // Which text box is being typed in — its border lights up so it's obvious.
  const [focused, setFocused] = useState<"name" | "price" | "days" | null>(null);

  useEffect(() => {
    if (!isEditMode) return;

    (async () => {
      try {
        const subscription = await subscriptionsApi.getOne(id!);
        setName(subscription.name);
        const savedCurrency = (subscription.currency || "USD").toUpperCase();
        if (savedCurrency === "USD") {
          setAmount(String(subscription.amount));
        } else {
          setForeignPrice(formatCurrency(Number(subscription.amount), savedCurrency));
          setAmount("");
        }
        setBillingCycle(subscription.billingCycle.toLowerCase());
        if (subscription.customCycleDays) setCustomDays(String(subscription.customCycleDays));
        setCategory(normalizeCategory(subscription.category));
        setStartDate(subscription.startDate.slice(0, 10));
        setIsTrial(Boolean(subscription.isTrial));
        setTrialEndDate(subscription.trialEndDate ? subscription.trialEndDate.slice(0, 10) : "");
        setNotifyDays(subscription.notifyDaysBefore?.length ? subscription.notifyDaysBefore : DEFAULT_REMINDERS);
        setNotes(subscription.notes || "");
      } catch (error: any) {
        Alert.alert("Couldn't Load Subscription", getFriendlyErrorMessage(error, "We couldn't load this subscription. Please try again."));
        router.back();
      } finally {
        setLoadingInitial(false);
      }
    })();
  }, [isEditMode, id, router]);

  // ---- Step 1: pick a service ---------------------------------------------
  const services = filterServices(query);
  const tileWidth = (windowWidth - 32 - 20) / 3;

  const applyService = (service: PopularService) => {
    setName(service.name);
    setAmount(String(service.price));
    setCategory(service.category);
    setBillingCycle(service.billingCycle);
    setStep("details");
  };

  const startCustom = () => {
    const typed = query.trim();
    setName(typed);
    setAmount("");
    setCategory("");
    setBillingCycle("monthly");
    setStep("details");
    // Put the cursor where they need to type next: the name, or (if they
    // already typed one in search) the price.
    setTimeout(() => (typed ? priceRef : nameRef).current?.focus(), 350);
  };

  // ---- Step 2: validation -------------------------------------------------
  // Computed on every render so an error disappears the moment the field is
  // fixed, but only shown after the first Save tap.
  const [submitted, setSubmitted] = useState(false);

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
        billingCycle: billingCycle.toUpperCase(),
        customCycleDays: parsedCustomDays || undefined,
        category: category || "Other",
        startDate: dayToIso(parsedStartDate),
        isTrial,
        trialEndDate: parsedTrialEndDate ? dayToIso(parsedTrialEndDate) : undefined,
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

  const toggleReminder = (day: number) =>
    setNotifyDays((current) =>
      current.includes(day) ? current.filter((d) => d !== day) : [...current, day].sort((a, b) => b - a),
    );

  if (loadingInitial) {
    return (
      <View style={[styles.root, styles.loadingContainer, { backgroundColor: colors.background.primary }]}>
        <BrandLoader />
      </View>
    );
  }

  const service = findServiceByName(name);
  const selectedCategory = Categories.find((cat) => cat.id === category);
  const cycleSuffix =
    billingCycle === "weekly"
      ? "per week"
      : billingCycle === "yearly"
        ? "per year"
        : billingCycle === "custom"
          ? `every ${customDays.trim() || "…"} days`
          : "per month";
  const moreSummary = [
    selectedCategory ? `${selectedCategory.icon} ${selectedCategory.name}` : "No category",
    notifyDays.length ? `${notifyDays.length} reminder${notifyDays.length === 1 ? "" : "s"}` : "No reminders",
    ...(notes.trim() ? ["Note added"] : []),
  ].join("  ·  ");

  const renderPicker = () => (
    <ScrollView
      style={styles.scrollView}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
    >
      <View style={[styles.searchBox, { backgroundColor: colors.background.card }]}>
        <Ionicons name="search" size={18} color={colors.text.muted} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search Netflix, Spotify, iCloud…"
          placeholderTextColor={colors.text.muted}
          selectionColor={colors.accent.primary}
          cursorColor={colors.accent.primary}
          style={[styles.searchInput, { color: colors.text.primary }]}
          autoCorrect={false}
          returnKeyType="next"
          onSubmitEditing={() => (services[0] && query.trim() ? applyService(services[0]) : startCustom())}
        />
        {query ? (
          <TouchableOpacity onPress={() => setQuery("")} hitSlop={10}>
            <Ionicons name="close-circle" size={18} color={colors.text.muted} />
          </TouchableOpacity>
        ) : null}
      </View>

      <TouchableOpacity
        style={[styles.customRow, { backgroundColor: colors.background.card }]}
        onPress={startCustom}
        activeOpacity={0.75}
      >
        <View style={[styles.customIcon, { backgroundColor: `${colors.accent.primary}26` }]}>
          <Ionicons name="add" size={22} color={colors.accent.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.customTitle, { color: colors.text.primary }]} numberOfLines={1}>
            {query.trim() ? `Add “${query.trim()}”` : "Add a custom subscription"}
          </Text>
          <Text style={[styles.customHint, { color: colors.text.muted }]}>
            Not in the list? Enter it yourself
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.text.muted} />
      </TouchableOpacity>

      {services.length > 0 && (
        <Text style={[styles.sectionLabel, { color: colors.text.muted }]}>
          {query.trim() ? "MATCHES" : "POPULAR"}
        </Text>
      )}
      <View style={styles.grid}>
        {services.map((item) => (
          <TouchableOpacity
            key={item.name}
            style={[styles.tile, { width: tileWidth, backgroundColor: colors.background.card }]}
            onPress={() => applyService(item)}
            activeOpacity={0.7}
          >
            <ServiceIcon name={item.name} domain={item.domain} color={item.color} size={44} />
            <Text style={[styles.tileName, { color: colors.text.primary }]} numberOfLines={2}>
              {item.name}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </ScrollView>
  );

  const renderDetails = () => (
    <ScrollView
      ref={scrollRef}
      style={styles.scrollView}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
    >
      {/* Which subscription */}
      <View style={styles.identity}>
        <ServiceIcon
          name={name.trim() || "?"}
          domain={service?.domain}
          color={service?.color ?? colors.accent.secondary}
          size={56}
        />
        {!isEditMode && (
          <TouchableOpacity onPress={() => setStep("pick")} hitSlop={8}>
            <Text style={[styles.changeLink, { color: colors.accent.primary }]}>Change service</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.field}>
        <Text style={[styles.fieldLabel, { color: colors.text.secondary }]}>Subscription name</Text>
        <Pressable
          onPress={() => nameRef.current?.focus()}
          style={[
            styles.inputBox,
            {
              backgroundColor: colors.background.card,
              borderColor: errors.name
                ? colors.status.error
                : focused === "name"
                  ? colors.accent.primary
                  : colors.border.default,
            },
          ]}
        >
          <TextInput
            ref={nameRef}
            value={name}
            onChangeText={setName}
            onFocus={() => setFocused("name")}
            onBlur={() => setFocused(null)}
            placeholder="e.g. Netflix, gym, phone plan"
            placeholderTextColor={colors.text.muted}
            selectionColor={colors.accent.primary}
            cursorColor={colors.accent.primary}
            autoCapitalize="words"
            returnKeyType="next"
            onSubmitEditing={() => priceRef.current?.focus()}
            style={[styles.nameInput, { color: colors.text.primary }]}
          />
        </Pressable>
        {errors.name ? (
          <Text style={[styles.fieldError, { color: colors.status.error }]}>{errors.name}</Text>
        ) : null}
      </View>

      {/* How much and how often */}
      <RowCard style={styles.priceCard}>
        <Text style={[styles.fieldLabel, { color: colors.text.secondary }]}>Price</Text>
        {foreignPrice ? (
          <View style={[styles.foreignNote, { backgroundColor: `${colors.status.warning}1F` }]}>
            <Ionicons name="information-circle-outline" size={16} color={colors.status.warning} />
            <Text style={[styles.foreignNoteText, { color: colors.text.primary }]}>
              This was saved as {foreignPrice}. Enter the price in $.
            </Text>
          </View>
        ) : null}
        <Pressable
          onPress={() => priceRef.current?.focus()}
          style={[
            styles.priceBox,
            {
              backgroundColor: colors.background.elevated,
              borderColor: errors.amount
                ? colors.status.error
                : focused === "price"
                  ? colors.accent.primary
                  : colors.border.default,
            },
          ]}
        >
          <Text style={[styles.currency, { color: colors.text.secondary }]}>$</Text>
          <TextInput
            ref={priceRef}
            value={amount}
            onChangeText={(text) => setAmount(text.replace(",", "."))}
            onFocus={() => setFocused("price")}
            onBlur={() => setFocused(null)}
            placeholder="0.00"
            placeholderTextColor={colors.text.muted}
            selectionColor={colors.accent.primary}
            cursorColor={colors.accent.primary}
            keyboardType="decimal-pad"
            style={[styles.priceInput, { color: colors.text.primary }]}
          />
          <Text style={[styles.perInline, { color: colors.text.muted }]}>{cycleSuffix}</Text>
        </Pressable>
        {errors.amount ? (
          <Text style={[styles.fieldError, { color: colors.status.error }]}>{errors.amount}</Text>
        ) : null}

        <Text style={[styles.fieldLabel, styles.fieldLabelSpaced, { color: colors.text.secondary }]}>
          How often
        </Text>
        <View style={[styles.segment, { backgroundColor: colors.background.elevated }]}>
          {BillingCycles.map((cycle) => {
            const active = cycle.id === billingCycle;
            return (
              <TouchableOpacity
                key={cycle.id}
                style={[styles.segmentItem, active && { backgroundColor: colors.accent.primary }]}
                onPress={() => setBillingCycle(cycle.id)}
                activeOpacity={0.8}
              >
                <Text style={[styles.segmentText, { color: active ? "#FFFFFF" : colors.text.secondary }]}>
                  {cycle.name}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {billingCycle === "custom" && (
          <View style={styles.customDaysRow}>
            <Text style={[styles.customDaysText, { color: colors.text.secondary }]}>Every</Text>
            <TextInput
              value={customDays}
              onChangeText={setCustomDays}
              placeholder="30"
              placeholderTextColor={colors.text.muted}
              selectionColor={colors.accent.primary}
              cursorColor={colors.accent.primary}
              onFocus={() => setFocused("days")}
              onBlur={() => setFocused(null)}
              keyboardType="number-pad"
              style={[
                styles.customDaysInput,
                {
                  color: colors.text.primary,
                  backgroundColor: colors.background.elevated,
                  borderColor: errors.customDays
                    ? colors.status.error
                    : focused === "days"
                      ? colors.accent.primary
                      : colors.border.default,
                },
              ]}
            />
            <Text style={[styles.customDaysText, { color: colors.text.secondary }]}>days</Text>
          </View>
        )}
        {errors.customDays ? (
          <Text style={[styles.fieldError, styles.center, { color: colors.status.error }]}>{errors.customDays}</Text>
        ) : null}
      </RowCard>

      {/* When */}
      <RowCard>
        <ValueRow
          first
          label="Started on"
          value={formatDateLabel(startDate)}
          error={errors.startDate}
          onPress={() => setDateSheetOpen(true)}
        />
        <ToggleRow
          label="Free trial"
          subtitle="We'll remind you before it turns paid"
          value={isTrial}
          onValueChange={setIsTrial}
        />
        {isTrial && (
          <ValueRow
            label="Trial ends"
            value={formatDateLabel(trialEndDate)}
            error={errors.trialEndDate}
            onPress={() => setTrialSheetOpen(true)}
          />
        )}
      </RowCard>

      {/* Optional extras */}
      <TouchableOpacity
        style={[styles.moreToggle, { backgroundColor: colors.background.card }]}
        onPress={() => setShowMore((open) => !open)}
        activeOpacity={0.75}
      >
        <View style={{ flex: 1 }}>
          <Text style={[styles.moreTitle, { color: colors.text.primary }]}>More options</Text>
          <Text style={[styles.moreSummary, { color: colors.text.muted }]} numberOfLines={1}>
            {moreSummary}
          </Text>
        </View>
        <Ionicons name={showMore ? "chevron-up" : "chevron-down"} size={18} color={colors.text.muted} />
      </TouchableOpacity>

      {showMore && (
        <RowCard style={styles.moreCard}>
          <Text style={[styles.cardLabel, styles.cardLabelLeft, { color: colors.text.muted }]}>CATEGORY</Text>
          <View style={styles.chips}>
            {Categories.map((cat) => (
              <Chip
                key={cat.id}
                label={`${cat.icon} ${cat.name}`}
                selected={category === cat.id}
                onPress={() => setCategory(category === cat.id ? "" : cat.id)}
              />
            ))}
          </View>

          <Text style={[styles.cardLabel, styles.cardLabelLeft, { color: colors.text.muted }]}>REMIND ME</Text>
          <View style={styles.chips}>
            {NotificationOptions.map((option) => (
              <Chip
                key={option.days}
                label={option.label}
                selected={notifyDays.includes(option.days)}
                onPress={() => toggleReminder(option.days)}
              />
            ))}
          </View>

          <Text style={[styles.cardLabel, styles.cardLabelLeft, { color: colors.text.muted }]}>NOTES</Text>
          <TextInput
            style={[
              styles.notesInput,
              { color: colors.text.primary, backgroundColor: colors.background.elevated },
            ]}
            value={notes}
            onChangeText={setNotes}
            placeholder="Anything to remember about it…"
            placeholderTextColor={colors.text.muted}
            selectionColor={colors.accent.primary}
            cursorColor={colors.accent.primary}
            multiline
          />
        </RowCard>
      )}
    </ScrollView>
  );

  return (
    <View style={[styles.root, { backgroundColor: colors.background.primary }]}>
      <LinearGradient
        colors={colors.gradient.pageGlow as readonly [string, string, ...string[]]}
        style={styles.pageGlow}
        pointerEvents="none"
      />
      <SafeAreaView style={styles.safeArea} edges={["top"]}>
        <KeyboardAvoidingView style={styles.safeArea} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <View style={styles.header}>
            {step === "details" && !isEditMode ? (
              <TouchableOpacity onPress={() => setStep("pick")} style={styles.headerSide} hitSlop={10}>
                <Ionicons name="chevron-back" size={24} color={colors.accent.primary} />
              </TouchableOpacity>
            ) : (
              <View style={styles.headerSide} />
            )}
            <Text style={[styles.headerTitle, { color: colors.text.primary }]}>
              {isEditMode ? "Edit subscription" : step === "pick" ? "Add subscription" : "Details"}
            </Text>
            <TouchableOpacity onPress={() => router.back()} style={[styles.headerSide, styles.headerRight]} hitSlop={10}>
              <Text style={[styles.cancelText, { color: colors.accent.primary }]}>Cancel</Text>
            </TouchableOpacity>
          </View>

          {step === "pick" ? renderPicker() : renderDetails()}

          {step === "details" && (
            <View
              style={[
                styles.footer,
                {
                  paddingBottom: Math.max(insets.bottom, 12),
                  borderTopColor: colors.border.light,
                  backgroundColor: colors.background.primary,
                },
              ]}
            >
              {submitted && hasProblems ? (
                <Text style={[styles.formError, { color: colors.status.error }]}>
                  Please check the fields marked in red.
                </Text>
              ) : null}
              <Button
                title={loading ? (isEditMode ? "Saving..." : "Adding...") : isEditMode ? "Save Changes" : "Add Subscription"}
                onPress={handleSubmit}
                loading={loading}
                disabled={loading}
              />
            </View>
          )}
        </KeyboardAvoidingView>
      </SafeAreaView>

      <DateInputSheet
        visible={dateSheetOpen}
        title="Started on"
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
        minDate={new Date()}
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
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 6,
  },
  headerSide: { width: 70, height: 36, justifyContent: "center" },
  headerRight: { alignItems: "flex-end" },
  headerTitle: { fontSize: 17, fontWeight: "800" },
  cancelText: { fontSize: 16, fontWeight: "600" },

  scrollView: { flex: 1 },
  content: { padding: 16, paddingBottom: 32, gap: 14 },
  sectionLabel: { fontSize: 11, fontWeight: "800", letterSpacing: 0.6, marginTop: 4, marginLeft: 2 },

  // Step 1
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 16,
    paddingHorizontal: 14,
    height: 50,
  },
  searchInput: { flex: 1, fontSize: 16, fontWeight: "600" },
  customRow: { flexDirection: "row", alignItems: "center", gap: 12, borderRadius: 18, padding: 14 },
  customIcon: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  customTitle: { fontSize: 15, fontWeight: "700" },
  customHint: { fontSize: 12, fontWeight: "500", marginTop: 2 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  tile: { alignItems: "center", borderRadius: 18, paddingVertical: 14, paddingHorizontal: 6, gap: 8 },
  tileName: { fontSize: 12, fontWeight: "700", textAlign: "center" },

  // Step 2
  identity: { alignItems: "center", gap: 8, paddingTop: 2 },
  changeLink: { fontSize: 13, fontWeight: "700" },
  field: { gap: 6 },
  fieldLabel: { fontSize: 13, fontWeight: "700", marginLeft: 2 },
  fieldLabelSpaced: { marginTop: 16, marginBottom: 6 },
  fieldError: { fontSize: 12, fontWeight: "600", marginLeft: 2, marginTop: 4 },
  center: { textAlign: "center" },
  inputBox: { borderWidth: 1.5, borderRadius: 14, paddingHorizontal: 14, height: 52, justifyContent: "center" },
  nameInput: { fontSize: 17, fontWeight: "700", padding: 0 },

  priceCard: { paddingVertical: 16, alignItems: "stretch" },
  priceBox: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1.5,
    borderRadius: 14,
    paddingHorizontal: 14,
    height: 60,
    marginTop: 6,
  },
  currency: { fontSize: 24, fontWeight: "700", marginRight: 6 },
  priceInput: { flex: 1, fontSize: 28, fontWeight: "800", padding: 0 },
  perInline: { fontSize: 14, fontWeight: "600", marginLeft: 8 },
  foreignNote: { flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 12, padding: 10, marginTop: 6 },
  foreignNoteText: { flex: 1, fontSize: 13, fontWeight: "600", lineHeight: 18 },
  cardLabel: { fontSize: 11, fontWeight: "800", letterSpacing: 0.6, textAlign: "center" },
  cardLabelLeft: { textAlign: "left", marginTop: 4 },
  segment: { flexDirection: "row", borderRadius: 14, padding: 4 },
  segmentItem: { flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: 9, borderRadius: 10 },
  segmentText: { fontSize: 13, fontWeight: "700" },
  customDaysRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, marginTop: 12 },
  customDaysText: { fontSize: 15, fontWeight: "600" },
  customDaysInput: {
    borderWidth: 1.5,
    borderRadius: 10,
    minWidth: 64,
    paddingVertical: 8,
    paddingHorizontal: 10,
    fontSize: 16,
    fontWeight: "700",
    textAlign: "center",
  },

  moreToggle: { flexDirection: "row", alignItems: "center", gap: 10, borderRadius: 18, padding: 16 },
  moreTitle: { fontSize: 15, fontWeight: "700" },
  moreSummary: { fontSize: 12, fontWeight: "500", marginTop: 3 },
  moreCard: { paddingVertical: 14, gap: 10 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 },
  chipText: { fontSize: 13, fontWeight: "700" },
  notesInput: { borderRadius: 12, padding: 12, fontSize: 14, minHeight: 70, textAlignVertical: "top" },

  footer: { paddingHorizontal: 16, paddingTop: 12, borderTopWidth: 1, gap: 8 },
  formError: { fontSize: 13, fontWeight: "700", textAlign: "center" },
});
