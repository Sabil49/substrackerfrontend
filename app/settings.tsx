// app/settings.tsx
// Settings was merged into the Account tab (see (tabs)/account.tsx).
// Kept as a redirect shim in case anything still links here.
import { Redirect } from "expo-router";

export default function SettingsRedirect() {
  return <Redirect href="/(tabs)/account" />;
}
