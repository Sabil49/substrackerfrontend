// app/import-subscription.tsx
import Button from "@/components/Button";
import { BillingCycles, Categories, NotificationOptions } from "@/constants/theme";
import { useTheme } from "@/contexts/ThemeContext";
import {
  getFriendlyErrorMessage,
  importApi,
  subscriptionsApi,
} from "@/services/api";
import {
  checkNotificationPermissions,
  scheduleLocalNotification,
} from "@/services/notifications";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import React, { useState } from "react";
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

function normalizeDateInput(value: string | null | undefined) {
  if (!value) return "";
  return value.slice(0, 10);
}

function toIsoDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

export default function ImportSubscriptionScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [mimeType, setMimeType] = useState("image/jpeg");
  const [extracting, setExtracting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confidence, setConfidence] = useState<number | null>(null);

  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [billingCycle, setBillingCycle] = useState("monthly");
  const [category, setCategory] = useState("other");
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [isTrial, setIsTrial] = useState(false);
  const [trialEndDate, setTrialEndDate] = useState("");
  const [notifyDays, setNotifyDays] = useState<number[]>(DEFAULT_REMINDERS);
  const [notes, setNotes] = useState("");
  const [receiptImageUrl, setReceiptImageUrl] = useState<string | null>(null);

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
      quality: 0.85,
      base64: true,
    });

    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    if (!asset.base64) {
      Alert.alert("Could Not Read Image", "Please choose another screenshot or receipt.");
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
      quality: 0.85,
      base64: true,
    });

    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    if (!asset.base64) {
      Alert.alert("Could Not Read Image", "Please try again or choose a screenshot from your gallery.");
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
      setStartDate(normalizeDateInput(extracted.startDate) || new Date().toISOString().slice(0, 10));
      setIsTrial(Boolean(extracted.isTrial));
      setTrialEndDate(normalizeDateInput(extracted.trialEndDate));
      setNotes(extracted.notes || "Imported from receipt screenshot");
      setConfidence(extracted.confidence);
      setReceiptImageUrl(extracted.receiptImageUrl || null);
    } catch (error: any) {
      const title = error.response?.status === 403 ? "Premium Required" : "Import Failed";
      Alert.alert(title, getFriendlyErrorMessage(error, "We could not read that receipt. Try a clearer screenshot."),
        error.response?.status === 403
          ? [
              { text: "Not Now", style: "cancel" },
              { text: "View Premium", onPress: () => router.push("/premium") },
            ]
          : undefined,
      );
    } finally {
      setExtracting(false);
    }
  };

  const scheduleLocalReminders = async (
    subscription: Awaited<ReturnType<typeof subscriptionsApi.create>>,
  ) => {
    const permissionsEnabled = await checkNotificationPermissions();
    if (!permissionsEnabled) return;

    const reminderDate = subscription.isTrial && subscription.trialEndDate
      ? subscription.trialEndDate
      : subscription.nextBillingDate;
    const nextBillingDate = new Date(reminderDate);
    if (Number.isNaN(nextBillingDate.getTime())) return;

    await Promise.all(
      notifyDays.map((daysBefore) => {
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

  const saveSubscription = async () => {
    if (!name.trim()) {
      Alert.alert("Missing Name", "Please enter a subscription name.");
      return;
    }

    const parsedAmount = Number(amount);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      Alert.alert("Invalid Amount", "Please enter a valid subscription amount.");
      return;
    }

    const startIso = toIsoDate(startDate);
    if (!startIso) {
      Alert.alert("Invalid Date", "Use YYYY-MM-DD for the start date.");
      return;
    }

    const trialIso = isTrial ? toIsoDate(trialEndDate) : null;
    if (isTrial && !trialIso) {
      Alert.alert("Invalid Trial Date", "Use YYYY-MM-DD for the trial end date.");
      return;
    }

    setSaving(true);
    try {
      const subscription = await subscriptionsApi.create({
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

      try {
        await scheduleLocalReminders(subscription);
      } catch (notificationError) {
        console.warn("Failed to schedule imported subscription reminders:", notificationError);
      }

      Alert.alert("Subscription Added", "Imported subscription saved successfully.", [
        { text: "OK", onPress: () => router.replace("/") },
      ]);
    } catch (error: any) {
      Alert.alert("Could Not Save", getFriendlyErrorMessage(error));
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
        {!hasExtraction && (
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
          <View style={[styles.form, { backgroundColor: colors.background.card }]}>

            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: colors.text.primary }]}>Name</Text>
              <TextInput style={[styles.input, { backgroundColor: colors.background.elevated, color: colors.text.primary, borderColor: colors.border.default }]} value={name} onChangeText={setName} placeholder="Netflix, Spotify" placeholderTextColor={colors.text.muted} />
            </View>

            <View style={styles.inputRow}>
              <View style={[styles.inputGroup, { flex: 2 }]}>
                <Text style={[styles.label, { color: colors.text.primary }]}>Amount</Text>
                <TextInput style={[styles.input, { backgroundColor: colors.background.elevated, color: colors.text.primary, borderColor: colors.border.default }]} value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholder="0.00" placeholderTextColor={colors.text.muted} />
              </View>
              <View style={[styles.inputGroup, { flex: 1 }]}>
                <Text style={[styles.label, { color: colors.text.primary }]}>Currency</Text>
                <TextInput style={[styles.input, { backgroundColor: colors.background.elevated, color: colors.text.primary, borderColor: colors.border.default }]} value={currency} onChangeText={setCurrency} placeholder="USD" placeholderTextColor={colors.text.muted} autoCapitalize="characters" />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: colors.text.primary }]}>Billing Cycle</Text>
              <View style={styles.chipWrap}>
                {BillingCycles.map((cycle) => (
                  <TouchableOpacity key={cycle.id} style={[styles.chip, { backgroundColor: billingCycle === cycle.id ? colors.badge.worthItBg : colors.background.elevated, borderColor: billingCycle === cycle.id ? colors.accent.primary : colors.border.default }]} onPress={() => setBillingCycle(cycle.id)}>
                    <Text style={[styles.chipText, { color: billingCycle === cycle.id ? colors.accent.primary : colors.text.primary }]}>{cycle.name}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: colors.text.primary }]}>Category</Text>
              <View style={styles.chipWrap}>
                {Categories.map((cat) => (
                  <TouchableOpacity key={cat.id} style={[styles.chip, { backgroundColor: category === cat.id ? colors.badge.worthItBg : colors.background.elevated, borderColor: category === cat.id ? colors.accent.primary : colors.border.default }]} onPress={() => setCategory(cat.id)}>
                    <Text style={styles.categoryIcon}>{cat.icon}</Text>
                    <Text style={[styles.chipText, { color: category === cat.id ? colors.accent.primary : colors.text.primary }]}>{cat.name}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: colors.text.primary }]}>Start Date</Text>
              <TextInput style={[styles.input, { backgroundColor: colors.background.elevated, color: colors.text.primary, borderColor: colors.border.default }]} value={startDate} onChangeText={setStartDate} placeholder="YYYY-MM-DD" placeholderTextColor={colors.text.muted} />
            </View>

            <TouchableOpacity style={[styles.toggleRow, { backgroundColor: colors.background.elevated, borderColor: isTrial ? colors.accent.primary : colors.border.default }]} onPress={() => setIsTrial((current) => !current)}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.toggleTitle, { color: colors.text.primary }]}>Free trial</Text>
                <Text style={[styles.toggleText, { color: colors.text.secondary }]}>Alert before it becomes paid</Text>
              </View>
              <Ionicons name={isTrial ? "toggle" : "toggle-outline"} size={34} color={isTrial ? colors.accent.primary : colors.text.muted} />
            </TouchableOpacity>

            {isTrial && (
              <View style={styles.inputGroup}>
                <Text style={[styles.label, { color: colors.text.primary }]}>Trial End Date</Text>
                <TextInput style={[styles.input, { backgroundColor: colors.background.elevated, color: colors.text.primary, borderColor: colors.border.default }]} value={trialEndDate} onChangeText={setTrialEndDate} placeholder="YYYY-MM-DD" placeholderTextColor={colors.text.muted} />
              </View>
            )}

            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: colors.text.primary }]}>Smart Reminders</Text>
              <View style={styles.chipWrap}>
                {NotificationOptions.map((option) => {
                  const selected = notifyDays.includes(option.days);
                  return (
                    <TouchableOpacity key={option.days} style={[styles.chip, { backgroundColor: selected ? colors.badge.worthItBg : colors.background.elevated, borderColor: selected ? colors.accent.primary : colors.border.default }]} onPress={() => setNotifyDays((current) => selected ? current.filter((day) => day !== option.days) : [...current, option.days].sort((a, b) => b - a))}>
                      <Text style={[styles.chipText, { color: selected ? colors.accent.primary : colors.text.primary }]}>{option.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: colors.text.primary }]}>Notes</Text>
              <TextInput style={[styles.textArea, { backgroundColor: colors.background.elevated, color: colors.text.primary, borderColor: colors.border.default }]} value={notes} onChangeText={setNotes} placeholder="Imported notes..." placeholderTextColor={colors.text.muted} multiline numberOfLines={3} />
            </View>

            <Button title={saving ? "Saving..." : "Save Subscription"} onPress={saveSubscription} loading={saving} disabled={saving} />
          </View>
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
  form: { borderRadius: 20, padding: 16, gap: 2 },
  inputGroup: { marginBottom: 16 },
  inputRow: { flexDirection: "row", gap: 12 },
  label: { fontSize: 14, fontWeight: "700", marginBottom: 8 },
  input: { borderRadius: 10, padding: 12, fontSize: 15, borderWidth: 1 },
  textArea: { borderRadius: 10, padding: 12, fontSize: 15, borderWidth: 1, minHeight: 80, textAlignVertical: "top" },
  chipWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { flexDirection: "row", alignItems: "center", gap: 6, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9 },
  chipText: { fontSize: 12, fontWeight: "700" },
  categoryIcon: { fontSize: 15 },
  toggleRow: { borderWidth: 1, borderRadius: 14, padding: 14, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 16, marginBottom: 16 },
  toggleTitle: { fontSize: 14, fontWeight: "800", marginBottom: 3 },
  toggleText: { fontSize: 12, fontWeight: "500" },
});




