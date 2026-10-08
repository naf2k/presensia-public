import { useLocalSearchParams, useRouter } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { Button, Icon, Screen, typography } from "@/src/ui";
import { colors, fonts } from "@/src/theme";
import { errorMessage, formatTimestamp } from "@/src/format";
import { useAttendanceDetail, useParticipantContext } from "@/src/queries";

export default function ResultScreen() {
  const { type = "checkin", attendanceId = "" } = useLocalSearchParams<{
    type?: "checkin" | "checkout";
    attendanceId?: string;
  }>();
  const router = useRouter();
  const detail = useAttendanceDetail(attendanceId);
  const context = useParticipantContext();
  const checkout = type === "checkout";
  const submissionFailed = !attendanceId;
  const confirmationFailed = Boolean(attendanceId) && detail.isError;
  const failed = submissionFailed || confirmationFailed;
  const attendance = detail.data?.attendance;
  const locationName = context.data?.settings.location_name ?? "lokasi presensi";
  if ((attendanceId && detail.isPending) || context.isPending)
    return (
      <Screen>
        <View style={styles.page}>
          <View style={styles.visual}>
            <Icon name="time-outline" size={60} color="#fff" />
          </View>
          <View style={styles.copy}>
            <Text style={typography.h1}>Menyiapkan hasil presensi</Text>
            <Text style={[typography.muted, styles.description]}>
              Memuat timestamp dan status resmi dari server.
            </Text>
          </View>
        </View>
      </Screen>
    );
  return (
    <Screen>
      <View style={styles.page}>
        <View style={[styles.visualRing, failed && styles.visualRingFailed]}>
          <View style={[styles.visual, failed && styles.visualFailed]}>
            <View style={styles.visualIcon}>
              <Icon
                name={failed ? "close" : "checkmark"}
                size={58}
                color={failed ? colors.dangerInk : "#fff"}
              />
            </View>
          </View>
        </View>
        <View style={styles.copy}>
          <Text style={styles.heading}>
            {submissionFailed
              ? checkout
                ? "Presensi pulang belum tercatat"
                : "Presensi masuk belum tercatat"
              : confirmationFailed
                ? "Presensi terkirim"
                : checkout
                  ? "Presensi pulang berhasil"
                  : "Presensi berhasil"}
          </Text>
          <Text style={[typography.muted, styles.description]}>
            {submissionFailed
              ? "Server belum menerima data presensimu. Data sebelumnya tidak berubah dan kamu dapat mencoba lagi."
              : confirmationFailed
                ? "Presensimu sudah terkirim, tetapi detail konfirmasinya belum dapat dimuat."
                : checkout
                  ? "Aktivitasmu hari ini sudah tercatat lengkap. Sampai jumpa besok!"
                  : "Kehadiranmu sudah tercatat menggunakan waktu server. Selamat beraktivitas!"}
          </Text>
        </View>
        {!failed && attendance ? (
          <>
            <View style={styles.timeCard}>
              <View style={styles.timeCell}>
                <Text style={styles.timeLabel}>{checkout ? "Waktu pulang" : "Waktu masuk"}</Text>
                <Text style={styles.timeValue}>
                  {formatTimestamp(
                    checkout ? attendance.check_out_at : attendance.check_in_at,
                    true,
                  )}
                </Text>
              </View>
              <View style={styles.timeCell}>
                <Text style={styles.timeLabel}>Status</Text>
                <Text style={styles.status}>
                  {attendance.status === "TERLAMBAT" ? "Terlambat" : "Hadir"}
                </Text>
              </View>
            </View>
            <View style={styles.location}>
              <View style={styles.locationIcon}>
                <Icon name="location" size={19} color={colors.successInk} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.locationTitle}>Lokasi terverifikasi</Text>
                <Text style={styles.locationCopy}>
                  {Math.round(attendance.check_in_distance_m ?? 0)} m dari {locationName} · bukti
                  tersimpan privat
                </Text>
              </View>
            </View>
            {checkout && attendance.work_duration_minutes !== null ? (
              <View style={styles.location}>
                <View style={styles.locationIcon}>
                  <Icon name="time-outline" size={19} color={colors.successInk} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.locationTitle}>Durasi kerja tercatat</Text>
                  <Text style={styles.locationCopy}>
                    {Math.floor(attendance.work_duration_minutes / 60)} jam{" "}
                    {attendance.work_duration_minutes % 60} menit
                    {attendance.early_checkout_minutes > 0
                      ? ` · pulang ${attendance.early_checkout_minutes} menit lebih awal`
                      : ""}
                  </Text>
                </View>
              </View>
            ) : null}
          </>
        ) : failed ? (
          <Text style={styles.failureCopy}>
            {submissionFailed
              ? "ID presensi tidak tersedia."
              : detail.error
                ? errorMessage(detail.error)
                : "Detail belum dapat dimuat."}
          </Text>
        ) : null}
        <View style={styles.actions}>
          {submissionFailed ? (
            <>
              <Button
                label="Coba lagi"
                onPress={() => router.replace(checkout ? "/check-out" : "/check-in")}
              />
              <Button variant="quiet" label="Kembali ke beranda" onPress={() => router.replace("/")} />
            </>
          ) : confirmationFailed ? (
            <>
              <Button label="Muat ulang" loading={detail.isFetching} onPress={() => void detail.refetch()} />
              <Button variant="secondary" label="Kembali ke beranda" onPress={() => router.replace("/")} />
            </>
          ) : (
            <>
              <Button label="Kembali ke beranda" onPress={() => router.replace("/")} />
              <Button
                variant="secondary"
                label="Lihat detail presensi"
                onPress={() => router.replace(`/riwayat/${attendanceId}`)}
              />
            </>
          )}
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, minHeight: 650, paddingTop: 42 },
  visualRing: {
    alignSelf: "center",
    marginTop: 26,
    padding: 11,
    borderWidth: 1,
    borderColor: "rgba(82,112,90,0.24)",
    borderRadius: 50,
  },
  visualRingFailed: { borderColor: "rgba(153,48,43,0.2)" },
  visual: {
    width: 132,
    height: 132,
    borderRadius: 42,
    backgroundColor: colors.success,
    alignItems: "center",
    justifyContent: "center",
    transform: [{ rotate: "-4deg" }],
    shadowColor: "#3E5D47",
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.2,
    shadowRadius: 44,
    elevation: 6,
  },
  visualIcon: { transform: [{ rotate: "4deg" }] },
  visualFailed: { backgroundColor: colors.dangerSoft },
  copy: { marginTop: 32, alignItems: "center" },
  heading: {
    fontFamily: fonts.extrabold,
    color: colors.ink,
    fontSize: 26,
    lineHeight: 31,
    letterSpacing: -1,
    textAlign: "center",
  },
  description: { marginTop: 10, maxWidth: 330, textAlign: "center" },
  timeCard: {
    marginTop: 28,
    borderWidth: 1,
    borderColor: colors.lineSoft,
    borderRadius: 15,
    overflow: "hidden",
    backgroundColor: colors.surface,
    flexDirection: "row",
  },
  timeCell: { flex: 1, padding: 15, borderRightWidth: 1, borderRightColor: colors.lineSoft },
  timeLabel: { fontFamily: fonts.semibold, color: colors.muted, fontSize: 11 },
  timeValue: { marginTop: 3, fontFamily: fonts.extrabold, color: colors.ink, fontSize: 17 },
  status: { marginTop: 3, fontFamily: fonts.extrabold, color: colors.successInk, fontSize: 17 },
  location: {
    marginTop: 12,
    padding: 13,
    borderRadius: 13,
    backgroundColor: colors.successSoft,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  locationIcon: {
    width: 36,
    height: 36,
    borderRadius: 11,
    backgroundColor: "rgba(255,255,255,0.55)",
    alignItems: "center",
    justifyContent: "center",
  },
  locationTitle: { fontFamily: fonts.extrabold, color: colors.successInk, fontSize: 11 },
  locationCopy: {
    marginTop: 2,
    fontFamily: fonts.regular,
    color: colors.successInk,
    fontSize: 11,
    lineHeight: 16,
    opacity: 0.88,
  },
  actions: { marginTop: "auto", paddingTop: 30, gap: 9 },
  failureCopy: {
    marginTop: 24,
    padding: 12,
    borderRadius: 12,
    backgroundColor: colors.dangerSoft,
    color: colors.dangerInk,
    fontFamily: fonts.medium,
    fontSize: 11,
    lineHeight: 17,
  },
});
