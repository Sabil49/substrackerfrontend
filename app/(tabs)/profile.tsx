// app/(tabs)/profile.tsx
// Profile and Settings were merged into one Account screen (see account.tsx).
// This route is kept as a redirect shim because login.tsx, signup.tsx, and
// premium.tsx still navigate here after auth/purchase flows.
import { Redirect } from "expo-router";

export default function ProfileRedirect() {
  return <Redirect href="/(tabs)/account" />;
}
