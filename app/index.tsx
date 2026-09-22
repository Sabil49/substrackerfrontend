//app/index.tsx
import { useAuth } from "@/contexts/AuthContext";
import { Redirect } from "expo-router";

// _layout.tsx's login gate re-checks this on every route change anyway, but
// deciding here too avoids a visible (tabs) -> /login flash for signed-out
// users on cold start.
export default function Index() {
  const { firebaseUser } = useAuth();
  return <Redirect href={firebaseUser ? "/(tabs)" : "/login"} />;
}
