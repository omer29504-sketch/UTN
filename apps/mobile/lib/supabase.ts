import "react-native-url-polyfill/auto";

import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";
import * as Crypto from "expo-crypto";
import { AppState, Platform } from "react-native";

import { env, isSupabaseConfigured } from "./env";

// Supabase auth needs a cryptographically secure random source for PKCE. Hermes
// has no WebCrypto, so bridge it to expo-crypto before the client is created.
// The global `Crypto` type expects the full DOM surface (including `subtle`),
// which React Native does not implement, so the polyfill is typed loosely.
type CryptoPolyfill = {
  getRandomValues?: (array: ArrayBufferView) => ArrayBufferView;
  randomUUID?: () => string;
};

const host = globalThis as unknown as { crypto?: CryptoPolyfill };
const cryptoHost: CryptoPolyfill = host.crypto ?? {};
cryptoHost.getRandomValues ??=
  Crypto.getRandomValues as unknown as CryptoPolyfill["getRandomValues"];
cryptoHost.randomUUID ??= Crypto.randomUUID as unknown as () => string;
host.crypto = cryptoHost;

export const supabaseConfigured = isSupabaseConfigured();

export const supabase = createClient(
  env.supabaseUrl || "https://placeholder.supabase.co",
  env.supabaseAnonKey || "placeholder-anon-key",
  {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      // React Native has no browser URL to detect a session from.
      detectSessionInUrl: false,
      flowType: "pkce",
    },
  },
);

// Tokens must be refreshed while the app is foregrounded, and paused when it is
// not, otherwise Android/iOS timers can drift.
if (Platform.OS !== "web") {
  AppState.addEventListener("change", (state) => {
    if (state === "active") {
      supabase.auth.startAutoRefresh();
    } else {
      supabase.auth.stopAutoRefresh();
    }
  });
}
