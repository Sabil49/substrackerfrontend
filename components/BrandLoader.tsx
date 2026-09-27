// Loading indicators that use the Substracker logo instead of a system spinner.
//
//   <BrandLoader />        the logo, gently pulsing with a soft ripple
//   <LoadingScreen />      the same, centred on a full screen
//   <LoadingDots />        three small dots, for inside buttons
import { useTheme } from "@/contexts/ThemeContext";
import React, { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, Text, View } from "react-native";

const LOGO = require("../assets/images/icon.png");

export default function BrandLoader({
  size = 72,
  label,
}: {
  size?: number;
  label?: string;
}) {
  const { colors } = useTheme();
  const pulse = useRef(new Animated.Value(0)).current;
  const ripple = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const breathe = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 850,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 850,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    const wave = Animated.loop(
      Animated.timing(ripple, {
        toValue: 1,
        duration: 1700,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
    );
    breathe.start();
    wave.start();
    return () => {
      breathe.stop();
      wave.stop();
    };
  }, [pulse, ripple]);

  const scale = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1.06] });
  const rippleScale = ripple.interpolate({ inputRange: [0, 1], outputRange: [1, 1.9] });
  const rippleOpacity = ripple.interpolate({ inputRange: [0, 1], outputRange: [0.4, 0] });
  const radius = Math.round(size * 0.24);

  return (
    <View style={styles.wrap} accessibilityRole="progressbar" accessibilityLabel="Loading">
      <View style={{ width: size * 2, height: size * 2, alignItems: "center", justifyContent: "center" }}>
        <Animated.View
          style={[
            styles.ripple,
            {
              width: size,
              height: size,
              borderRadius: radius,
              borderColor: colors.accent.primary,
              opacity: rippleOpacity,
              transform: [{ scale: rippleScale }],
            },
          ]}
        />
        <Animated.Image
          source={LOGO}
          style={{ width: size, height: size, borderRadius: radius, transform: [{ scale }] }}
        />
      </View>
      {label ? <Text style={[styles.label, { color: colors.text.muted }]}>{label}</Text> : null}
    </View>
  );
}

// The logo, centred on the app background — for whole-screen loading.
export function LoadingScreen({ label }: { label?: string }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.screen, { backgroundColor: colors.background.primary }]}>
      <BrandLoader label={label} />
    </View>
  );
}

// Three softly bouncing dots, sized for a button label.
export function LoadingDots({ color = "#FFFFFF" }: { color?: string }) {
  const dots = useRef([0, 1, 2].map(() => new Animated.Value(0.3))).current;

  useEffect(() => {
    const loops = dots.map((dot, index) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(index * 160),
          Animated.timing(dot, { toValue: 1, duration: 320, useNativeDriver: true }),
          Animated.timing(dot, { toValue: 0.3, duration: 320, useNativeDriver: true }),
          Animated.delay((2 - index) * 160),
        ]),
      ),
    );
    loops.forEach((loop) => loop.start());
    return () => loops.forEach((loop) => loop.stop());
  }, [dots]);

  return (
    <View style={styles.dots} accessibilityRole="progressbar" accessibilityLabel="Loading">
      {dots.map((dot, index) => (
        <Animated.View
          key={index}
          style={[styles.dot, { backgroundColor: color, opacity: dot, transform: [{ scale: dot }] }]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: "center", justifyContent: "center" },
  screen: { flex: 1, alignItems: "center", justifyContent: "center" },
  ripple: { position: "absolute", borderWidth: 2 },
  label: { marginTop: 4, fontSize: 13, fontWeight: "600" },
  dots: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, height: 22 },
  dot: { width: 8, height: 8, borderRadius: 4 },
});
