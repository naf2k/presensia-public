import Constants from "expo-constants";
import * as Updates from "expo-updates";
import { Platform } from "react-native";

export interface AppUpdateInfo {
  appVersion: string;
  runtimeVersion: string;
  channel: string;
  updateLabel: string;
  isEmbedded: boolean;
}

/** Info versi + update OTA yang sedang berjalan. Murni baca, aman di semua lingkungan. */
export function getAppUpdateInfo(): AppUpdateInfo {
  if (Platform.OS === "web")
    return {
      appVersion: Constants.expoConfig?.version ?? "—",
      runtimeVersion: "web",
      channel: "web",
      updateLabel: "Versi web — selalu terbaru",
      isEmbedded: false,
    };
  const updateId = Updates.updateId ?? "";
  const created = Updates.createdAt;
  const dateLabel = created
    ? new Intl.DateTimeFormat("id-ID", {
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Asia/Jakarta",
      }).format(created)
    : "";
  return {
    appVersion: Constants.expoConfig?.version ?? "—",
    runtimeVersion: Updates.runtimeVersion ?? "—",
    channel: Updates.channel ?? "—",
    updateLabel:
      Updates.isEmbeddedLaunch || updateId === "" ? "Bawaan install" : `${updateId.slice(0, 8)} · ${dateLabel}`,
    isEmbedded: Updates.isEmbeddedLaunch,
  };
}

/**
 * Cek update ke server. "latest" bila sudah terbaru, "ready" bila update
 * berhasil diunduh dan tinggal restart untuk menerapkan.
 */
export async function checkAndFetchUpdate(): Promise<"latest" | "ready"> {
  if (Platform.OS === "web") return "latest";
  const check = await Updates.checkForUpdateAsync();
  if (!check.isAvailable) return "latest";
  await Updates.fetchUpdateAsync();
  return "ready";
}

export async function restartApp(): Promise<void> {
  if (Platform.OS === "web") {
    globalThis.location?.reload();
    return;
  }
  await Updates.reloadAsync();
}
