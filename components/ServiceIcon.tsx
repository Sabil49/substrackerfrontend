// Real brand logo for a service, fetched by website domain. Falls back to a
// coloured tile with the service's first letter if the logo can't load
// (offline, unknown domain), so the layout never breaks.
import { Image } from "expo-image";
import React, { useState } from "react";
import { StyleSheet, Text, View } from "react-native";

export default function ServiceIcon({
  name,
  domain,
  color = "#3B82F6",
  size = 44,
}: {
  name: string;
  domain?: string;
  color?: string;
  size?: number;
}) {
  const [failed, setFailed] = useState(false);
  const radius = Math.round(size * 0.24);

  if (!domain || failed) {
    return (
      <View
        style={[
          styles.fallback,
          { width: size, height: size, borderRadius: radius, backgroundColor: color },
        ]}
      >
        <Text style={[styles.letter, { fontSize: Math.round(size * 0.44) }]}>
          {(name.trim().charAt(0) || "?").toUpperCase()}
        </Text>
      </View>
    );
  }

  return (
    <Image
      source={{ uri: `https://www.google.com/s2/favicons?domain=${domain}&sz=128` }}
      style={{ width: size, height: size, borderRadius: radius, backgroundColor: "#FFFFFF" }}
      contentFit="cover"
      transition={150}
      onError={() => setFailed(true)}
      accessibilityLabel={`${name} logo`}
    />
  );
}

const styles = StyleSheet.create({
  fallback: { alignItems: "center", justifyContent: "center" },
  letter: { color: "#FFFFFF", fontWeight: "800" },
});
