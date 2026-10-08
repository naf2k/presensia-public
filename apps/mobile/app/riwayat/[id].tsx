import { useLocalSearchParams, useRouter } from "expo-router";
import { ActivityIndicator, Image, StyleSheet, Text, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { getSignedUrl } from "@/src/api";
import { errorMessage, formatDate, formatTimestamp } from "@/src/format";
import { useAttendanceDetail, useParticipantContext } from "@/src/queries";
import {
  AppBar,
  Button,
  Icon,
  PageState,
  Screen,
  SectionHead,
  StatusPill,
  Surface,
} from "@/src/ui";
import { colors, fonts } from "@/src/theme";

export default function AttendanceDetailScreen() {
  const { id = "" } = useLocalSearchParams<{ id?: string }>();
  const router = useRouter();
  const detail = useAttendanceDetail(id);
  const context = useParticipantContext();
  const photoPath = detail.data?.attendance.check_in_photo_path;
  const photo = useQuery({
    queryKey: ["evidence-url", photoPath],
    queryFn: () => getSignedUrl("attendance-photos", photoPath!),
    enabled: Boolean(photoPath),
    staleTime: 240_000,
  });
  const appBar = (subtitle?: string) => (
    <AppBar title="Detail Kehadiran" subtitle={subtitle} back />
  );
  if (!id)
    return (
      <Screen tone="app" padded={false} appBar={appBar()}>
        <PageState title="Detail tidak ditemukan" copy="ID presensi tidak tersedia." />
      </Screen>
    );
  if (detail.isPending || context.isPending)
    return (
      <Screen tone="app" padded={false} appBar={appBar()}>
        <PageState
          loading
          title="Menyiapkan detail"
          copy="Memuat bukti, waktu, dan lokasi presensi."
        />
      </Screen>
    );
  if (detail.isError || context.isError)
    return (
      <Screen tone="app" padded={false} appBar={appBar()}>
        <PageState
          title="Detail belum dapat dimuat"
          copy={errorMessage(detail.error ?? context.error)}
          action={() => {
            void detail.refetch();
            void context.refetch();
          }}
        />
        <View style={styles.pagePad}>
          <Button
            variant="quiet"
            label="Kembali ke riwayat"
            onPress={() => router.replace("/riwayat")}
          />
        </View>
      </Screen>
    );
  const { attendance, journal } = detail.data;
  const profile = context.data.profile;
  const snapshot = attendance.policy_snapshot ?? undefined;
  const radius = snapshot?.radiusMeters ?? context.data.settings.radius_meters;
  const distance = attendance.check_in_distance_m;
  const locationValid = distance !== null && distance <= radius;
  const label =
    attendance.status === "HADIR"
      ? "Hadir"
      : attendance.status === "TERLAMBAT"
        ? "Terlambat"
        : attendance.status === "IZIN"
          ? "Izin"
          : attendance.status === "SAKIT"
            ? "Sakit"
            : "Tidak hadir";
  const tone =
    attendance.status === "HADIR"
      ? "success"
      : attendance.status === "TERLAMBAT"
        ? "warning"
        : attendance.status === "TIDAK_HADIR"
          ? "danger"
          : "primary";
  return (
    <Screen tone="app" padded={false} appBar={appBar(`ATT-${attendance.attendance_date.replaceAll("-", "")}`)}>
      <View style={styles.content}>
        <View style={styles.hero}>
          <View style={styles.heroTop}>
            <StatusPill tone={tone}>{label}</StatusPill>
            <View style={styles.server}>
              <Icon name="cloud-done-outline" size={13} color="#C8C0BA" />
              <Text style={styles.serverText}>Waktu server</Text>
            </View>
          </View>
          <Text style={styles.heroDate}>
            {formatDate(attendance.attendance_date, {
              weekday: "long",
              day: "numeric",
              month: "short",
            })}
          </Text>
          <Text style={styles.heroCopy}>Presensi harian {profile.full_name}</Text>
          <View style={styles.times}>
            <View style={styles.time}>
              <Text style={styles.timeLabel}>Masuk</Text>
              <Text style={styles.timeValue}>{formatTimestamp(attendance.check_in_at)}</Text>
            </View>
            <View style={styles.time}>
              <Text style={styles.timeLabel}>Pulang</Text>
              <Text style={styles.timeValue}>{formatTimestamp(attendance.check_out_at)}</Text>
            </View>
          </View>
        </View>
        <SectionHead title="Bukti check-in" subtitle="Hanya dapat diakses olehmu dan admin" />
        <Surface style={styles.evidenceCard}>
          {!photoPath ? (
            <View style={styles.photoError}>
              <View style={styles.photoErrorIcon}>
                <Icon name="image-outline" size={30} color={colors.dangerInk} />
              </View>
              <Text style={styles.photoErrorTitle}>Tidak ada bukti selfie</Text>
              <Text style={styles.photoErrorCopy}>
                Status ini berasal dari izin atau koreksi administratif.
              </Text>
            </View>
          ) : photo.isError ? (
            <View style={styles.photoError}>
              <View style={styles.photoErrorIcon}>
                <Icon name="image-outline" size={30} color={colors.dangerInk} />
              </View>
              <Text style={styles.photoErrorTitle}>Bukti foto belum dapat dibuka</Text>
              <Text style={styles.photoErrorCopy}>Periksa koneksi lalu muat ulang foto.</Text>
              <View style={{ width: 190, marginTop: 16 }}>
                <Button
                  variant="secondary"
                  label="Muat ulang foto"
                  onPress={() => void photo.refetch()}
                />
              </View>
            </View>
          ) : photo.data ? (
            <View style={styles.photo}>
              <Image
                source={{ uri: photo.data }}
                style={StyleSheet.absoluteFill}
                resizeMode="cover"
              />
            </View>
          ) : (
            <View style={styles.photoLoading}>
              <ActivityIndicator color={colors.primary} />
              <Text style={styles.photoLoadingText}>Memuat bukti foto...</Text>
            </View>
          )}
          <View style={styles.detailList}>
            <Detail
              label="Lokasi"
              value={
                distance === null
                  ? "Tidak tersedia"
                  : locationValid
                    ? `Valid · ${Math.round(distance)} m`
                    : `Tidak valid · ${Math.round(distance)} m`
              }
              valid={distance === null ? undefined : locationValid}
            />
            <Detail
              label="Akurasi GPS"
              value={
                attendance.check_in_accuracy_m === null
                  ? "Tidak tersedia"
                  : `${Math.round(attendance.check_in_accuracy_m)} meter`
              }
            />
            <Detail
              label="Koordinat"
              value={
                attendance.check_in_latitude === null
                  ? "Tidak tersedia"
                  : `${attendance.check_in_latitude}, ${attendance.check_in_longitude}`
              }
            />
            <Detail
              label="Status awal"
              value={`${label}${attendance.late_minutes ? ` · terlambat ${attendance.late_minutes} menit` : " · tidak terlambat"}`}
            />
            <Detail
              label="Durasi kerja"
              value={
                attendance.work_duration_minutes === null
                  ? "Belum absen pulang"
                  : `${Math.floor(attendance.work_duration_minutes / 60)} jam ${attendance.work_duration_minutes % 60} menit`
              }
            />
            <Detail
              label="Pulang lebih awal"
              value={
                attendance.early_checkout_minutes > 0
                  ? `${attendance.early_checkout_minutes} menit`
                  : "Tidak"
              }
              last
            />
          </View>
        </Surface>
        <SectionHead
          title="Jurnal kegiatan"
          subtitle={journal ? `Diperbarui ${formatTimestamp(journal.updated_at, true)}` : "Opsional"}
        />
        <Surface style={styles.journal}>
          <Text style={styles.journalText}>
            {journal?.content ?? "Tidak ada jurnal untuk tanggal ini."}
          </Text>
        </Surface>
        <View style={styles.privacy}>
          <Icon name="lock-closed-outline" size={15} color={colors.muted} />
          <Text style={styles.privacyText}>
            Bukti dan lokasi hanya dapat diakses olehmu dan admin.
          </Text>
        </View>
      </View>
    </Screen>
  );
}

function Detail({
  label,
  value,
  valid,
  last,
}: {
  label: string;
  value: string;
  valid?: boolean;
  last?: boolean;
}) {
  const tone = valid === undefined ? undefined : valid ? colors.successInk : colors.dangerInk;
  return (
    <View style={[styles.detailRow, last && { borderBottomWidth: 0 }]}>
      <Text style={styles.detailLabel}>{label}</Text>
      <View style={styles.detailValueWrap}>
        {valid !== undefined ? (
          <Icon
            name={valid ? "checkmark-circle" : "warning"}
            size={13}
            color={tone}
          />
        ) : null}
        <Text style={[styles.detailValue, tone && { color: tone }]}>{value}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 18, paddingTop: 20, paddingBottom: 28 },
  pagePad: { padding: 18 },
  hero: { padding: 18, borderRadius: 17, backgroundColor: colors.dark },
  heroTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  server: { flexDirection: "row", gap: 5, alignItems: "center" },
  serverText: { fontFamily: fonts.semibold, color: "#C9C1BB", fontSize: 11 },
  heroDate: {
    marginTop: 20,
    fontFamily: fonts.extrabold,
    color: "#fff",
    fontSize: 27,
    letterSpacing: -1,
  },
  heroCopy: { marginTop: 4, fontFamily: fonts.regular, color: "#C9C1BB", fontSize: 11 },
  times: { marginTop: 18, flexDirection: "row", gap: 10 },
  time: { flex: 1, padding: 12, borderRadius: 12, backgroundColor: "rgba(255,255,255,0.07)" },
  timeLabel: { fontFamily: fonts.semibold, color: "#C9C1BB", fontSize: 11 },
  timeValue: { marginTop: 3, fontFamily: fonts.extrabold, color: "#fff", fontSize: 16 },
  evidenceCard: { padding: 16 },
  photo: {
    minHeight: 240,
    borderRadius: 15,
    overflow: "hidden",
    backgroundColor: "#29302C",
  },
  photoLoading: {
    minHeight: 240,
    borderRadius: 15,
    backgroundColor: colors.surface2,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  photoLoadingText: { fontFamily: fonts.medium, color: colors.muted, fontSize: 11 },
  photoError: {
    minHeight: 260,
    borderRadius: 15,
    backgroundColor: colors.surface2,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  photoErrorIcon: { marginBottom: 12 },
  photoErrorTitle: { fontFamily: fonts.extrabold, color: colors.ink, fontSize: 13, textAlign: "center" },
  photoErrorCopy: {
    marginTop: 5,
    fontFamily: fonts.regular,
    color: colors.muted,
    fontSize: 11,
    lineHeight: 17,
    textAlign: "center",
    maxWidth: 260,
  },
  detailList: { marginTop: 4 },
  detailRow: {
    minHeight: 49,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.lineSoft,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  detailLabel: { flex: 0.7, fontFamily: fonts.regular, color: colors.muted, fontSize: 11 },
  detailValueWrap: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    gap: 5,
  },
  detailValue: { textAlign: "right", fontFamily: fonts.bold, color: colors.ink, fontSize: 11 },
  journal: { padding: 16 },
  journalText: { fontFamily: fonts.regular, color: colors.ink, fontSize: 12, lineHeight: 21 },
  privacy: { marginTop: 16, flexDirection: "row", alignItems: "flex-start", gap: 8 },
  privacyText: {
    flex: 1,
    fontFamily: fonts.regular,
    color: colors.muted,
    fontSize: 11,
    lineHeight: 18,
  },
});
