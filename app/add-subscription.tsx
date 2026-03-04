// app/add-subscription.tsx
import Button from "@/components/Button";
import { BillingCycles, Categories } from "@/constants/theme";
import { useTheme } from "@/contexts/ThemeContext";
import { subscriptionsApi, Template, templatesApi } from "@/services/api";
import { Ionicons } from "@expo/vector-icons";
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
  const [isTrial] = useState(false);
  const [notifyDays] = useState<number[]>([7, 3, 1, 0]);
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

    setLoading(true);

    try {
      await subscriptionsApi.create({
        name: name.trim(),
        amount: parsedAmount,
        currency,
        // toUpperCase() fixes the lowercase vs UPPERCASE mismatch with backend Zod schema
        billingCycle: billingCycle.toUpperCase(),
        customCycleDays: parsedCustomDays || undefined,
        category: category || "Other",
        startDate: startDate.toISOString(),
        isTrial,
        // Pass array directly — backend expects z.array(z.number()), not a JSON string
        notifyDaysBefore: notifyDays,
        notes: notes.trim() || undefined,
        isActive: true,
      });

      Alert.alert("Success", "Subscription added successfully");
      router.back();
    } catch (error: any) {
      const errorMessage =
        error.response?.data?.error ||
        error.message ||
        "Failed to add subscription";
      Alert.alert("Error", errorMessage);
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
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
        >
          <Ionicons name="arrow-back" size={24} color={colors.text.primary} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.text.primary }]}>
          Add Subscription
        </Text>
        <View style={{ width: 40 }} />
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
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: "center",
  },
  title: {
    fontSize: 18,
    fontWeight: "600",
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
  submitButton: {
    marginTop: 8,
  },
});
