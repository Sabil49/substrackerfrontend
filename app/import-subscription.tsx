// app/import-subscription.tsx
import Button from "@/components/Button";
import {
  DateInputSheet,
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
import { BillingCycles, Categories, NotificationOptions } from "@/constants/theme";
import { useTheme } from "@/contexts/ThemeContext";
import {
  getFriendlyErrorMessage,
  importApi,
  subscriptionsApi,
  userApi,
} from "@/services/api";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
import {
  Alert,
  Image,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const DEFAULT_REMINDERS = [7, 3, 1, 0];

// The receipt reader accepts images up to about 5 MB (base64 text is ~4/3 the
// size of the picture), so bigger ones are rejected here with a clear message
// instead of failing after a long upload.
const MAX_IMAGE_BASE64_CHARS = 6_500_000;

function normalizeDateInput(value: string | null | undefined) {
  if (!value) return "";
  return value.slice(0, 10);
}

function toIsoDate(value: string) {
  const day = parseYmd(value);
  if (!day) return null;
  return new Date(Date.UTC(day.getFullYear(), day.getMonth(), day.getDate(), 12)).toISOString();
}

export default function ImportSubscriptionScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [mimeType, setMimeType] = useState("image/jpeg");
  // Receipt scanning is a Premium feature: find out up front, so free users see
  // an upgrade prompt instead of picking a photo and then being turned away.
  const [plan, setPlan] = useState<"checking" | "free" | "premium">("checking");
  const [extracting, setExtracting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confidence, setConfidence] = useState<number | null>(null);

  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [billingCycle, setBillingCycle] = useState("monthly");
  const [category, setCategory] = useState("other");
  const [startDate, setStartDate] = useState(toYmd(new Date()));
  const [isTrial, setIsTrial] = useState(false);
  const [trialEndDate, setTrialEndDate] = useState("");
  const [notifyDays, setNotifyDays] = useState<number[]>(DEFAULT_REMINDERS);
  const [notes, setNotes] = useState("");
  const [receiptImageUrl, setReceiptImageUrl] = useState<string | null>(null);

  const [periodSheetOpen, setPeriodSheetOpen] = useState(false);
  const [remindSheetOpen, setRemindSheetOpen] = useState(false);
  const [dateSheetOpen, setDateSheetOpen] = useState(false);
  const [trialSheetOpen, setTrialSheetOpen] = useState(false);
  const [categorySheetOpen, setCategorySheetOpen] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      userApi
        .get()
        .then((user) => active && setPlan(user.isPro ? "premium" : "free"))
        // If the check itself fails, don't block — the server enforces it anyway.
        .catch(() => active && setPlan("premium"));
      return () => {
        active = false;
      };
    }, []),
  );

  const hasExtraction = Boolean(name || amount || notes || confidence !== null);

  const pickImage = async () => {
    const existingPermission =
      await ImagePicker.getMediaLibraryPermissionsAsync();
    const permission = existingPermission.granted
      ? existingPermission
      : await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      Alert.alert(
        "Photo Access Needed",
        "Allow photo access in Settings to import receipt screenshots. You can still add subscriptions manually.",
        [
          { text: "Not Now", style: "cancel" },
          { text: "Add Manually", onPress: () => router.replace("/add-subscription") },
          { text: "Open Settings", onPress: () => Linking.openSettings() },
        ],
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      quality: 0.6,
      base64: true,
    });

    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    if (!asset.base64) {
      Alert.alert("Couldn't Read Image", "Please choose another screenshot or receipt.");
      return;
    }

    if (asset.base64.length > MAX_IMAGE_BASE64_CHARS) {
      Alert.alert(
        "Image Too Large",
        "That image is too large to read. Try a smaller screenshot, or crop it first.",
      );
      return;
    }

    setImageUri(asset.uri);
    setImageBase64(asset.base64);
    setMimeType(asset.mimeType || "image/jpeg");
    setConfidence(null);
  };

  const takePhoto = async () => {
    const existingPermission = await ImagePicker.getCameraPermissionsAsync();
    const permission = existingPermission.granted
      ? existingPermission
      : await ImagePicker.requestCameraPermissionsAsync();

    if (!permission.granted) {
      Alert.alert(
        "Camera Access Needed",
        "Allow camera access in Settings to photograph a receipt, or choose one from your gallery instead.",
        [
          { text: "Not Now", style: "cancel" },
          { text: "Use Gallery Instead", onPress: pickImage },
          { text: "Open Settings", onPress: () => Linking.openSettings() },
        ],
      );
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: false,
      quality: 0.6,
      base64: true,
    });

    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    if (!asset.base64) {
      Alert.alert("Couldn't Read Image", "Please try again or choose a screenshot from your gallery.");
      return;
    }

    if (asset.base64.length > MAX_IMAGE_BASE64_CHARS) {
      Alert.alert(
        "Image Too Large",
        "That image is too large to read. Try a smaller screenshot, or crop it first.",
      );
      return;
    }

    setImageUri(asset.uri);
    setImageBase64(asset.base64);
    setMimeType(asset.mimeType || "image/jpeg");
    setConfidence(null);
  };

  const extractReceipt = async () => {
    if (!imageBase64) {
      await pickImage();
      return;
    }

    setExtracting(true);
    try {
      const extracted = await importApi.receipt({ imageBase64, mimeType });
      setName(extracted.name || "");
      setAmount(extracted.amount ? String(extracted.amount) : "");
      setCurrency(extracted.currency || "USD");
      setBillingCycle((extracted.billingCycle || "monthly").toLowerCase());
      setCategory((extracted.category || "other").toLowerCase());
      setStartDate(normalizeDateInput(extracted.startDate) || toYmd(new Date()));
      setIsTrial(Boolean(extracted.isTrial));
      setTrialEndDate(normalizeDateInput(extracted.trialEndDate));
      setNotes(extracted.notes || "Imported from receipt screenshot");
      setConfidence(extracted.confidence);
      setReceiptImageUrl(extracted.receiptImageUrl || null);
    } catch (error: any) {
      const isPremiumRequired = error?.code === "functions/permission-denied";
      const title = isPremiumRequired ? "Premium Feature" : "Couldn't Read Receipt";
      Alert.alert(title, getFriendlyErrorMessage(error, "We could not read that receipt. Try a clearer screenshot."),
        isPremiumRequired
          ? [
              { text: "Not Now", style: "cancel" },
              { text: "Upgrade", onPress: () => router.push("/premium") },
            ]
          : undefined,
      );
    } finally {
      setExtracting(false);
    }
  };

  const saveSubscription = async () => {
    if (!name.trim()) {
      Alert.alert("Name Needed", "Please enter a name for this subscription.");
      return;
    }

    const parsedAmount = Number(amount);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      Alert.alert("Price Needed", "Please enter the price you pay, for example 9.99.");
      return;
    }

    const startIso = toIsoDate(startDate);
    if (!startIso) {
      Alert.alert("Start Date Needed", "Please choose the date this subscription started.");
      return;
    }

    const trialIso = isTrial ? toIsoDate(trialEndDate) : null;
    if (isTrial && !trialIso) {
      Alert.alert("Trial End Date Needed", "Please choose the date your free trial ends.");
      return;
    }

    setSaving(true);
    try {
      await subscriptionsApi.create({
        name: name.trim(),
        amount: parsedAmount,
        currency: currency.trim().toUpperCase() || "USD",
        billingCycle: billingCycle.toUpperCase(),
        category: category || "Other",
        startDate: startIso,
        isTrial,
        trialEndDate: trialIso || undefined,
        notifyDaysBefore: notifyDays,
        notes: notes.trim() || "Imported from receipt screenshot",
        isActive: true,
        ...(receiptImageUrl ? { receiptImageUrl } : {}),
      });

      Alert.alert("Subscription Added", "Imported subscription saved successfully.", [
        { text: "OK", onPress: () => router.replace("/") },
      ]);
    } catch (error: any) {
      Alert.alert(
        "Couldn't Save",
        getFriendlyErrorMessage(error, "We couldn't save this subscription. Please try again."),
      );
    } finally {
      setSaving(false);
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
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          {hasExtraction ? (
            <View style={styles.backRow}>
              <Ionicons name="chevron-back" size={18} color={colors.accent.primary} />
              <Text style={[styles.backText, { color: colors.accent.primary }]}>Back</Text>
            </View>
          ) : (
            <Text style={[styles.backText, { color: colors.accent.primary }]}>Cancel</Text>
          )}
        </TouchableOpacity>
        {hasExtraction && confidence !== null && (
          <View style={[styles.matchPill, { backgroundColor: "rgba(52,211,153,0.16)" }]}>
            <Text style={[styles.matchPillText, { color: colors.status.success }]}>
              {Math.round(confidence * 100)}% match
            </Text>
          </View>
        )}
      </View>

      <View style={styles.titleBlock}>
        <Text style={[styles.stepLabel, { color: colors.text.muted }]}>
          {hasExtraction ? "STEP 2 OF 2" : "STEP 1 OF 2"}
        </Text>
        <Text style={[styles.title, { color: colors.text.primary }]}>
          {hasExtraction ? "Review details" : "Scan a subscription"}
        </Text>
        <Text style={[styles.subtitle, { color: colors.text.secondary }]}>
          {hasExtraction
            ? "Check what we found, then save it to your list."
            : "Snap or upload a screenshot and we'll fill in the details for you."}
        </Text>
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        {!hasExtraction && plan === "free" && (
          <View style={styles.dropzone}>
            <View style={[styles.captureIconWrap, { backgroundColor: "rgba(59,130,246,0.16)" }]}>
              <Ionicons name="sparkles" size={30} color={colors.accent.primary} />
            </View>
            <Text style={[styles.dropzoneTitle, { color: colors.text.primary }]}>
              Receipt scanning is a Premium feature
            </Text>
            <Text style={[styles.dropzoneSub, { color: colors.text.muted }]}>
              Upgrade to add subscriptions from a screenshot or photo, or add this one by hand.
            </Text>
            <Button title="Get Premium" onPress={() => router.push("/premium")} style={styles.buttonFull} />
            <Button
              title="Add Manually"
              onPress={() => router.replace("/add-subscription")}
              variant="secondary"
              style={styles.buttonFull}
            />
          </View>
        )}

        {!hasExtraction && plan !== "free" && (
          <View style={styles.dropzone}>
            {imageUri ? (
              <Image source={{ uri: imageUri }} style={styles.previewImage} />
            ) : (
              <View style={[styles.captureIconWrap, { backgroundColor: "rgba(59,130,246,0.16)" }]}>
                <Ionicons name="camera-outline" size={30} color={colors.accent.primary} />
              </View>
            )}
            <Text style={[styles.dropzoneTitle, { color: colors.text.primary }]}>
              {imageUri ? "Screenshot ready" : "Drop a screenshot here"}
            </Text>
            <Text style={[styles.dropzoneSub, { color: colors.text.muted }]}>
              {imageUri ? "Tap Read Receipt to extract the details" : "or choose an option below"}
            </Text>
            {imageUri ? (
              <Button title={extracting ? "Reading..." : "Read Receipt"} onPress={extractReceipt} loading={extracting} disabled={extracting} style={styles.buttonFull} />
            ) : (
              <View style={styles.buttonRow}>
                <Button title="Take Photo" onPress={takePhoto} variant="secondary" style={styles.buttonHalf} />
                <Button title="Gallery" onPress={pickImage} variant="secondary" style={styles.buttonHalf} />
              </View>
            )}
            <Text style={[styles.privacyCaption, { color: colors.text.disabled }]}>
              We only use this to read subscription details.
            </Text>
          </View>
        )}

        {hasExtraction && (
          <>
            <RowCard style={styles.nameCard}>
              <TextInput
                style={[styles.nameInput, { color: colors.text.primary }]}
                value={name}
                onChangeText={setName}
                placeholder="Subscription name (e.g., Netflix)"
                placeholderTextColor={colors.text.muted}
              />
            </RowCard>

            <RowCard style={styles.reviewCard}>
              <ToggleRow
                first
                label="Trial"
                subtitle="Alert before it becomes paid"
                value={isTrial}
                onValueChange={setIsTrial}
              />
              {isTrial && (
                <ValueRow
                  label="Trial ends"
                  value={formatDateLabel(trialEndDate)}
                  onPress={() => setTrialSheetOpen(true)}
                />
              )}
              <TextFieldRow
                label="Price"
                value={amount}
                onChangeText={setAmount}
                placeholder="0.00"
                keyboardType="decimal-pad"
                prefix={currency === "USD" ? "$" : currency}
              />
              <ValueRow label="Started" value={formatDateLabel(startDate)} onPress={() => setDateSheetOpen(true)} />
              <ValueRow
                label="Period"
                value={BillingCycles.find((cycle) => cycle.id === billingCycle)?.name || "Monthly"}
                onPress={() => setPeriodSheetOpen(true)}
              />
              <ValueRow
                label="Remind me"
                value={formatRemindSummary(notifyDays)}
                onPress={() => setRemindSheetOpen(true)}
              />
            </RowCard>

            <RowCard style={styles.reviewCard}>
              <ValueRow
                first
                label="Category"
                value={
                  Categories.find((cat) => cat.id === category)
                    ? `${Categories.find((cat) => cat.id === category)!.icon} ${Categories.find((cat) => cat.id === category)!.name}`
                    : "Other"
                }
                onPress={() => setCategorySheetOpen(true)}
              />
              <View style={styles.notesRow}>
                <Text style={[styles.notesLabel, { color: colors.text.primary }]}>Notes</Text>
                <TextInput
                  style={[styles.textArea, { color: colors.text.primary, borderColor: colors.border.default }]}
                  value={notes}
                  onChangeText={setNotes}
                  placeholder="Imported notes..."
                  placeholderTextColor={colors.text.muted}
                  multiline
                  numberOfLines={3}
                />
              </View>
            </RowCard>

            <Button title={saving ? "Saving..." : "Save Subscription"} onPress={saveSubscription} loading={saving} disabled={saving} />

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
                  current.includes(day) ? current.filter((d) => d !== day) : [...current, day].sort((a, b) => b - a),
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
          </>
        )}
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
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  backButton: { minHeight: 32, justifyContent: "center" },
  backRow: { flexDirection: "row", alignItems: "center", gap: 2 },
  backText: { fontSize: 16, fontWeight: "600" },
  matchPill: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 },
  matchPillText: { fontSize: 12, fontWeight: "800" },
  titleBlock: { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 16 },
  stepLabel: { fontSize: 11, fontWeight: "800", letterSpacing: 0.6, textTransform: "uppercase", marginBottom: 6 },
  title: { fontSize: 26, fontWeight: "800", marginBottom: 6 },
  subtitle: { fontSize: 13, lineHeight: 18 },
  scrollView: { flex: 1 },
  content: { padding: 16, paddingBottom: 80 },
  dropzone: {
    borderRadius: 24,
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderColor: "rgba(59,130,246,0.35)",
    backgroundColor: "rgba(59,130,246,0.05)",
    padding: 28,
    alignItems: "center",
    marginBottom: 16,
  },
  captureIconWrap: {
    width: 64, height: 64, borderRadius: 32,
    justifyContent: "center", alignItems: "center", marginBottom: 14,
  },
  previewImage: { width: "100%", height: 200, borderRadius: 16, marginBottom: 14, resizeMode: "cover" },
  dropzoneTitle: { fontSize: 17, fontWeight: "800", marginBottom: 4, textAlign: "center" },
  dropzoneSub: { fontSize: 13, fontWeight: "500", marginBottom: 18, textAlign: "center" },
  privacyCaption: { fontSize: 11.5, fontWeight: "500", textAlign: "center", marginTop: 16 },
  buttonRow: { flexDirection: "row", gap: 12, width: "100%" },
  buttonHalf: { flex: 1 },
  buttonFull: { width: "100%" },
  nameCard: { paddingVertical: 4, marginBottom: 14 },
  nameInput: { fontSize: 18, fontWeight: "800", paddingVertical: 14 },
  reviewCard: { marginBottom: 14 },
  notesRow: { paddingVertical: 15, gap: 8 },
  notesLabel: { fontSize: 15, fontWeight: "600" },
  textArea: { borderRadius: 10, padding: 12, fontSize: 14, borderWidth: 1, minHeight: 70, textAlignVertical: "top" },
});




