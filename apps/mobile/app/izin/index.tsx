import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { errorMessage, formatDate, formatMonthKey } from "@/src/format";
import { getSignedUrl } from "@/src/api";
import { useLeaves } from "@/src/queries";
import {
  AppBar,
  Button,
  EmptyState,
  Icon,
  PageState,
  Screen,
  SectionHead,
  StatusPill,
  Surface,
} from "@/src/ui";
import { colors, fonts } from "@/src/theme";

type Filter = "Semua" | "Izin" | "Sakit";

export default function LeaveScreen() {
  const params = useLocalSearchParams<{ filter?: string; state?: string; sent?: string }>();
  const router = useRouter();
  const [filter, setFilter] = useState<Filter>(
    params.filter === "izin" ? "Izin" : params.filter === "sakit" ? "Sakit" : "Semua",
  );
  const [openError, setOpenError] = useState("");
  const leaves = useLeaves();
  const currentMonth = formatMonthKey();
  const [scope, setScope] = useState<"bulan-ini" | "semua">("bulan-ini");
  const allRecords = leaves.data ?? [];
  const records = allRecords.filter((leave) => {
    if (filter !== "Semua" && leave.type !== filter.toUpperCase()) return false;
    if (scope === "bulan-ini") {
      const leaveMonth = leave.start_date.slice(0, 7);
      const endMonth = leave.end_date.slice(0, 7);
      if (leaveMonth !== currentMonth && endMonth !== currentMonth) return false;
    }
    return true;
  });

  async function openAttachment(path: string) {
    setOpenError("");
    try {
      const url = await getSignedUrl("leave-attachments", path);
      await Linking.openURL(url);
    } catch {
      setOpenError("Lampiran belum dapat dibuka. Coba lagi.");
    }
  }
  const action = (
    <Pressable
      accessibilityLabel="Buat pengajuan"
      onPress={() => router.push("/izin/baru")}
      style={styles.headerAction}
    >
      <Icon name="add" />
    </Pressable>
  );
  const appBar = (
    <AppBar title="Izin & Sakit" subtitle="Pengajuan ketidakhadiran" back action={action} />
  );
  if (leaves.isPending)
    return (
      <Screen tone="app" padded={false} appBar={appBar}>
        <PageState
          loading
          title="Menyiapkan pengajuan"
          copy="Memuat status izin dan sakit terbaru."
        />
      </Screen>
    );
  if (leaves.isError)
    return (
      <Screen tone="app" padded={false} appBar={appBar}>
        <PageState
          title="Pengajuan belum dapat dimuat"
          copy={errorMessage(leaves.error)}
          action={() => void leaves.refetch()}
        />
      </Screen>
    );
  return (
    <Screen
      tone="app"
      padded={false}
      appBar={appBar}
      refreshing={leaves.isRefetching}
      onRefresh={() => void leaves.refetch()}
    >
      {params.sent === "1" ? (
        <View style={styles.toast}>
          <Icon name="checkmark-circle" size={17} color={colors.successInk} />
          <Text style={styles.toastText}>
            Pengajuan berhasil dikirim dan menunggu persetujuan admin.
          </Text>
        </View>
      ) : null}
      <View style={styles.content}>
        <View style={styles.tabs}>
          {(["Semua", "Izin", "Sakit"] as const).map((item) => (
            <Pressable
              key={item}
              onPress={() => setFilter(item)}
              style={[styles.tab, filter === item && styles.tabActive]}
            >
              <Text style={[styles.tabText, filter === item && styles.tabTextActive]}>{item}</Text>
            </Pressable>
          ))}
        </View>
        <View style={styles.tabs}>
          {(["bulan-ini", "semua"] as const).map((item) => (
            <Pressable
              key={item}
              onPress={() => setScope(item)}
              style={[styles.tab, scope === item && styles.tabActive]}
            >
              <Text style={[styles.tabText, scope === item && styles.tabTextActive]}>
                {item === "bulan-ini" ? "Bulan ini" : "Semua riwayat"}
              </Text>
            </Pressable>
          ))}
        </View>
        {openError ? (
          <View style={styles.toastError}>
            <Text style={styles.toastErrorText}>{openError}</Text>
          </View>
        ) : null}
        <Button label="Buat pengajuan baru" icon="add" onPress={() => router.push("/izin/baru")} />
        <SectionHead title="Riwayat pengajuan" subtitle="Terbaru ditampilkan lebih dulu" />
        {records.length ? (
          <Surface>
            {records.map((leave, index) => {
              const status =
                leave.status === "APPROVED"
                  ? "Disetujui"
                  : leave.status === "REJECTED"
                    ? "Ditolak"
                    : "Menunggu";
              const fileName = leave.attachment_path?.split("/").pop();
              return (
                <View
                  key={leave.id}
                  style={[styles.card, index === records.length - 1 && { borderBottomWidth: 0 }]}
                >
                  <View style={styles.cardHead}>
                    <View style={styles.cardHeadCopy}>
                      <Text style={styles.type}>{leave.type === "IZIN" ? "Izin" : "Sakit"}</Text>
                      <Text style={styles.date}>
                        {leave.start_date === leave.end_date
                          ? formatDate(leave.start_date)
                          : `${formatDate(leave.start_date)} - ${formatDate(leave.end_date)}`}
                      </Text>
                    </View>
                    <StatusPill
                      tone={
                        leave.status === "APPROVED"
                          ? "success"
                          : leave.status === "REJECTED"
                            ? "danger"
                            : "warning"
                      }
                    >
                      {status}
                    </StatusPill>
                  </View>
                  <Text style={styles.reason}>{leave.reason}</Text>
                  {leave.admin_note ? (
                    <Text
                      style={[
                        styles.adminNote,
                        leave.status === "REJECTED" && styles.adminNoteRejected,
                      ]}
                    >
                      {leave.admin_note}
                    </Text>
                  ) : null}
                  <View style={styles.footer}>
                    <Text style={styles.footerText}>
                      Dikirim {formatDate(leave.created_at)}
                      {leave.reviewed_at ? ` · diproses ${formatDate(leave.reviewed_at)}` : ""}
                    </Text>
                    <View style={styles.file}>
                      {leave.attachment_path ? (
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={`Buka lampiran ${fileName}`}
                          onPress={() => void openAttachment(leave.attachment_path as string)}
                          style={styles.fileOpen}
                        >
                          <Icon name="attach-outline" size={13} color={colors.primaryInk} />
                          <Text style={[styles.footerText, styles.fileOpenText]} numberOfLines={1}>
                            {fileName}
                          </Text>
                        </Pressable>
                      ) : (
                        <>
                          <Icon name="remove-circle-outline" size={13} color={colors.muted} />
                          <Text style={styles.footerText} numberOfLines={1}>
                            Tanpa lampiran
                          </Text>
                        </>
                      )}
                    </View>
                  </View>
                </View>
              );
            })}
          </Surface>
        ) : (
          <EmptyState
            icon="reader-outline"
            title="Belum ada pengajuan"
            copy={
              filter === "Semua"
                ? "Pengajuan izin atau sakit yang kamu buat akan muncul di sini."
                : `Belum ada pengajuan ${filter.toLowerCase()} pada periode ini.`
            }
            actionLabel="Buat pengajuan"
            action={() => router.push("/izin/baru")}
          />
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  headerAction: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  toast: {
    marginHorizontal: 18,
    marginTop: 14,
    padding: 12,
    borderRadius: 12,
    backgroundColor: colors.successSoft,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
  },
  toastText: {
    flex: 1,
    fontFamily: fonts.bold,
    color: colors.successInk,
    fontSize: 9.5,
    lineHeight: 15,
  },
  content: { paddingHorizontal: 18, paddingTop: 20, paddingBottom: 28 },
  tabs: {
    marginBottom: 15,
    padding: 5,
    borderRadius: 13,
    backgroundColor: colors.surface2,
    flexDirection: "row",
    gap: 5,
  },
  tab: { flex: 1, minHeight: 44, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  tabActive: {
    backgroundColor: colors.surface,
    shadowColor: "#46332A",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 2,
  },
  tabText: { fontFamily: fonts.extrabold, color: colors.muted, fontSize: 11 },
  tabTextActive: { color: colors.ink },
  card: { padding: 15, borderBottomWidth: 1, borderBottomColor: colors.lineSoft },
  cardHead: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  cardHeadCopy: { flex: 1 },
  type: { fontFamily: fonts.extrabold, color: colors.ink, fontSize: 13 },
  date: { marginTop: 3, fontFamily: fonts.regular, color: colors.muted, fontSize: 11 },
  reason: {
    marginTop: 11,
    fontFamily: fonts.regular,
    color: colors.muted,
    fontSize: 11,
    lineHeight: 18,
  },
  adminNote: {
    marginTop: 12,
    padding: 10,
    borderRadius: 11,
    backgroundColor: colors.slateSoft,
    color: colors.slateInk,
    fontFamily: fonts.regular,
    fontSize: 11,
    lineHeight: 17,
  },
  adminNoteRejected: { backgroundColor: colors.dangerSoft, color: colors.dangerInk },
  footer: {
    marginTop: 12,
    paddingTop: 11,
    borderTopWidth: 1,
    borderTopColor: colors.lineSoft,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  footerText: { flex: 1, fontFamily: fonts.regular, color: colors.muted, fontSize: 11 },
  file: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: 5 },
  fileOpen: { flexDirection: "row", alignItems: "center", gap: 5, maxWidth: "100%" },
  fileOpenText: { color: colors.primaryInk, textDecorationLine: "underline" },
  toastError: {
    marginBottom: 12,
    padding: 11,
    borderRadius: 11,
    backgroundColor: colors.dangerSoft,
  },
  toastErrorText: {
    fontFamily: fonts.medium,
    color: colors.dangerInk,
    fontSize: 11,
    lineHeight: 17,
  },
});
