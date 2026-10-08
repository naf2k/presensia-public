import { CameraView, useCameraPermissions } from "expo-camera";
import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Image, Linking, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useQueryClient } from "@tanstack/react-query";
import { checkOut, newOperationId } from "@/src/api";
import { errorMessage, formatDate, formatTimestamp } from "@/src/format";
import { captureSelfie, usesSystemCamera } from "@/src/photo";
import { queryKeys, useToday } from "@/src/queries";
import { useServerNow } from "@/src/server-time";
import { AppBar, Button, Icon, PageState, Screen, ScreenIntro, Sheet } from "@/src/ui";
import { colors, fonts } from "@/src/theme";

function formatDuration(fromIso: string | null, nowMs: number) {
  if (!fromIso) return "—";
  const diff = Math.max(0, nowMs - new Date(fromIso).getTime());
  const hours = Math.floor(diff / 3_600_000);
  const minutes = Math.floor((diff % 3_600_000) / 60_000);
  if (hours <= 0) return `${minutes} menit`;
  return `${hours} jam ${minutes} menit`;
}

export default function CheckOutScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const today = useToday();
  const serverNow = useServerNow(15_000);
  const camera = useRef<CameraView>(null);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [journal, setJournal] = useState("");
  const [confirm, setConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [photo, setPhoto] = useState<string | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [error, setError] = useState("");
  const operationRef = useRef<string | null>(null);
  useEffect(() => {
    operationRef.current = null;
  }, [photo]);
  const appBar = (subtitle?: string) => <AppBar title="Absen Pulang" subtitle={subtitle} back />;
  if (today.isPending)
    return (
      <Screen tone="app" padded={false} appBar={appBar()}>
        <PageState loading title="Memeriksa presensi" copy="Memuat status check-in hari ini." />
      </Screen>
    );
  if (today.isError)
    return (
      <Screen tone="app" padded={false} appBar={appBar()}>
        <PageState
          title="Check-out belum tersedia"
          copy={errorMessage(today.error)}
          action={() => void today.refetch()}
        />
      </Screen>
    );
  const attendance = today.data.attendance;
  const settings = today.data.context.settings;
  if (!attendance?.check_in_at)
    return (
      <Screen tone="app" padded={false} appBar={appBar()}>
        <PageState
          icon="time-outline"
          title="Belum ada check-in hari ini"
          copy="Presensi pulang hanya tersedia setelah presensi masuk berhasil tercatat."
          actionLabel="Mulai check-in"
          action={() => router.replace("/check-in")}
        />
      </Screen>
    );
  if (attendance.check_out_at)
    return (
      <Screen tone="app" padded={false} appBar={appBar()}>
        <PageState
          icon="time-outline"
          title="Check-out sudah tercatat"
          copy={`Presensi pulang direkam pukul ${formatTimestamp(attendance.check_out_at, true)}.`}
          actionLabel="Lihat presensi hari ini"
          action={() => router.replace(`/riwayat/${attendance.id}`)}
        />
      </Screen>
    );

  if (cameraOpen)
    return (
      <SafeAreaView style={styles.cameraPage}>
        <StatusBar style="light" />
        <CameraView ref={camera} style={StyleSheet.absoluteFill} facing="front" mirror />
        <View style={styles.cameraOverlay}>
          <Text style={styles.cameraInstruction}>
            Ambil selfie check-out dengan wajah terlihat jelas.
          </Text>
          <Pressable
            accessibilityLabel="Ambil selfie check-out"
            accessibilityRole="button"
            disabled={capturing}
            onPress={() => void capturePhoto()}
            style={[styles.shutter, capturing && { opacity: 0.6 }]}
          >
            <View style={styles.shutterInner} />
          </Pressable>
          <Text style={styles.shutterLabel}>Ambil foto</Text>
          <Button
            variant="secondary"
            label="Batal"
            onPress={() => {
              setCameraOpen(false);
              setCapturing(false);
            }}
          />
        </View>
      </SafeAreaView>
    );

  async function capturePhoto() {
    if (capturing) return;
    setCapturing(true);
    try {
      if (usesSystemCamera) {
        const captured = await captureSelfie();
        if (captured?.uri) {
          setPhoto(captured.uri);
          setError("");
        } else {
          setError("Pengambilan foto dibatalkan. Coba lagi.");
        }
      } else {
        const picture = await camera.current?.takePictureAsync({ quality: 0.5 });
        if (picture?.uri) {
          setPhoto(picture.uri);
          setError("");
        } else {
          setError("Foto tidak dapat diambil. Coba lagi.");
        }
      }
    } catch {
      setError("Foto tidak dapat diambil. Periksa izin kamera lalu coba lagi.");
    } finally {
      setCapturing(false);
      setCameraOpen(false);
    }
  }

  async function openCamera() {
    try {
      const permission = cameraPermission?.granted
        ? cameraPermission
        : await requestCameraPermission();
      if (!permission.granted) {
        setError(
          "Akses kamera dibutuhkan untuk selfie check-out. Buka pengaturan untuk mengizinkan.",
        );
        return;
      }
      setCameraOpen(true);
      setError("");
    } catch {
      setError("Kamera tidak dapat dibuka. Coba lagi.");
    }
  }
  async function submit() {
    if (settings.require_checkout_photo && !photo) {
      setConfirm(false);
      setError("Ambil selfie check-out sebelum mencatat presensi pulang.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      operationRef.current ??= newOperationId();
      const result = await checkOut({
        journalContent: journal,
        photo: photo ? { uri: photo } : null,
        operationId: operationRef.current,
      });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.today }),
        queryClient.invalidateQueries({ queryKey: ["journals"] }),
        queryClient.invalidateQueries({ queryKey: ["attendance"] }),
      ]);
      setConfirm(false);
      router.replace(`/result?type=checkout&attendanceId=${result.id}`);
    } catch (nextError) {
      setConfirm(false);
      setError(errorMessage(nextError));
    } finally {
      setSubmitting(false);
    }
  }

  const cameraDenied = cameraPermission?.status === "denied";
  return (
    <Screen
      tone="app"
      padded={false}
      appBar={appBar(
        formatDate(today.data.date, { weekday: "long", day: "numeric", month: "long" }),
      )}
    >
      <View style={styles.content}>
        <View style={styles.summary}>
          <View style={styles.summaryCell}>
            <Text style={styles.summaryLabel}>Masuk</Text>
            <Text style={styles.summaryValue}>{formatTimestamp(attendance.check_in_at)}</Text>
          </View>
          <View style={styles.summaryCell}>
            <Text style={styles.summaryLabel}>Sekarang</Text>
            <Text style={styles.summaryValue}>{formatTimestamp(serverNow.toISOString())}</Text>
          </View>
          <View style={[styles.summaryCell, styles.summaryCellLast]}>
            <Text style={styles.summaryLabel}>Durasi saat ini</Text>
            <Text style={styles.summaryValue}>
              {formatDuration(attendance.check_in_at, serverNow.getTime())}
            </Text>
          </View>
        </View>
        <ScreenIntro
          title="Selesaikan aktivitas hari ini"
          copy="Kamu boleh menambahkan jurnal singkat sebelum waktu pulang dicatat."
        />
        <View style={styles.journalCard}>
          <View style={styles.fieldHead}>
            <Text style={styles.label}>Jurnal kegiatan</Text>
            <Text style={styles.counter}>
              {journal.length}/{settings.max_journal_length}
            </Text>
          </View>
          <TextInput
            accessibilityLabel="Jurnal kegiatan"
            value={journal}
            onChangeText={setJournal}
            maxLength={settings.max_journal_length}
            multiline
            placeholder="Apa yang kamu kerjakan hari ini?"
            placeholderTextColor="#827D76"
            style={styles.textarea}
          />
          <Text style={styles.helper}>
            Opsional. Kamu tetap bisa absen pulang tanpa mengisi jurnal.
          </Text>
        </View>
        {settings.require_checkout_photo ? (
          <View style={styles.formField}>
            <Text style={styles.label}>Selfie check-out</Text>
            {photo ? (
              <View style={styles.photoReady}>
                <Image source={{ uri: photo }} style={styles.photoThumb} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.fileTitle}>Selfie siap dikirim</Text>
                  <Text style={styles.fileCopy}>Periksa kembali sebelum mencatat pulang</Text>
                </View>
                <Pressable
                  accessibilityLabel="Ambil ulang selfie"
                  accessibilityRole="button"
                  onPress={() => void openCamera()}
                  style={styles.retake}
                >
                  <Icon name="camera-reverse-outline" size={18} color={colors.primaryInk} />
                </Pressable>
              </View>
            ) : (
              <Pressable
                accessibilityLabel="Ambil selfie pulang"
                accessibilityRole="button"
                onPress={() => void openCamera()}
                style={styles.file}
              >
                <View style={styles.fileIcon}>
                  <Icon name="camera-outline" color={colors.primaryInk} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fileTitle}>Ambil selfie pulang</Text>
                  <Text style={styles.fileCopy}>Wajib sesuai pengaturan admin · JPG</Text>
                </View>
              </Pressable>
            )}
            {cameraDenied ? (
              <Pressable
                accessibilityRole="button"
                onPress={() => void Linking.openSettings()}
                style={styles.settingsRow}
              >
                <Text style={styles.settingsText}>Kamera ditolak — buka pengaturan</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}
        <View style={styles.serverNote}>
          <View style={styles.serverTile}>
            <Icon name="time-outline" size={17} color={colors.successInk} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.serverTitle}>
              Waktu server {formatTimestamp(attendance.check_in_at, true)}
            </Text>
            <Text style={styles.serverCopy}>Jam perangkat tidak digunakan.</Text>
          </View>
        </View>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <View style={styles.actions}>
          {error ? (
            <Button label="Coba lagi" loading={submitting} onPress={() => void submit()} />
          ) : (
            <Button
              icon="log-out-outline"
              label="Konfirmasi Absen Pulang"
              onPress={() => setConfirm(true)}
            />
          )}
          <Button variant="quiet" label="Kembali tanpa absen" onPress={() => router.replace("/")} />
        </View>
      </View>
      <Sheet
        visible={confirm}
        onClose={() => setConfirm(false)}
        title="Catat presensi pulang?"
        copy={`Presensi akan dicatat dan tidak dapat diubah setelah tersimpan.`}
      >
        <Button
          icon="log-out-outline"
          label="Ya, catat presensi pulang"
          loading={submitting}
          onPress={() => void submit()}
        />
        <Button variant="secondary" label="Kembali periksa" onPress={() => setConfirm(false)} />
      </Sheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  cameraPage: { flex: 1, backgroundColor: colors.dark },
  cameraOverlay: {
    flex: 1,
    paddingHorizontal: 28,
    paddingTop: 60,
    paddingBottom: 40,
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.18)",
  },
  cameraInstruction: { fontFamily: fonts.bold, color: "#fff", fontSize: 13, textAlign: "center" },
  shutter: {
    width: 74,
    height: 74,
    borderRadius: 37,
    borderWidth: 3,
    borderColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
  shutterInner: { width: 58, height: 58, borderRadius: 29, backgroundColor: "#fff" },
  shutterLabel: { fontFamily: fonts.bold, color: "#fff", fontSize: 11 },
  content: { paddingHorizontal: 18, paddingTop: 20, paddingBottom: 28 },
  summary: {
    marginBottom: 20,
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: colors.dark,
    flexDirection: "row",
  },
  summaryCell: {
    flex: 1,
    padding: 17,
    borderRightWidth: 1,
    borderRightColor: "rgba(255,255,255,0.1)",
  },
  summaryCellLast: { borderRightWidth: 0 },
  summaryLabel: { fontFamily: fonts.semibold, color: "#C9C0BA", fontSize: 11 },
  summaryValue: { marginTop: 4, fontFamily: fonts.extrabold, color: "#fff", fontSize: 19 },
  journalCard: {
    marginTop: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.lineSoft,
    borderRadius: 16,
    backgroundColor: colors.surface,
  },
  formField: { marginTop: 20, gap: 7 },
  fieldHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  label: { fontFamily: fonts.bold, color: colors.ink, fontSize: 12 },
  counter: { fontFamily: fonts.semibold, color: colors.muted, fontSize: 11 },
  textarea: {
    minHeight: 132,
    marginTop: 7,
    padding: 13,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 12,
    backgroundColor: colors.surface,
    textAlignVertical: "top",
    color: colors.ink,
    fontFamily: fonts.regular,
    fontSize: 16,
    lineHeight: 24,
  },
  helper: {
    marginTop: 7,
    fontFamily: fonts.regular,
    color: colors.muted,
    fontSize: 11,
    lineHeight: 17,
  },
  file: {
    minHeight: 92,
    padding: 14,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: "#CFC4B8",
    borderRadius: 13,
    backgroundColor: "#FBF9F6",
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  fileIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  fileTitle: { fontFamily: fonts.bold, color: colors.ink, fontSize: 12 },
  fileCopy: { marginTop: 3, fontFamily: fonts.regular, color: colors.muted, fontSize: 11 },
  photoReady: {
    minHeight: 92,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.lineSoft,
    borderRadius: 13,
    backgroundColor: colors.surface,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  photoThumb: { width: 64, height: 64, borderRadius: 12, backgroundColor: colors.surface2 },
  retake: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  settingsRow: { minHeight: 44, justifyContent: "center" },
  settingsText: { fontFamily: fonts.extrabold, color: colors.primaryInk, fontSize: 12 },
  serverNote: {
    marginTop: 18,
    padding: 13,
    borderRadius: 13,
    backgroundColor: colors.successSoft,
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
  },
  serverTile: {
    width: 34,
    height: 34,
    borderRadius: 11,
    backgroundColor: "rgba(255,255,255,0.58)",
    alignItems: "center",
    justifyContent: "center",
  },
  serverTitle: { fontFamily: fonts.extrabold, color: colors.successInk, fontSize: 12 },
  serverCopy: {
    marginTop: 2,
    fontFamily: fonts.regular,
    color: colors.successInk,
    fontSize: 11,
    lineHeight: 16,
    opacity: 0.88,
  },
  error: {
    marginTop: 14,
    padding: 12,
    borderRadius: 11,
    backgroundColor: colors.dangerSoft,
    color: colors.dangerInk,
    fontFamily: fonts.medium,
    fontSize: 11,
    lineHeight: 17,
  },
  actions: { marginTop: 18, gap: 9 },
});
