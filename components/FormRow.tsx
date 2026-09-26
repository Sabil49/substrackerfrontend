// app/components/FormRow.tsx
// Shared "row card" primitives for the compact form layout used by
// Add/Update Subscription and the Scan-receipt review step — one rounded
// card, each field as a full-width row (label left, control right),
// matching the visual pattern already used by (tabs)/account.tsx.
import { useTheme } from "@/contexts/ThemeContext";
import { Ionicons } from "@expo/vector-icons";
import {
  addMonths,
  addYears,
  eachDayOfInterval,
  endOfMonth,
  format,
  getDay,
  isSameDay,
  startOfMonth,
  subMonths,
  subYears,
} from "date-fns";
import React, { useEffect, useState } from "react";
import {
  Modal,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ViewStyle,
} from "react-native";

export function RowCard({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: ViewStyle;
}) {
  const { colors } = useTheme();
  return (
    <View style={[styles.card, { backgroundColor: colors.background.card }, style]}>
      {children}
    </View>
  );
}

// A field label that says whether the field is required (red *) or optional,
// and shows an inline error underneath once the user has tried to save.
export function FieldLabel({
  label,
  required,
  optional,
  error,
}: {
  label: string;
  required?: boolean;
  optional?: boolean;
  error?: string;
}) {
  const { colors } = useTheme();
  return (
    <View style={styles.labelBlock}>
      <Text style={[styles.rowLabel, { color: error ? colors.status.error : colors.text.primary }]}>
        {label}
        {required ? <Text style={{ color: colors.status.error }}> *</Text> : null}
        {optional ? (
          <Text style={[styles.optionalTag, { color: colors.text.muted }]}>{"  Optional"}</Text>
        ) : null}
      </Text>
      {error ? (
        <Text style={[styles.fieldError, { color: colors.status.error }]}>{error}</Text>
      ) : null}
    </View>
  );
}

function RowShell({
  first,
  children,
}: {
  first?: boolean;
  children: React.ReactNode;
}) {
  const { colors } = useTheme();
  return (
    <View
      style={[
        styles.row,
        { borderTopColor: colors.border.light, borderTopWidth: first ? 0 : 1 },
      ]}
    >
      {children}
    </View>
  );
}

export function ToggleRow({
  label,
  subtitle,
  value,
  onValueChange,
  first,
  optional,
}: {
  label: string;
  subtitle?: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
  first?: boolean;
  optional?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <RowShell first={first}>
      <View style={{ flex: 1 }}>
        <FieldLabel label={label} optional={optional} />
        {subtitle ? (
          <Text style={[styles.rowSubtitle, { color: colors.text.secondary }]}>{subtitle}</Text>
        ) : null}
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: colors.background.elevated, true: colors.accent.primary }}
        thumbColor="#FFF"
      />
    </RowShell>
  );
}

export function TextFieldRow({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
  prefix,
  first,
  required,
  optional,
  error,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  keyboardType?: "default" | "decimal-pad" | "number-pad";
  prefix?: string;
  first?: boolean;
  required?: boolean;
  optional?: boolean;
  error?: string;
}) {
  const { colors } = useTheme();
  return (
    <RowShell first={first}>
      <FieldLabel label={label} required={required} optional={optional} error={error} />
      <View style={styles.rowValueGroup}>
        {prefix ? (
          <Text style={[styles.rowValue, { color: colors.text.primary }]}>{prefix}</Text>
        ) : null}
        <TextInput
          style={[styles.rowInput, { color: colors.text.primary }]}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.text.disabled}
          keyboardType={keyboardType}
          textAlign="right"
        />
      </View>
    </RowShell>
  );
}

export function ValueRow({
  label,
  value,
  onPress,
  first,
  required,
  optional,
  error,
}: {
  label: string;
  value: string;
  onPress: () => void;
  first?: boolean;
  required?: boolean;
  optional?: boolean;
  error?: string;
}) {
  const { colors } = useTheme();
  return (
    <RowShell first={first}>
      <FieldLabel label={label} required={required} optional={optional} error={error} />
      <TouchableOpacity onPress={onPress} style={[styles.rowValueGroup, { flexShrink: 1 }]} activeOpacity={0.6}>
        <Text style={[styles.rowValue, { color: colors.text.primary }]} numberOfLines={1}>
          {value}
        </Text>
        <Ionicons name="chevron-down" size={16} color={colors.text.muted} />
      </TouchableOpacity>
    </RowShell>
  );
}

export interface SheetOption {
  id: string;
  label: string;
}

export function formatRemindSummary(days: number[]) {
  if (!days.length) return "Off";
  return days
    .slice()
    .sort((a, b) => b - a)
    .map((d) => (d === 0 ? "Same day" : `${d}d before`))
    .join(", ");
}

export function OptionSheet({
  visible,
  title,
  options,
  selectedIds,
  multiSelect,
  onToggle,
  onClose,
}: {
  visible: boolean;
  title: string;
  options: SheetOption[];
  selectedIds: string[];
  multiSelect?: boolean;
  onToggle: (id: string) => void;
  onClose: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity
        style={styles.sheetOverlay}
        activeOpacity={1}
        onPress={onClose}
      >
        <TouchableOpacity
          activeOpacity={1}
          style={[styles.sheetCard, { backgroundColor: colors.background.card }]}
          onPress={(event) => event.stopPropagation()}
        >
          <Text style={[styles.sheetTitle, { color: colors.text.primary }]}>{title}</Text>
          {options.map((option, index) => {
            const selected = selectedIds.includes(option.id);
            return (
              <TouchableOpacity
                key={option.id}
                style={[
                  styles.sheetOption,
                  { borderTopColor: colors.border.light, borderTopWidth: index === 0 ? 0 : 1 },
                ]}
                onPress={() => {
                  onToggle(option.id);
                  if (!multiSelect) onClose();
                }}
              >
                <Text
                  style={[
                    styles.sheetOptionText,
                    { color: selected ? colors.accent.primary : colors.text.primary },
                  ]}
                >
                  {option.label}
                </Text>
                {selected ? (
                  <Ionicons name="checkmark" size={18} color={colors.accent.primary} />
                ) : null}
              </TouchableOpacity>
            );
          })}
          {multiSelect ? (
            <TouchableOpacity
              style={[styles.sheetDone, { backgroundColor: colors.accent.primary }]}
              onPress={onClose}
            >
              <Text style={styles.sheetDoneText}>Done</Text>
            </TouchableOpacity>
          ) : null}
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

// Dates travel through the app as "YYYY-MM-DD" strings (local calendar day).
export function parseYmd(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec((value || "").trim());
  if (!match) return null;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return Number.isNaN(date.getTime()) ? null : date;
}

export function toYmd(date: Date) {
  return format(date, "yyyy-MM-dd");
}

// "Sep 26, 2026" for display; falls back to the placeholder if unset/invalid.
export function formatDateLabel(value: string, placeholder = "Select date") {
  const date = parseYmd(value);
  return date ? format(date, "MMM d, yyyy") : placeholder;
}

const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];

// A month-grid calendar in a modal — pick a day instead of typing a date.
export function DateInputSheet({
  visible,
  value,
  onChangeText,
  onClose,
  title = "Select date",
}: {
  visible: boolean;
  value: string;
  onChangeText: (value: string) => void;
  onClose: () => void;
  title?: string;
}) {
  const { colors } = useTheme();
  const selected = parseYmd(value);
  const [month, setMonth] = useState(() => startOfMonth(selected ?? new Date()));

  // Re-open on the currently selected month each time the sheet is shown.
  useEffect(() => {
    if (visible) setMonth(startOfMonth(parseYmd(value) ?? new Date()));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const days = eachDayOfInterval({ start: startOfMonth(month), end: endOfMonth(month) });
  const cells: (Date | null)[] = [...Array(getDay(startOfMonth(month))).fill(null), ...days];
  const today = new Date();

  const pick = (day: Date) => {
    onChangeText(toYmd(day));
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={styles.sheetOverlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity
          activeOpacity={1}
          style={[styles.sheetCard, { backgroundColor: colors.background.card }]}
          onPress={(event) => event.stopPropagation()}
        >
          <Text style={[styles.sheetTitle, { color: colors.text.primary }]}>{title}</Text>

          <View style={styles.calHeader}>
            <TouchableOpacity onPress={() => setMonth((m) => subYears(m, 1))} hitSlop={8} style={styles.calNav}>
              <Ionicons name="play-back" size={16} color={colors.text.muted} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setMonth((m) => subMonths(m, 1))} hitSlop={8} style={styles.calNav}>
              <Ionicons name="chevron-back" size={20} color={colors.text.primary} />
            </TouchableOpacity>
            <Text style={[styles.calMonth, { color: colors.text.primary }]}>
              {format(month, "MMMM yyyy")}
            </Text>
            <TouchableOpacity onPress={() => setMonth((m) => addMonths(m, 1))} hitSlop={8} style={styles.calNav}>
              <Ionicons name="chevron-forward" size={20} color={colors.text.primary} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setMonth((m) => addYears(m, 1))} hitSlop={8} style={styles.calNav}>
              <Ionicons name="play-forward" size={16} color={colors.text.muted} />
            </TouchableOpacity>
          </View>

          <View style={styles.calRow}>
            {WEEKDAYS.map((label, index) => (
              <Text key={index} style={[styles.calWeekday, { color: colors.text.muted }]}>
                {label}
              </Text>
            ))}
          </View>

          <View style={styles.calGrid}>
            {cells.map((day, index) => {
              if (!day) return <View key={`empty-${index}`} style={styles.calCell} />;
              const isSelected = selected ? isSameDay(day, selected) : false;
              const isToday = isSameDay(day, today);
              return (
                <TouchableOpacity
                  key={day.toISOString()}
                  style={styles.calCell}
                  onPress={() => pick(day)}
                  activeOpacity={0.6}
                >
                  <View
                    style={[
                      styles.calDay,
                      isSelected && { backgroundColor: colors.accent.primary },
                      !isSelected && isToday && { borderWidth: 1, borderColor: colors.accent.primary },
                    ]}
                  >
                    <Text
                      style={[
                        styles.calDayText,
                        { color: isSelected ? "#FFFFFF" : colors.text.primary },
                      ]}
                    >
                      {day.getDate()}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={styles.calFooter}>
            <TouchableOpacity onPress={() => pick(new Date())} style={styles.calFooterButton}>
              <Text style={[styles.calFooterText, { color: colors.accent.primary }]}>Today</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={onClose} style={styles.calFooterButton}>
              <Text style={[styles.calFooterText, { color: colors.text.secondary }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 22, paddingHorizontal: 18 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 15,
    gap: 12,
  },
  rowLabel: { fontSize: 15, fontWeight: "600" },
  rowSubtitle: { fontSize: 12, fontWeight: "500", marginTop: 3 },
  labelBlock: { flexShrink: 1 },
  optionalTag: { fontSize: 11, fontWeight: "600" },
  fieldError: { fontSize: 12, fontWeight: "600", marginTop: 3 },
  rowValueGroup: { flexDirection: "row", alignItems: "center", gap: 6 },
  rowValue: { fontSize: 15, fontWeight: "700" },
  rowInput: { fontSize: 15, fontWeight: "700", padding: 0, minWidth: 60 },
  sheetOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  sheetCard: { width: "100%", maxWidth: 380, borderRadius: 24, padding: 20 },
  sheetTitle: { fontSize: 17, fontWeight: "800", marginBottom: 8 },
  sheetOption: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
  },
  sheetOptionText: { fontSize: 15, fontWeight: "600" },
  sheetDone: { marginTop: 12, borderRadius: 14, paddingVertical: 14, alignItems: "center" },
  sheetDoneText: { color: "#fff", fontSize: 15, fontWeight: "800" },
  calHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 },
  calNav: { width: 32, height: 32, alignItems: "center", justifyContent: "center" },
  calMonth: { fontSize: 16, fontWeight: "800", flex: 1, textAlign: "center" },
  calRow: { flexDirection: "row", marginBottom: 4 },
  calWeekday: { flex: 1, textAlign: "center", fontSize: 12, fontWeight: "700" },
  calGrid: { flexDirection: "row", flexWrap: "wrap" },
  calCell: { width: "14.2857%", aspectRatio: 1, alignItems: "center", justifyContent: "center" },
  calDay: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  calDayText: { fontSize: 15, fontWeight: "600" },
  calFooter: { flexDirection: "row", justifyContent: "space-between", marginTop: 8 },
  calFooterButton: { paddingVertical: 10, paddingHorizontal: 8 },
  calFooterText: { fontSize: 15, fontWeight: "700" },
});
