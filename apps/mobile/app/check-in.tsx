import { CameraView, useCameraPermissions, type CameraType } from "expo-camera";
import * as Location from "expo-location";
import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Easing,
  Image,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useQueryClient } from "@tanstack/react-query";
import { checkIn, newOperationId } from "@/src/api";
import { MobileApiError, errorMessage } from "@/src/format";
import { captureSelfie, usesSystemCamera } from "@/src/photo";
import { queryKeys, useToday } from "@/src/queries";
import {
  AppBar,
  Button,
  Icon,
  InlineFeedback,
  PageState,
  Screen,
  ScreenIntro,
  Sheet,
  Surface,
} from "@/src/ui";
import { colors, fonts } from "@/src/theme";

type FlowStep = "location" | "camera" | "preview";
type LocationIssue = "outside" | "accuracy" | "denied" | null;

function formatDistance(meters: number | null) {
  const value = Math.round(meters ?? 0);
  if (value >= 1000)
    return `${(value / 1000).toLocaleString("id-ID", { maximumFractionDigits: 1 })} km`;
  return `${value.toLocaleString("id-ID")} m`;
}

function useRadarWave(delay: number) {
  const progress = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(progress, {
          toValue: 1,
          duration: 2200,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [progress, delay]);
  return {
    transform: [
      {
        scale: progress.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1.45] }),
      },
    ],
    opacity: progress.interpolate({ inputRange: [0, 1], outputRange: [0.55, 0] }),
  };
}

function RadarOrbit() {
  const first = useRadarWave(0);
  const second = useRadarWave(1100);
  return (
    <View pointerEvents="none" style={styles.radarField}>
      <Animated.View style={[styles.radarWave, first]} />
      <Animated.View style={[styles.radarWave, second]} />
    </View>
  );
}

export default function CheckInScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const today = useToday();
  const camera = useRef<CameraView>(null);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [step, setStep] = useState<FlowStep>("location");
  const [issue, setIssue] = useState<LocationIssue>(null);
  const [locating, setLocating] = useState(true);
  const [locationReady, setLocationReady] = useState(false);
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [distance, setDistance] = useState<number | null>(null);
  const [photo, setPhoto] = useState<string | null>(null);
  const [facing, setFacing] = useState<CameraType>("front");
  const [submitting, setSubmitting] = useState(false);
  const [help, setHelp] = useState(false);
  const [warning, setWarning] = useState("");
  const [retry, setRetry] = useState<"upload" | "request" | null>(null);
  // One idempotency key per evidence set: retries reuse it, fresh captures rotate it.
  const operationRef = useRef<string | null>(null);

  useEffect(() => {
    if (step !== "location" || !today.data) return;
    void verifyLocation();
  }, [step, today.data]);

  const flowBar = (title: string, subtitle: string) => (
    <AppBar
      title={title}
      subtitle={subtitle}
      back
      action={
        <Pressable
          accessibilityLabel="Bantuan lokasi"
          accessibilityRole="button"
          onPress={() => setHelp(true)}
          style={styles.help}
        >
          <Icon name="help-circle-outline" />
        </Pressable>
      }
    />
  );
  if (today.isPending)
    return (
      <Screen tone="app" padded={false} appBar={flowBar("Absen masuk", "Absen masuk")}>
        <PageState
          loading
          title="Memeriksa status"
          copy="Memuat pengaturan dan presensi hari ini."
        />
      </Screen>
    );
  if (today.isError)
    return (
      <Screen tone="app" padded={false} appBar={flowBar("Absen masuk", "Absen masuk")}>
        <PageState
          title="Check-in belum tersedia"
          copy={errorMessage(today.error)}
          action={() => void today.refetch()}
        />
      </Screen>
    );
  if (today.data.attendance?.check_in_at)
    return (
      <Screen tone="app" padded={false} appBar={flowBar("Absen masuk", "Absen masuk")}>
        <PageState
          icon="shield-outline"
          title="Check-in sudah tercatat"
          copy="Presensi hari ini sudah tersimpan dan tidak dapat dikirim dua kali."
          actionLabel="Lihat presensi hari ini"
          action={() => router.replace(`/riwayat/${today.data.attendance?.id}`)}
        />
      </Screen>
    );
  if (
    today.data.attendance?.status === "IZIN" ||
    today.data.attendance?.status === "SAKIT"
  )
    return (
      <Screen tone="app" padded={false} appBar={flowBar("Absen masuk", "Absen masuk")}>
        <PageState
          icon="reader-outline"
          title="Check-in tidak diperlukan"
          copy={
            today.data.attendance.status === "SAKIT"
              ? "Pengajuan sakitmu sudah disetujui. Istirahatlah, tidak perlu presensi hari ini."
              : "Pengajuan izinmu sudah disetujui. Tidak perlu presensi hari ini."
          }
          actionLabel="Kembali ke beranda"
          action={() => router.replace("/")}
        />
      </Screen>
    );
  const settings = today.data.context.settings;
  const profile = today.data.context.profile;
  const internship = today.data.context.internship;
  const date = today.data.date;
  const isoDay = new Date(`${date}T12:00:00+07:00`).getUTCDay() || 7;
  const blocked = !profile.is_active
    ? "Akunmu sedang nonaktif. Hubungi admin program untuk mengaktifkan akses."
    : !internship || !internship.is_active || date < internship.start_date || date > internship.end_date
      ? "Program presensimu sedang tidak dalam periode aktif."
      : !settings.work_days.includes(isoDay)
        ? "Hari ini bukan hari kerja, jadi tidak ada jadwal presensi."
        : "";
  if (blocked)
    return (
      <Screen tone="app" padded={false} appBar={flowBar("Absen masuk", "Absen masuk")}>
        <PageState
          icon="calendar-outline"
          title="Check-in tidak tersedia"
          copy={blocked}
          actionLabel="Kembali ke beranda"
          action={() => router.replace("/")}
        />
      </Screen>
    );
  if (step === "camera" && cameraPermission?.status === "denied")
    return (
      <Screen tone="app" padded={false} appBar={flowBar("Ambil selfie", "Absen masuk")} scroll={false}>
        <View style={styles.progress}>
          {[0, 1, 2].map((value) => (
            <View
              key={value}
              style={[styles.progressBar, value <= 1 && styles.progressActive]}
            />
          ))}
        </View>
        <PageState
          icon="camera-outline"
          tone="error"
          title="Akses kamera dibutuhkan"
          copy="Izinkan kamera di pengaturan perangkat agar selfie dapat diambil."
          actionLabel="Buka pengaturan kamera"
          action={() => void Linking.openSettings()}
        />
        <View style={styles.bottomPad}>
          <Button
            variant="quiet"
            label="Kembali ke beranda"
            onPress={() => router.replace("/")}
          />
        </View>
      </Screen>
    );

  async function verifyLocation() {
    setLocating(true);
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== "granted") {
        setIssue("denied");
        setLocationReady(false);
        return;
      }
      const nextLocation = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      const accuracy = nextLocation.coords.accuracy ?? Number.POSITIVE_INFINITY;
      const nextDistance = haversine(
        nextLocation.coords.latitude,
        nextLocation.coords.longitude,
        settings.latitude,
        settings.longitude,
      );
      setLocation(nextLocation);
      setDistance(nextDistance);
      if (accuracy > settings.max_location_accuracy_meters) {
        setIssue("accuracy");
        setLocationReady(false);
      } else if (nextDistance > settings.radius_meters) {
        setIssue("outside");
        setLocationReady(false);
      } else {
        setIssue(null);
        setLocationReady(true);
      }
    } catch {
      setIssue("accuracy");
      setLocationReady(false);
    } finally {
      setLocating(false);
    }
  }

  async function openCamera() {
    try {
      const permission = cameraPermission?.granted
        ? cameraPermission
        : await requestCameraPermission();
      setStep("camera");
      if (!permission.granted) return;
    } catch {
      setStep("camera");
    }
  }

  async function takePhoto() {
    try {
      if (usesSystemCamera) {
        const captured = await captureSelfie();
        if (captured?.uri) {
          setPhoto(captured.uri);
          operationRef.current = null;
          setRetry(null);
          setWarning("");
        } else {
          setWarning("Pengambilan foto dibatalkan. Ketuk rana untuk mencoba lagi.");
        }
      } else {
        const picture = await camera.current?.takePictureAsync({ quality: 0.5 });
        if (picture?.uri) {
          setPhoto(picture.uri);
          operationRef.current = null;
          setRetry(null);
          setWarning("");
        }
      }
    } catch {
      setWarning("Foto tidak dapat diambil. Periksa izin kamera lalu coba lagi.");
    } finally {
      setStep("preview");
    }
  }

  async function submit() {
    if (!photo || !location) return;
    setSubmitting(true);
    setWarning("");
    setRetry(null);
    try {
      operationRef.current ??= newOperationId();
      const attendance = await checkIn({
        photoUri: photo,
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        accuracyMeters: location.coords.accuracy ?? 9999,
        operationId: operationRef.current,
      });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.today }),
        queryClient.invalidateQueries({ queryKey: ["attendance"] }),
      ]);
      router.replace(`/result?type=checkin&attendanceId=${attendance.id}`);
    } catch (error) {
      if (error instanceof MobileApiError && error.code === "LOCATION_OUTSIDE_RADIUS") {
        setIssue("outside");
        setLocationReady(false);
        setStep("location");
      } else if (error instanceof MobileApiError && error.code === "LOCATION_ACCURACY_TOO_LOW") {
        setIssue("accuracy");
        setLocationReady(false);
        setStep("location");
      } else {
        setWarning(
          error instanceof MobileApiError && error.code === "ON_APPROVED_LEAVE"
            ? "Pengajuan izin/sakitmu sudah disetujui, jadi tidak perlu check-in hari ini."
            : errorMessage(error),
        );
        setRetry(
          error instanceof MobileApiError && /UPLOAD|FILE|STORAGE|BUCKET|PHOTO/i.test(error.code)
            ? "upload"
            : "request",
        );
      }
    } finally {
      setSubmitting(false);
    }
  }

  const titles = {
    location: ["Verifikasi lokasi", "Absen masuk"],
    camera: ["Ambil selfie", "Absen masuk"],
    preview: ["Periksa foto", "Absen masuk"],
  } as const;
  return (
    <Screen
      tone="app"
      padded={false}
      scroll={step !== "camera"}
      appBar={flowBar(titles[step][0], titles[step][1])}
    >
      <View style={styles.progress}>
        {[0, 1, 2].map((value) => (
          <View
            key={value}
            style={[
              styles.progressBar,
              value <= ["location", "camera", "preview"].indexOf(step) && styles.progressActive,
            ]}
          />
        ))}
      </View>
      {step === "location" ? (
        <View style={styles.content}>
          <ScreenIntro
            title="Pastikan kamu berada di kantor"
            copy="Lokasi diambil satu kali untuk memvalidasi radius presensi. Presensia tidak melacak lokasimu sepanjang hari."
          />
          <View style={styles.orbit}>
            {locating && !issue ? <RadarOrbit /> : null}
            <View style={styles.orbitRingOuter} />
            <View style={styles.orbitRing} />
            <View style={[styles.pin, issue === "denied" && { backgroundColor: colors.danger }]}>
              <Icon
                name={issue === "denied" ? "lock-closed-outline" : "location"}
                size={27}
                color="#fff"
              />
            </View>
          </View>
          <View
            style={[
              styles.locationCheck,
              issue ? styles.locationCheckError : locating ? styles.locationCheckBusy : null,
            ]}
          >
            <View style={[styles.locationTile, issue && styles.locationTileError]}>
              {locating && !issue ? (
                <ActivityIndicator size="small" color={colors.secondaryDeep} />
              ) : (
                <Icon
                  name={issue ? "warning-outline" : "checkmark-outline"}
                  size={17}
                  color={issue ? colors.dangerInk : colors.successInk}
                />
              )}
            </View>
            <View style={{ flex: 1 }}>
              <Text
                style={[
                  styles.locationCheckTitle,
                  issue
                    ? { color: colors.dangerInk }
                    : locating
                      ? { color: colors.secondaryDeep }
                      : null,
                ]}
              >
                {issue === "outside"
                  ? "Di luar area presensi"
                  : issue === "accuracy"
                    ? "Lokasi belum cukup akurat"
                    : issue === "denied"
                      ? "Izin lokasi belum diberikan"
                      : locating
                        ? "Mengambil lokasi"
                        : "Lokasi memenuhi syarat"}
              </Text>
              <Text
                style={[
                  styles.locationCheckCopy,
                  issue
                    ? { color: colors.dangerInk }
                    : locating
                      ? { color: colors.secondaryDeep }
                      : null,
                ]}
              >
                {issue === "outside"
                  ? `Kamu berjarak ${formatDistance(distance)} dari kantor. Dekati lokasi lalu coba lagi.`
                  : issue === "accuracy"
                    ? `Akurasi GPS ${Math.round(location?.coords.accuracy ?? 0)} m, maksimum ${settings.max_location_accuracy_meters} m.`
                    : issue === "denied"
                      ? "Aktifkan akses lokasi di pengaturan perangkat untuk melanjutkan."
                      : locating
                        ? "Mohon tunggu sampai koordinat ditemukan."
                        : `${Math.round(distance ?? 0)} m dari ${settings.location_name} · akurasi ${Math.round(location?.coords.accuracy ?? 0)} m`}
              </Text>
            </View>
          </View>
          <View style={styles.privacy}>
            <Icon name="lock-closed-outline" size={15} color={colors.muted} />
            <Text style={styles.privacyCopy}>
              Koordinat hanya disimpan sebagai bagian dari bukti presensi.
            </Text>
          </View>
          <View style={styles.stack}>
            <Button
              label="Lanjut ambil selfie"
              icon="camera-outline"
              disabled={!locationReady}
              onPress={() => void openCamera()}
            />
            {issue ? (
              <Button
                variant="secondary"
                label={issue === "denied" ? "Buka pengaturan lokasi" : "Ambil ulang lokasi"}
                loading={locating}
                onPress={() =>
                  issue === "denied" ? void Linking.openSettings() : void verifyLocation()
                }
              />
            ) : null}
            <Button variant="quiet" label="Lokasi bermasalah?" onPress={() => setHelp(true)} />
          </View>
        </View>
      ) : step === "camera" ? (
        <View style={styles.cameraWrap}>
          {cameraPermission?.granted ? (
            <CameraView ref={camera} style={StyleSheet.absoluteFill} facing={facing} mirror />
          ) : (
            <View style={[StyleSheet.absoluteFill, styles.cameraFallback]} />
          )}
          <View style={styles.cameraShade} />
          <View style={styles.cameraGuide}>
            <Text style={styles.cameraCopy}>
              Posisikan wajah di dalam bingkai dan pastikan pencahayaan cukup.
            </Text>
            <Pressable
              accessibilityLabel="Balik kamera"
              accessibilityRole="button"
              onPress={() => setFacing((now) => (now === "front" ? "back" : "front"))}
              style={styles.flip}
            >
              <Icon name="camera-reverse-outline" color="#fff" />
            </Pressable>
          </View>
          <View style={styles.faceFrame}>
            <View style={styles.cornerOne} />
            <View style={styles.cornerTwo} />
          </View>
          <View style={styles.shutterWrap}>
            <Pressable
              accessibilityLabel="Ambil foto"
              onPress={() => void takePhoto()}
              style={styles.shutter}
            >
              <View style={styles.shutterInner} />
            </Pressable>
            <Text style={styles.shutterLabel}>Ambil foto</Text>
          </View>
        </View>
      ) : (
        <View style={styles.content}>
          <ScreenIntro
            title="Periksa fotomu"
            copy="Pastikan wajah terlihat jelas sebelum bukti presensi dikirim."
          />
          <Surface style={styles.preview}>
            {photo ? (
              <Image source={{ uri: photo }} style={StyleSheet.absoluteFill} resizeMode="cover" />
            ) : (
              <View style={styles.previewFallback}>
                <View style={styles.previewFace} />
              </View>
            )}
          </Surface>
          <View style={styles.meta}>
            <View style={styles.metaItem}>
              <Icon name="location" size={13} color={colors.successInk} />
              <Text style={styles.metaText}>Lokasi valid · {Math.round(distance ?? 0)} m</Text>
            </View>
            <Text style={styles.metaText}>Waktu server</Text>
          </View>
          {warning ? (
            <View style={styles.warningWrap}>
              <InlineFeedback tone="error" text={warning} />
            </View>
          ) : null}
          <View style={styles.buttonRow}>
            <View style={{ flex: 1 }}>
              <Button variant="secondary" label="Foto ulang" onPress={() => setStep("camera")} />
            </View>
            <View style={{ flex: 1.5 }}>
              <Button
                label={
                  retry === "upload"
                    ? "Unggah ulang foto"
                    : retry === "request"
                      ? "Coba kirim lagi"
                      : "Gunakan foto"
                }
                loading={submitting}
                disabled={!photo || !location}
                onPress={() =>
                  retry === "upload" ? setStep("camera") : void submit()
                }
              />
            </View>
          </View>
        </View>
      )}
      <Sheet
        visible={help}
        onClose={() => setHelp(false)}
        title="Kendala lokasi"
        copy="Pilih kondisi untuk melihat cara Presensia menanganinya."
      >
        <Problem
          icon="navigate-outline"
          title="Di luar radius"
          copy="Dekati titik kantor sampai jarakmu masuk radius"
          onPress={() => {
            setIssue("outside");
            setLocationReady(false);
            setStep("location");
            setHelp(false);
          }}
        />
        <Problem
          icon="locate-outline"
          title="GPS tidak akurat"
          copy="Pindah ke area terbuka lalu ambil lokasi ulang"
          onPress={() => {
            setIssue("accuracy");
            setLocationReady(false);
            setStep("location");
            setHelp(false);
          }}
        />
        <Problem
          icon="lock-closed-outline"
          title="Izin lokasi ditolak"
          copy="Aktifkan akses lokasi di pengaturan perangkat"
          onPress={() => {
            setIssue("denied");
            setLocationReady(false);
            setStep("location");
            setHelp(false);
          }}
        />
      </Sheet>
    </Screen>
  );
}

function haversine(latitudeA: number, longitudeA: number, latitudeB: number, longitudeB: number) {
  const radians = (value: number) => (value * Math.PI) / 180;
  const latitudeDelta = radians(latitudeB - latitudeA);
  const longitudeDelta = radians(longitudeB - longitudeA);
  const a =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(radians(latitudeA)) * Math.cos(radians(latitudeB)) * Math.sin(longitudeDelta / 2) ** 2;
  return 6371000 * 2 * Math.asin(Math.sqrt(a));
}

function Problem({
  icon,
  title,
  copy,
  onPress,
}: {
  icon: React.ComponentProps<typeof Icon>["name"];
  title: string;
  copy: string;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={styles.problem}>
      <View style={styles.problemIcon}>
        <Icon name={icon} size={17} color={colors.dangerInk} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.problemTitle}>{title}</Text>
        <Text style={styles.problemCopy}>{copy}</Text>
      </View>
      <Icon name="chevron-forward" size={16} color={colors.muted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  help: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  progress: { flexDirection: "row", gap: 6, paddingHorizontal: 18, paddingTop: 10 },
  progressBar: { flex: 1, height: 3, borderRadius: 4, backgroundColor: "#DED8CF" },
  progressActive: { backgroundColor: colors.primary },
  content: { paddingHorizontal: 18, paddingTop: 20, paddingBottom: 28 },
  orbit: {
    position: "relative",
    width: 180,
    height: 180,
    borderRadius: 90,
    marginTop: 16,
    marginBottom: 25,
    alignSelf: "center",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.secondarySoft,
  },
  orbitRingOuter: {
    position: "absolute",
    width: 180,
    height: 180,
    borderRadius: 90,
    borderWidth: 1,
    borderColor: "rgba(85,102,78,0.19)",
    transform: [{ scale: 1 }],
  },
  orbitRing: {
    position: "absolute",
    width: 126,
    height: 126,
    borderRadius: 63,
    borderWidth: 1,
    borderColor: "rgba(85,102,78,0.19)",
  },
  pin: {
    width: 58,
    height: 58,
    borderRadius: 19,
    backgroundColor: colors.secondary,
    alignItems: "center",
    justifyContent: "center",
  },
  locationCheck: {
    padding: 13,
    borderRadius: 13,
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    backgroundColor: colors.successSoft,
  },
  locationCheckError: { backgroundColor: colors.dangerSoft },
  locationCheckBusy: { backgroundColor: colors.secondarySoft },
  radarField: {
    position: "absolute",
    width: 180,
    height: 180,
    borderRadius: 90,
    alignItems: "center",
    justifyContent: "center",
  },
  radarWave: {
    position: "absolute",
    width: 180,
    height: 180,
    borderRadius: 90,
    borderWidth: 2,
    borderColor: colors.secondary,
  },
  locationTile: {
    width: 34,
    height: 34,
    borderRadius: 11,
    backgroundColor: "rgba(255,255,255,0.58)",
    alignItems: "center",
    justifyContent: "center",
  },
  locationTileError: { backgroundColor: "rgba(255,255,255,0.58)" },
  locationCheckTitle: { fontFamily: fonts.extrabold, color: colors.successInk, fontSize: 12 },
  locationCheckCopy: {
    marginTop: 2,
    fontFamily: fonts.regular,
    color: colors.successInk,
    fontSize: 11,
    lineHeight: 16,
    opacity: 0.88,
  },
  privacy: { marginTop: 15, flexDirection: "row", alignItems: "flex-start", gap: 8 },
  privacyCopy: {
    flex: 1,
    fontFamily: fonts.regular,
    color: colors.muted,
    fontSize: 11,
    lineHeight: 18,
  },
  stack: { marginTop: 18, gap: 9 },
  bottomPad: { padding: 18 },
  cameraWrap: {
    flex: 1,
    backgroundColor: "#27302B",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 18,
    paddingTop: 24,
    paddingBottom: 22,
    overflow: "hidden",
  },
  cameraFallback: { backgroundColor: "#4E5A52" },
  cameraShade: { ...StyleSheet.absoluteFill, backgroundColor: "rgba(15,20,17,0.24)" },
  cameraGuide: {
    zIndex: 2,
    width: "100%",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  cameraCopy: {
    maxWidth: 230,
    paddingHorizontal: 11,
    paddingVertical: 9,
    borderRadius: 10,
    backgroundColor: "rgba(29,34,31,0.62)",
    fontFamily: fonts.semibold,
    color: "#fff",
    fontSize: 11,
    lineHeight: 16,
  },
  flip: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.25)",
    backgroundColor: "rgba(0,0,0,0.16)",
    alignItems: "center",
    justifyContent: "center",
  },
  faceFrame: {
    zIndex: 2,
    width: 220,
    height: 285,
    borderRadius: 110,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.5)",
    alignItems: "center",
    justifyContent: "center",
  },
  faceInitial: { fontFamily: fonts.extrabold, color: "rgba(255,255,255,0.38)", fontSize: 34 },
  cornerOne: {
    position: "absolute",
    left: -2,
    top: 52,
    width: 35,
    height: 35,
    borderLeftWidth: 3,
    borderTopWidth: 3,
    borderColor: "#fff",
    borderTopLeftRadius: 15,
  },
  cornerTwo: {
    position: "absolute",
    right: -2,
    bottom: 52,
    width: 35,
    height: 35,
    borderRightWidth: 3,
    borderBottomWidth: 3,
    borderColor: "#fff",
    borderBottomRightRadius: 15,
  },
  shutterWrap: { zIndex: 2, alignItems: "center", gap: 9 },
  shutter: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 3,
    borderColor: "#fff",
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  shutterInner: { width: 56, height: 56, borderRadius: 28, backgroundColor: "#fff" },
  shutterLabel: { fontFamily: fonts.bold, color: "#fff", fontSize: 10 },
  preview: {
    minHeight: 430,
    marginTop: 18,
    borderWidth: 0,
    borderRadius: 17,
    backgroundColor: "#303832",
  },
  previewFallback: {
    flex: 1,
    minHeight: 430,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#536158",
  },
  previewFace: {
    width: 150,
    height: 190,
    borderRadius: 75,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.38)",
    alignItems: "center",
    justifyContent: "center",
  },
  meta: { marginTop: 10, flexDirection: "row", justifyContent: "space-between", gap: 10 },
  metaItem: { flexDirection: "row", alignItems: "center", gap: 5 },
  metaText: { fontFamily: fonts.semibold, color: colors.muted, fontSize: 11 },
  warningWrap: { marginTop: 14 },
  buttonRow: { marginTop: 18, flexDirection: "row", gap: 9 },
  problem: {
    minHeight: 57,
    padding: 10,
    borderWidth: 1,
    borderColor: colors.lineSoft,
    borderRadius: 13,
    backgroundColor: colors.surface,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  problemIcon: {
    width: 36,
    height: 36,
    borderRadius: 11,
    backgroundColor: colors.dangerSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  problemTitle: { fontFamily: fonts.bold, color: colors.ink, fontSize: 11 },
  problemCopy: { marginTop: 2, fontFamily: fonts.regular, color: colors.muted, fontSize: 11 },
});
