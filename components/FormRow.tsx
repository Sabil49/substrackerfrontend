// app/components/FormRow.tsx
// Shared "row card" primitives for the compact form layout used by
// Add/Update Subscription and the Scan-receipt review step — one rounded
// card, each field as a full-width row (label left, control right),
// matching the visual pattern already used by (tabs)/account.tsx.
import { useTheme } from "@/contexts/ThemeContext";
import { Ionicons } from "@expo/vector-icons";
import React from "react";
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
}: {
  label: string;
  subtitle?: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
  first?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <RowShell first={first}>
      <View style={{ flex: 1 }}>
        <Text style={[styles.rowLabel, { color: colors.text.primary }]}>{label}</Text>
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
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  keyboardType?: "default" | "decimal-pad" | "number-pad";
  prefix?: string;
  first?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <RowShell first={first}>
      <Text style={[styles.rowLabel, { color: colors.text.primary }]}>{label}</Text>
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
}: {
  label: string;
  value: string;
  onPress: () => void;
  first?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <RowShell first={first}>
      <Text style={[styles.rowLabel, { color: colors.text.primary }]}>{label}</Text>
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

export function DateInputSheet({
  visible,
  value,
  onChangeText,
  onClose,
}: {
  visible: boolean;
  value: string;
  onChangeText: (value: string) => void;
  onClose: () => void;
}) {
  const { colors } = useTheme();
  const today = new Date().toISOString().slice(0, 10);
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={styles.sheetOverlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity
          activeOpacity={1}
          style={[styles.sheetCard, { backgroundColor: colors.background.card }]}
          onPress={(event) => event.stopPropagation()}
        >
          <Text style={[styles.sheetTitle, { color: colors.text.primary }]}>Started</Text>
          <TouchableOpacity
            style={[styles.sheetOption, { borderTopWidth: 0 }]}
            onPress={() => {
              onChangeText(today);
              onClose();
            }}
          >
            <Text style={[styles.sheetOptionText, { color: colors.text.primary }]}>Today</Text>
          </TouchableOpacity>
          <View style={[styles.dateInputRow, { borderTopColor: colors.border.light }]}>
            <TextInput
              style={[styles.dateInput, { color: colors.text.primary, borderColor: colors.border.default }]}
              value={value}
              onChangeText={onChangeText}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={colors.text.disabled}
            />
          </View>
          <TouchableOpacity
            style={[styles.sheetDone, { backgroundColor: colors.accent.primary }]}
            onPress={onClose}
          >
            <Text style={styles.sheetDoneText}>Done</Text>
          </TouchableOpacity>
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
  dateInputRow: { paddingVertical: 12, borderTopWidth: 1 },
  dateInput: { borderRadius: 10, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15 },
});
