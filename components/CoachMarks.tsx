// A first-run tour. It dims the screen, spotlights one real control at a time,
// points at it with a bouncing arrow, and explains it in a short card.
//
// Each step targets either a real element (measured on screen through a ref)
// or a known area given in window coordinates (e.g. a tab-bar button). A step
// with neither is shown as a centred welcome card.
import { useTheme } from "@/contexts/ThemeContext";
import { Ionicons } from "@expo/vector-icons";
import React, { RefObject, useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";

export type CoachRect = { x: number; y: number; width: number; height: number };

export type CoachStep = {
  title: string;
  body: string;
  icon?: keyof typeof Ionicons.glyphMap;
  target?: RefObject<View | null>;
  rect?: () => CoachRect;
  // Corner rounding of the highlight (e.g. a circle around a round button).
  radius?: number;
};

const SPOTLIGHT_PADDING = 8;
const ARROW_SIZE = 40;
const GAP = 6;
const DIM = "rgba(5, 5, 10, 0.8)";

export default function CoachMarks({
  visible,
  steps,
  onDone,
}: {
  visible: boolean;
  steps: CoachStep[];
  onDone: () => void;
}) {
  const { colors } = useTheme();
  const { width: W, height: H } = useWindowDimensions();
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<CoachRect | null>(null);
  const [ready, setReady] = useState(false);
  const bounce = useRef(new Animated.Value(0)).current;
  const fade = useRef(new Animated.Value(0)).current;

  // Read through a ref so a parent re-render doesn't restart the current step.
  const stepsRef = useRef(steps);
  stepsRef.current = steps;

  // Every time the tour opens, start from the first step.
  useEffect(() => {
    if (visible) setIndex(0);
  }, [visible]);

  // Find where this step's target is on screen, then fade the step in.
  useEffect(() => {
    const step = stepsRef.current[index];
    if (!visible || !step) return;

    let cancelled = false;
    setReady(false);
    fade.setValue(0);

    const show = (found: CoachRect | null) => {
      if (cancelled) return;
      setRect(found);
      setReady(true);
      Animated.timing(fade, { toValue: 1, duration: 220, useNativeDriver: true }).start();
    };

    if (step.rect) {
      show(step.rect());
    } else if (step.target?.current) {
      step.target.current.measureInWindow((x, y, width, height) => {
        // Not on screen? Fall back to a centred card rather than a wrong spot.
        show(width > 0 && height > 0 ? { x, y, width, height } : null);
      });
    } else {
      show(null);
    }

    return () => {
      cancelled = true;
    };
  }, [visible, index, fade]);

  // A gentle bounce toward the highlighted control.
  useEffect(() => {
    if (!visible) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(bounce, { toValue: 1, duration: 550, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(bounce, { toValue: 0, duration: 550, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [visible, bounce]);

  const step = steps[index];
  if (!visible || !step) return null;

  const isLast = index === steps.length - 1;
  const next = () => (isLast ? onDone() : setIndex((i) => i + 1));

  // The highlighted area, with a little breathing room around the control.
  const spot = rect
    ? {
        x: rect.x - SPOTLIGHT_PADDING,
        y: rect.y - SPOTLIGHT_PADDING,
        width: rect.width + SPOTLIGHT_PADDING * 2,
        height: rect.height + SPOTLIGHT_PADDING * 2,
      }
    : null;

  // Put the card on whichever side of the control has more room.
  const cardBelow = spot ? spot.y + spot.height / 2 < H / 2 : false;
  const centerX = spot ? spot.x + spot.width / 2 : W / 2;
  const arrowLeft = Math.min(Math.max(centerX - ARROW_SIZE / 2, 16), W - ARROW_SIZE - 16);
  const arrowTop = spot
    ? cardBelow
      ? spot.y + spot.height + GAP
      : spot.y - GAP - ARROW_SIZE
    : 0;
  const cardPosition = spot
    ? cardBelow
      ? { top: spot.y + spot.height + GAP * 2 + ARROW_SIZE }
      : { bottom: H - (spot.y - GAP * 2 - ARROW_SIZE) }
    : { top: H * 0.3 };

  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent onRequestClose={onDone}>
      <View style={StyleSheet.absoluteFill} accessibilityViewIsModal>
        {spot ? (
          <>
            <View style={[styles.dim, { top: 0, left: 0, right: 0, height: Math.max(0, spot.y) }]} />
            <View style={[styles.dim, { top: spot.y + spot.height, left: 0, right: 0, bottom: 0 }]} />
            <View style={[styles.dim, { top: spot.y, left: 0, width: Math.max(0, spot.x), height: spot.height }]} />
            <View style={[styles.dim, { top: spot.y, left: spot.x + spot.width, right: 0, height: spot.height }]} />
            <View
              pointerEvents="none"
              style={[
                styles.ring,
                {
                  top: spot.y,
                  left: spot.x,
                  width: spot.width,
                  height: spot.height,
                  borderRadius: step.radius ?? 16,
                  borderColor: colors.accent.primary,
                },
              ]}
            />
          </>
        ) : (
          <View style={[styles.dim, StyleSheet.absoluteFillObject]} />
        )}

        {spot && ready && (
          <Animated.View
            pointerEvents="none"
            style={{
              position: "absolute",
              left: arrowLeft,
              top: arrowTop,
              opacity: fade,
              transform: [
                {
                  translateY: bounce.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, cardBelow ? -8 : 8],
                  }),
                },
              ],
            }}
          >
            <Ionicons name={cardBelow ? "arrow-up" : "arrow-down"} size={ARROW_SIZE} color="#FFFFFF" />
          </Animated.View>
        )}

        {ready && (
          <Animated.View
            style={[
              styles.card,
              cardPosition,
              { backgroundColor: colors.background.elevated, borderColor: colors.border.default, opacity: fade },
            ]}
          >
            {step.icon ? (
              <View style={[styles.cardIcon, { backgroundColor: `${colors.accent.primary}26` }]}>
                <Ionicons name={step.icon} size={20} color={colors.accent.primary} />
              </View>
            ) : null}
            <Text style={[styles.title, { color: colors.text.primary }]}>{step.title}</Text>
            <Text style={[styles.body, { color: colors.text.secondary }]}>{step.body}</Text>

            <View style={styles.footer}>
              <View style={styles.dots}>
                {steps.map((_, i) => (
                  <View
                    key={i}
                    style={[
                      styles.dot,
                      {
                        width: i === index ? 18 : 6,
                        backgroundColor: i === index ? colors.accent.primary : colors.border.default,
                      },
                    ]}
                  />
                ))}
              </View>
              <View style={styles.actions}>
                {!isLast ? (
                  <TouchableOpacity onPress={onDone} hitSlop={10} accessibilityRole="button">
                    <Text style={[styles.skip, { color: colors.text.muted }]}>Skip</Text>
                  </TouchableOpacity>
                ) : null}
                <TouchableOpacity
                  onPress={next}
                  style={[styles.nextButton, { backgroundColor: colors.accent.primary }]}
                  accessibilityRole="button"
                >
                  <Text style={styles.nextText}>{isLast ? "Got it" : "Next"}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Animated.View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  dim: { position: "absolute", backgroundColor: DIM },
  ring: { position: "absolute", borderWidth: 2 },
  card: {
    position: "absolute",
    left: 20,
    right: 20,
    borderRadius: 22,
    borderWidth: 1,
    padding: 18,
  },
  cardIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  title: { fontSize: 18, fontWeight: "800", marginBottom: 6 },
  body: { fontSize: 14, fontWeight: "500", lineHeight: 20 },
  footer: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 16 },
  dots: { flexDirection: "row", alignItems: "center", gap: 5 },
  dot: { height: 6, borderRadius: 3 },
  actions: { flexDirection: "row", alignItems: "center", gap: 18 },
  skip: { fontSize: 14, fontWeight: "700" },
  nextButton: { paddingHorizontal: 18, paddingVertical: 10, borderRadius: 14 },
  nextText: { color: "#FFFFFF", fontSize: 14, fontWeight: "800" },
});
