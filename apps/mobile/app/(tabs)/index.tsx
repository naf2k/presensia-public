import { useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import {
  errorMessage,
  formatDate,
  formatMonthKey,
  formatTimestamp,
  initials,
  workdayLabel,
} from "@/src/format";
import { useAttendanceMonth, useToday } from "@/src/queries";
import { useServerNow } from "@/src/server-time";
import { BrandMark, Icon, PageState, Screen, SectionHead, typography } from "@/src/ui";
import { cardShadow, colors, fonts } from "@/src/theme";

export default function BerandaScreen() {
  const router = useRouter();
  const today = useToday();
  const serverClock = useServerNow(15_000);
  const month = useAttendanceMonth(today.data?.date.slice(0, 7) ?? formatMonthKey());
  if (today.isPending)
    return (
      <Screen>
        <PageState loading title="Menyiapkan beranda" copy="Memuat status kehadiran terbaru." />
      </Screen>
    );
  if (today.isError)
    return (
      <Screen>
        <PageState
          title="Beranda belum dapat dimuat"
          copy={errorMessage(today.error)}
          actionLabel="Coba lagi"
          action={() => void today.refetch()}
        />
      </Screen>
    );
  const { context, attendance, journal, date } = today.data;
  const { profile, internship, settings } = context;
  // Label jam jujur: live untuk jam berjalan, Tercatat untuk arsip.
  const liveClock = formatTimestamp(serverClock.toISOString());
  const isoDay = new Date(`${date}T12:00:00+07:00`).getUTCDay() || 7;
  if (!internship || date < internship.start_date)
    return (
      <Screen>
        <Header name={profile.full_name} />
        <Greeting date={date} name={profile.full_name} />
        <PageState
          icon="time-outline"
          title="Programmu belum dimulai"
          copy={`Presensi akan tersedia pada ${internship ? formatDate(internship.start_date) : "periode yang ditentukan admin"}.`}
        />
      </Screen>
    );
  if (!profile.is_active || !internship.is_active || date > internship.end_date)
    return (
      <Screen>
        <Header name={profile.full_name} />
        <Greeting date={date} name={profile.full_name} />
        <PageState
          icon="flag-outline"
          title="Periode program telah selesai"
          copy="Presensi baru ditutup, tetapi riwayat kehadiranmu tetap dapat dibuka."
        />
      </Screen>
    );
  const isWorkDay = settings.work_days.includes(isoDay);
  const isLeave = attendance?.status === "IZIN" || attendance?.status === "SAKIT";
  const state = !isWorkDay
    ? "closed"
    : isLeave
      ? "leave"
      : attendance?.check_out_at
        ? "checked-out"
        : attendance?.check_in_at
          ? "checked-in"
          : "ready";
  const cutoff = addMinutes(settings.check_in_time.slice(0, 5), settings.late_tolerance_minutes);
  const current =
    state === "ready"
      ? {
          badge: "Belum presensi",
          time: liveClock,
          timeLabel: "Waktu server",
          liveLine: null,
          note: `Presensi masuk dibuka hingga ${cutoff}`,
          location: "Lokasi siap digunakan",
          locationNote: `${settings.location_name} · radius ${settings.radius_meters} m`,
          action: "Absen Masuk",
          actionNote: "Selfie dan verifikasi lokasi",
          href: "/check-in",
          icon: "camera-outline" as const,
        }
      : state === "checked-in"
        ? {
            badge: "Sudah check-in",
            time: formatTimestamp(attendance?.check_in_at ?? null),
            timeLabel: "Jam masuk tercatat",
            liveLine: `Sekarang ${liveClock} WIB`,
            note: `Status hari ini: ${attendance?.status === "TERLAMBAT" ? "Terlambat" : "Hadir"}`,
            location: "Presensi masuk tercatat",
            locationNote: `${Math.round(attendance?.check_in_distance_m ?? 0)} m dari titik kantor · lokasi valid`,
            action: "Absen Pulang",
            actionNote: `Jadwal pulang ${settings.check_out_time.slice(0, 5)} WIB`,
            href: "/check-out",
            icon: "log-out-outline" as const,
          }
        : state === "checked-out"
          ? {
              badge: "Presensi selesai",
              time: formatTimestamp(attendance?.check_out_at ?? null),
              timeLabel: "Jam pulang tercatat",
              liveLine: null,
              note: "Kehadiran hari ini tercatat lengkap",
              location: "Sampai jumpa besok",
              locationNote: `Masuk ${formatTimestamp(attendance?.check_in_at ?? null)} · pulang ${formatTimestamp(attendance?.check_out_at ?? null)} WIB`,
              action: "Lihat Detail",
              actionNote: "Bukti dan aktivitas hari ini",
              href: `/riwayat/${attendance?.id}`,
              icon: "document-text-outline" as const,
            }
          : state === "leave"
            ? {
            badge: attendance?.status === "SAKIT" ? "Sakit disetujui" : "Izin disetujui",
            time: liveClock,
            timeLabel: "Waktu server",
            liveLine: null,
                note: "Kamu tidak perlu melakukan presensi hari ini.",
                location: "Pengajuan telah disetujui",
                locationNote: formatDate(date),
                action: "Lihat Pengajuan",
                actionNote: "Buka riwayat izin dan sakit",
                href: "/izin",
                icon: "reader-outline" as const,
              }
            : {
            badge: "Bukan hari kerja",
            time: liveClock,
            timeLabel: "Waktu server",
            liveLine: null,
                note: "Tidak ada jadwal presensi hari ini.",
                location: "Presensi sedang ditutup",
                locationNote: `Hari kerja: ${workdayLabel(settings.work_days)}`,
                action: "Lihat Riwayat",
                actionNote: "Periksa presensi sebelumnya",
                href: "/riwayat",
                icon: "calendar-outline" as const,
              };
  const referenceDate = new Date(`${date}T12:00:00+07:00`);
  const monday = new Date(referenceDate);
  monday.setUTCDate(referenceDate.getUTCDate() - ((referenceDate.getUTCDay() || 7) - 1));
  const sortedWorkDays = [...settings.work_days].sort((a, b) => a - b);
  const weekSpan = Math.max(
    0,
    (sortedWorkDays[sortedWorkDays.length - 1] ?? 5) - (sortedWorkDays[0] ?? 1),
  );
  const weekEnd = new Date(monday);
  weekEnd.setUTCDate(monday.getUTCDate() + weekSpan);
  const mondayIso = monday.toISOString().slice(0, 10);
  const weekEndIso = weekEnd.toISOString().slice(0, 10);
  const weekRecords = (month.data ?? []).filter(
    (item) => item.attendance_date >= mondayIso && item.attendance_date <= weekEndIso,
  );
  const currentStep = !attendance?.check_in_at
    ? 0
    : !journal
      ? 1
      : !attendance?.check_out_at
        ? 2
        : -1;
  const weekRangeLabel = `${monday.getUTCDate()}–${weekEnd.getUTCDate()} ${new Intl.DateTimeFormat("id-ID", { month: "long" }).format(monday)}`;
  const dayIndex = Math.min(
    weekSpan,
    Math.max(0, (new Date(`${date}T12:00:00+07:00`).getUTCDay() || 7) - 1),
  );
  const remainingDays = Math.max(0, weekSpan - dayIndex);
  const programDaysLeft = Math.max(
    0,
    Math.ceil(
      (new Date(`${internship.end_date}T00:00:00+07:00`).getTime() -
        new Date(`${date}T00:00:00+07:00`).getTime()) /
        86_400_000,
    ),
  );

  return (
    <Screen>
      <Header name={profile.full_name} />
      <Greeting date={date} name={profile.full_name} />
      <View style={styles.checkCard}>
        <View style={styles.cardRing} />
        <View style={styles.cardTop}>
          <View style={styles.pending}>
            <View style={styles.pulseHalo}>
              <View style={styles.pulse} />
            </View>
            <Text style={styles.pendingText}>{current.badge}</Text>
          </View>
          <View style={styles.server}>
            <Icon name="cloud-done-outline" size={13} color="#C8C0BA" />
            <Text style={styles.serverText}>{current.timeLabel}</Text>
          </View>
        </View>
        <View style={styles.clock}>
          <Text style={styles.time}>{current.time.split(" ")[0]}</Text>
          <Text style={styles.zone}>WIB</Text>
        </View>
        {current.liveLine ? (
          <View style={styles.liveRow}>
            <View style={styles.liveDot} />
            <Text style={styles.liveText}>{current.liveLine}</Text>
          </View>
        ) : null}
        <Text style={styles.cardNote}>{current.note}</Text>
        <View style={styles.location}>
          <View style={styles.locationIcon}>
            <Icon
              name={state === "closed" ? "lock-closed-outline" : "location-outline"}
              size={18}
              color="#C7DBCB"
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.locationTitle}>{current.location}</Text>
            <Text style={styles.locationCopy}>{current.locationNote}</Text>
          </View>
          <View style={styles.check}>
            <Icon name="checkmark" size={14} color="#fff" />
          </View>
        </View>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push(current.href as never)}
          style={styles.mainAction}
        >
          <View style={styles.actionIcon}>
            <Icon name={current.icon} color="#fff" size={20} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.actionTitle}>{current.action}</Text>
            <Text style={styles.actionCopy} numberOfLines={1}>
              {current.actionNote}
            </Text>
          </View>
          <Icon name="chevron-forward" color="#fff" size={18} />
        </Pressable>
        <View style={styles.privacy}>
          <Icon name="lock-closed-outline" size={11} color="#C7BFB9" />
          <Text style={styles.privacyText}>
            Foto dan lokasi hanya digunakan saat proses presensi.
          </Text>
        </View>
      </View>

      <SectionHead title="Akses cepat" />
      <View style={styles.quickGrid}>
        <Quick
          icon="book-outline"
          title="Isi jurnal"
          copy="Catat kegiatan hari ini"
          tone="primary"
          onPress={() => router.push("/jurnal")}
        />
        <Quick
          icon="reader-outline"
          title="Ajukan izin"
          copy="Izin atau sakit"
          tone="secondary"
          onPress={() => router.push("/izin/baru")}
        />
      </View>

      <View style={styles.timeline}>
        <View style={styles.timelineHead}>
          <View>
            <Text style={styles.timelineHeadTitle}>Aktivitas hari ini</Text>
            <Text style={styles.timelineHeadSub}>Jadwal reguler</Text>
          </View>
        </View>
        <Timeline
          icon="log-in-outline"
          title="Presensi masuk"
          copy={`${settings.check_in_time.slice(0, 5)} · toleransi ${settings.late_tolerance_minutes} menit`}
          state={attendance?.check_in_at ? formatTimestamp(attendance.check_in_at) : "Menunggu"}
          active={currentStep === 0}
        />
        <Timeline
          icon="book-outline"
          title="Jurnal kegiatan"
          copy="Opsional · dapat diisi kapan saja"
          state={journal ? "Sudah diisi" : "Belum diisi"}
          active={currentStep === 1}
        />
        <Timeline
          icon="log-out-outline"
          title="Presensi pulang"
          copy={`Mulai pukul ${settings.check_out_time.slice(0, 5)} WIB`}
          state={
            attendance?.check_out_at
              ? formatTimestamp(attendance.check_out_at)
              : attendance?.check_in_at
                ? "Tersedia"
                : "Terkunci"
          }
          active={currentStep === 2}
          last
        />
      </View>

      <View style={styles.weekCard}>
        <View style={styles.weekHead}>
          <View>
            <Text style={styles.weekTitle}>Minggu ini</Text>
            <Text style={styles.weekRange}>{weekRangeLabel}</Text>
          </View>
          <Pressable onPress={() => router.push("/riwayat")}>
            <Text style={styles.textLink}>Lihat riwayat</Text>
          </Pressable>
        </View>
        <View style={styles.days}>
          {sortedWorkDays.map((workDay) => {
            const currentDate = new Date(monday);
            currentDate.setUTCDate(monday.getUTCDate() + (workDay - 1));
            const iso = currentDate.toISOString().slice(0, 10);
            const record = weekRecords.find((item) => item.attendance_date === iso);
            const names = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];
            const isToday = iso === date;
            const isFuture = iso > date;
            return (
              <View key={iso} style={styles.day}>
                <Text style={styles.dayName}>{names[workDay % 7]}</Text>
                <View
                  style={[
                    styles.dayCircle,
                    record && styles.dayDone,
                    isToday && !record && styles.dayToday,
                  ]}
                >
                  {record ? (
                    <Icon name="checkmark" size={14} color="#fff" />
                  ) : (
                    <Text style={[styles.dayValue, isToday && { color: "#fff" }]}>
                      {currentDate.getUTCDate()}
                    </Text>
                  )}
                </View>
                <Text style={[styles.dayCaption, isToday && styles.todayText]}>
                  {record
                    ? record.check_in_at
                      ? formatTimestamp(record.check_in_at)
                      : "—"
                    : isToday
                      ? "Hari ini"
                      : isFuture
                        ? "—"
                        : "—"}
                </Text>
              </View>
            );
          })}
        </View>
        <View style={styles.weekSummary}>
          <SummaryDot
            color={colors.success}
            value={weekRecords.filter((item) => item.status === "HADIR").length}
            label="hadir"
          />
          <SummaryDot
            color="#D58A32"
            value={weekRecords.filter((item) => item.status === "TERLAMBAT").length}
            label="terlambat"
          />
          <SummaryDot value={remainingDays} label="hari tersisa" />
        </View>
      </View>
      <View style={styles.program}>
        <View style={styles.programIcon}>
          <Icon name="calendar-outline" size={16} color={colors.secondaryDeep} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.programTitle}>Program magangmu aktif</Text>
          <Text style={styles.programCopy}>
            {programDaysLeft} hari lagi · berakhir {formatDate(internship.end_date)}
          </Text>
        </View>
        <Icon name="chevron-forward" size={14} color={colors.secondaryDeep} />
      </View>
    </Screen>
  );
}

function addMinutes(time: string, minutes: number) {
  const [hour, minute] = time.split(":").map(Number);
  const total = (hour ?? 0) * 60 + (minute ?? 0) + minutes;
  const normalized = ((total % 1440) + 1440) % 1440;
  return `${String(Math.floor(normalized / 60)).padStart(2, "0")}:${String(normalized % 60).padStart(2, "0")}`;
}

function Header({ name }: { name: string }) {
  const router = useRouter();
  return (
    <View style={styles.header}>
      <BrandMark />
      <Pressable
        accessibilityLabel="Buka profil"
        accessibilityRole="button"
        onPress={() => router.push("/profil")}
        style={styles.avatar}
      >
        <Text style={styles.avatarText}>{initials(name)}</Text>
        <View style={styles.avatarDot} />
      </Pressable>
    </View>
  );
}
function Greeting({ date, name }: { date: string; name: string }) {
  return (
    <View style={styles.greeting}>
      <Text style={styles.date}>
        {formatDate(date, { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
      </Text>
      <Text style={typography.h1}>Selamat datang, {name.split(" ")[0]}.</Text>
      <Text style={typography.muted}>Siap memulai aktivitas hari ini?</Text>
    </View>
  );
}
function Quick({
  icon,
  title,
  copy,
  tone,
  onPress,
}: {
  icon: React.ComponentProps<typeof Icon>["name"];
  title: string;
  copy: string;
  tone: "primary" | "secondary";
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={styles.quick}>
      <View
        style={[
          styles.quickIcon,
          { backgroundColor: tone === "primary" ? colors.primarySoft : colors.successSoft },
        ]}
      >
        <Icon
          name={icon}
          size={18}
          color={tone === "primary" ? colors.primaryInk : colors.successInk}
        />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.quickTitle}>{title}</Text>
        <Text style={styles.quickCopy} numberOfLines={1}>
          {copy}
        </Text>
      </View>
    </Pressable>
  );
}
function Timeline({
  icon,
  title,
  copy,
  state,
  active,
  last,
}: {
  icon: React.ComponentProps<typeof Icon>["name"];
  title: string;
  copy: string;
  state: string;
  active?: boolean;
  last?: boolean;
}) {
  return (
    <View style={[styles.timelineRow, last && { borderBottomWidth: 0 }]}>
      <View style={styles.timelineMark}>
        {!last ? <View style={styles.timelineLine} /> : null}
        <View style={[styles.timelineDot, active && styles.timelineDotActive]}>
          <Icon name={icon} size={15} color={active ? colors.primaryInk : "#8D877F"} />
        </View>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.timelineTitle}>{title}</Text>
        <Text style={styles.timelineCopy}>{copy}</Text>
      </View>
      <Text style={[styles.timelineState, active && { color: colors.primaryInk }]}>{state}</Text>
    </View>
  );
}
function SummaryDot({ color, value, label }: { color?: string; value: number; label: string }) {
  return (
    <View style={styles.summaryItem}>
      <View
        style={[styles.summaryDot, color ? { backgroundColor: color, borderWidth: 0 } : null]}
      />
      <Text style={styles.summaryText}>
        <Text style={styles.summaryValue}>{value}</Text> {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    height: 62,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 13,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { fontFamily: fonts.extrabold, color: colors.primaryInk, fontSize: 11 },
  avatarDot: {
    position: "absolute",
    right: -1,
    bottom: -1,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.success,
    borderWidth: 2,
    borderColor: colors.background,
  },
  greeting: { marginHorizontal: 2, marginTop: 8, marginBottom: 20 },
  date: {
    fontFamily: fonts.extrabold,
    color: colors.primaryInk,
    fontSize: 11,
    letterSpacing: 0.5,
    textTransform: "uppercase",
    marginBottom: 6,
  },
  checkCard: {
    position: "relative",
    padding: 17,
    borderRadius: 20,
    backgroundColor: colors.dark,
    overflow: "hidden",
    ...cardShadow,
  },
  cardRing: {
    position: "absolute",
    top: -65,
    right: -55,
    width: 180,
    height: 180,
    borderRadius: 90,
    borderWidth: 34,
    borderColor: "rgba(184,92,66,0.2)",
  },
  cardTop: { flexDirection: "row", justifyContent: "space-between", gap: 10 },
  pending: { flexDirection: "row", alignItems: "center", gap: 7 },
  pulseHalo: {
    width: 15,
    height: 15,
    borderRadius: 8,
    backgroundColor: "rgba(218,146,123,0.13)",
    alignItems: "center",
    justifyContent: "center",
  },
  pulse: { width: 7, height: 7, borderRadius: 4, backgroundColor: "#DA927B" },
  pendingText: { fontFamily: fonts.extrabold, color: "#F7E3DC", fontSize: 12 },
  server: { flexDirection: "row", gap: 5, alignItems: "center" },
  serverText: { fontFamily: fonts.semibold, color: "#C8C0BA", fontSize: 11 },
  clock: { flexDirection: "row", alignItems: "baseline", gap: 6, marginTop: 18 },
  time: {
    fontFamily: fonts.extrabold,
    color: "#fff",
    fontSize: 45,
    lineHeight: 45,
    letterSpacing: -1.8,
    fontVariant: ["tabular-nums"],
  },
  zone: { fontFamily: fonts.extrabold, color: "#D2CBC6", fontSize: 11 },
  liveRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 8 },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#8BC34A" },
  liveText: { fontFamily: fonts.semibold, color: "#C8C0BA", fontSize: 12 },
  cardNote: {
    marginTop: 6,
    marginBottom: 16,
    fontFamily: fonts.regular,
    color: "#D2CBC6",
    fontSize: 12,
    lineHeight: 18,
  },
  location: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    padding: 10,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.07)",
    backgroundColor: "rgba(255,255,255,0.055)",
  },
  locationIcon: {
    width: 31,
    height: 31,
    borderRadius: 9,
    backgroundColor: "rgba(116,134,106,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  locationTitle: { fontFamily: fonts.bold, color: "#F2EEEA", fontSize: 12 },
  locationCopy: { marginTop: 2, fontFamily: fonts.regular, color: "#C7BFB9", fontSize: 11 },
  check: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.success,
    alignItems: "center",
    justifyContent: "center",
  },
  mainAction: {
    minHeight: 62,
    marginTop: 13,
    padding: 8,
    borderRadius: 14,
    backgroundColor: colors.primary,
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
  },
  actionIcon: {
    width: 43,
    height: 43,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.14)",
    justifyContent: "center",
    alignItems: "center",
  },
  actionTitle: { fontFamily: fonts.extrabold, color: "#fff", fontSize: 13 },
  actionCopy: { marginTop: 2, fontFamily: fonts.medium, color: "#fff", fontSize: 11 },
  privacy: {
    marginTop: 10,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 5,
  },
  privacyText: { fontFamily: fonts.regular, color: "#C7BFB9", fontSize: 9.5 },
  quickGrid: { flexDirection: "row", gap: 9 },
  quick: {
    flex: 1,
    minHeight: 82,
    padding: 11,
    borderWidth: 1,
    borderColor: colors.lineSoft,
    borderRadius: 15,
    backgroundColor: colors.surface,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  quickIcon: {
    width: 34,
    height: 34,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  quickTitle: { fontFamily: fonts.extrabold, color: colors.ink, fontSize: 12 },
  quickCopy: {
    marginTop: 2,
    fontFamily: fonts.regular,
    color: colors.muted,
    fontSize: 11,
    lineHeight: 15,
  },
  timeline: {
    marginTop: 23,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.lineSoft,
    borderRadius: 17,
    backgroundColor: colors.surface,
    ...cardShadow,
  },
  timelineHead: { paddingHorizontal: 15, paddingTop: 15, paddingBottom: 10 },
  timelineHeadTitle: {
    fontFamily: fonts.extrabold,
    color: colors.ink,
    fontSize: 14,
    letterSpacing: -0.3,
  },
  timelineHeadSub: { marginTop: 2, fontFamily: fonts.regular, color: colors.muted, fontSize: 11 },
  timelineRow: {
    minHeight: 61,
    paddingHorizontal: 14,
    paddingVertical: 7,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: colors.lineSoft,
  },
  timelineMark: { width: 30, alignSelf: "stretch", alignItems: "center", justifyContent: "center" },
  timelineLine: {
    position: "absolute",
    top: 40,
    bottom: -14,
    width: 1,
    backgroundColor: colors.line,
  },
  timelineDot: {
    width: 30,
    height: 30,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: "#F7F4EF",
    alignItems: "center",
    justifyContent: "center",
  },
  timelineDotActive: {
    borderColor: colors.primarySoft,
    backgroundColor: colors.primarySoft,
  },
  timelineTitle: { fontFamily: fonts.bold, color: colors.ink, fontSize: 12 },
  timelineCopy: { marginTop: 2, fontFamily: fonts.regular, color: colors.muted, fontSize: 11 },
  timelineState: { fontFamily: fonts.bold, color: "#6D6761", fontSize: 11 },
  textLink: { fontFamily: fonts.extrabold, color: colors.primaryInk, fontSize: 11 },
  weekCard: {
    marginTop: 23,
    padding: 15,
    borderWidth: 1,
    borderColor: colors.lineSoft,
    borderRadius: 17,
    backgroundColor: colors.surface,
    ...cardShadow,
  },
  weekHead: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
    marginBottom: 14,
  },
  weekTitle: { fontFamily: fonts.extrabold, color: colors.ink, fontSize: 14, letterSpacing: -0.3 },
  weekRange: { marginTop: 2, fontFamily: fonts.regular, color: colors.muted, fontSize: 11 },
  days: { flexDirection: "row", justifyContent: "space-between" },
  day: { flex: 1, alignItems: "center", minHeight: 67 },
  dayName: { fontFamily: fonts.bold, color: colors.muted, fontSize: 11, marginBottom: 6 },
  dayCircle: {
    width: 34,
    height: 34,
    borderRadius: 11,
    backgroundColor: colors.surface2,
    alignItems: "center",
    justifyContent: "center",
  },
  dayDone: { backgroundColor: colors.success },
  dayToday: { backgroundColor: colors.primary },
  dayValue: { fontFamily: fonts.extrabold, color: "#5F5953", fontSize: 12 },
  dayCaption: { fontFamily: fonts.regular, color: colors.muted, fontSize: 11, marginTop: 5 },
  todayText: { fontFamily: fonts.bold, color: colors.primaryInk },
  weekSummary: {
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.lineSoft,
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 8,
  },
  summaryItem: { flexDirection: "row", alignItems: "center", gap: 5 },
  summaryDot: { width: 6, height: 6, borderRadius: 3, borderWidth: 1, borderColor: "#9F9890" },
  summaryText: { fontFamily: fonts.regular, color: colors.muted, fontSize: 11 },
  summaryValue: { fontFamily: fonts.extrabold, color: colors.ink },
  program: {
    marginTop: 15,
    padding: 12,
    borderRadius: 14,
    backgroundColor: colors.secondarySoft,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  programIcon: {
    width: 31,
    height: 31,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.55)",
    alignItems: "center",
    justifyContent: "center",
  },
  programTitle: { fontFamily: fonts.extrabold, color: colors.secondaryDeep, fontSize: 12 },
  programCopy: { marginTop: 2, fontFamily: fonts.medium, color: "#55624F", fontSize: 11 },
});
