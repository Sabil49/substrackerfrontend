// app/contexts/AuthContext.tsx
import { auth, GOOGLE_IOS_CLIENT_ID, GOOGLE_WEB_CLIENT_ID, isAppleAuthAvailable } from "@/config/firebase";
import { authApi, User, userApi } from "@/services/api";
import * as AppleAuthentication from "expo-apple-authentication";
import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  OAuthProvider,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithCredential,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  updateProfile,
  User as FirebaseUser,
} from "firebase/auth";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

interface AuthContextType {
  firebaseUser: FirebaseUser | null;
  appUser: User | null;
  initializing: boolean;
  refreshAppUser: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (email: string, password: string, name?: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signInWithApple: () => Promise<void>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Completing the backend session sync (getting back the app-level
// user/premium object) after any Firebase sign-in succeeds.
async function syncBackendSession(): Promise<User> {
  return authApi.syncSession();
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [appUser, setAppUser] = useState<User | null>(null);
  const [initializing, setInitializing] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setFirebaseUser(user);
      setInitializing(false);
    });
    return unsubscribe;
  }, []);

  const refreshAppUser = useCallback(async () => {
    if (!auth.currentUser) {
      setAppUser(null);
      return;
    }
    try {
      const user = await userApi.get();
      setAppUser(user);
    } catch (error) {
      console.error("[Auth] Failed to refresh app user:", error);
    }
  }, []);

  const signInWithEmail = useCallback(async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email, password);
    setAppUser(await syncBackendSession());
  }, []);

  const signUpWithEmail = useCallback(async (email: string, password: string, name?: string) => {
    const credential = await createUserWithEmailAndPassword(auth, email, password);
    if (name?.trim()) {
      await updateProfile(credential.user, { displayName: name.trim() });
    }
    setAppUser(await syncBackendSession());
  }, []);

  const signInWithGoogle = useCallback(async () => {
    // Lazy import: this native module isn't available until the Google
    // Sign-In config plugin has run through an EAS/dev-client build.
    const { GoogleSignin } = await import(
      "@react-native-google-signin/google-signin"
    );
    GoogleSignin.configure({
      webClientId: GOOGLE_WEB_CLIENT_ID,
      iosClientId: GOOGLE_IOS_CLIENT_ID,
    });
    await GoogleSignin.hasPlayServices();
    const result = await GoogleSignin.signIn();
    const idToken = (result as any).idToken || (result as any).data?.idToken;
    if (!idToken) throw new Error("Google sign-in did not return an ID token");

    const credential = GoogleAuthProvider.credential(idToken);
    await signInWithCredential(auth, credential);
    setAppUser(await syncBackendSession());
  }, []);

  const signInWithApple = useCallback(async () => {
    if (!isAppleAuthAvailable) {
      throw new Error("Sign in with Apple is only available on iOS");
    }
    const credentialResult = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
    });
    if (!credentialResult.identityToken) {
      throw new Error("Apple sign-in did not return an identity token");
    }

    const provider = new OAuthProvider("apple.com");
    const credential = provider.credential({
      idToken: credentialResult.identityToken,
    });
    await signInWithCredential(auth, credential);
    setAppUser(await syncBackendSession());
  }, []);

  const signOut = useCallback(async () => {
    await firebaseSignOut(auth);
    setAppUser(null);
  }, []);

  const resetPassword = useCallback(async (email: string) => {
    await sendPasswordResetEmail(auth, email);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        firebaseUser,
        appUser,
        initializing,
        refreshAppUser,
        signInWithEmail,
        signUpWithEmail,
        signInWithGoogle,
        signInWithApple,
        signOut,
        resetPassword,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
