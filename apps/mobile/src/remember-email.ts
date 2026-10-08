import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

// Ingat-email login. Native: SecureStore; web: localStorage.
// Dipisah agar login.tsx tidak menyentuh SecureStore langsung di web.
const KEY = "presensia.login.rememberedEmail";
const isWeb = Platform.OS === "web";

export function getRememberedEmail(): Promise<string | null> {
  if (isWeb) return Promise.resolve(globalThis.localStorage?.getItem(KEY) ?? null);
  return SecureStore.getItemAsync(KEY);
}

export function setRememberedEmail(email: string): Promise<void> {
  if (isWeb) {
    globalThis.localStorage?.setItem(KEY, email);
    return Promise.resolve();
  }
  return SecureStore.setItemAsync(KEY, email);
}

export function clearRememberedEmail(): Promise<void> {
  if (isWeb) {
    globalThis.localStorage?.removeItem(KEY);
    return Promise.resolve();
  }
  return SecureStore.deleteItemAsync(KEY);
}
