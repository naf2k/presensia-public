import { useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { errorMessage, formatDate, formatMonthKey, formatTimestamp } from "@/src/format";
import { useAttendanceMonth } from "@/src/queries";
import { useOperationalContext } from "@/src/server-time";
import {
  AppBar,
  EmptyState,
  Icon,
  PageState,
  Screen,
  ScreenIntro,
  StatusPill,
} from "@/src/ui";
import { colors, fonts } from "@/src/theme";

const labels = ["Hadir", "Terlambat", "Izin", "Kehadiran"];

function monthOptions(base: Date) {
  return Array.from({ length: 6 }, (_, index) => {
    const date = new Date(base.getFullYear(), base.getMonth() - index, 1);
    return {
      key: formatMonthKey(date),
      label: new Intl.DateTimeFormat("id-ID", { month: "long", year: "numeric" }).format(date),
    };
  });
}

export default function RiwayatScreen() {
  const router = useRouter();
  const clock = useOperationalContext();
  const months = monthOptions(
    clock.data ? new Date(clock.data.serverNow) : new Date(),
  );
  const [month, setMonth] = useState(months[0]?.key ?? formatMonthKey());
  const [picker, setPicker] = useState(false);
  const query = useAttendanceMonth(month);
  const records = query.data ?? [];
  const present = records.filter((record) => record.status === "HADIR").length;
  const late = records.filter((record) => record.status === "TERLAMBAT").length;
  const leave = records.filter(
    (record) => record.status === "IZIN" || record.status === "SAKIT",
  ).length;
  const attended = present + late;
  const summary = [
    present,
    late,
    leave,
    records.length ? `${Math.round((attended / records.length) * 100)}%` : "0%",
  ];
  const monthLabel = months.find((item) => item.key === month)?.label ?? month;
  const action = (
    <Pressable
      accessibilityLabel="Izin dan sakit"
      onPress={() => router.push("/izin")}
      style={styles.headerAction}
    >
      <Icon name="reader-outline" />
    </Pressable>
  );
  const appBar = <AppBar title="Riwayat" subtitle="Data kehadiranmu" action={action} />;
  if (query.isPending)
    return (
      <Screen tone="app" appBar={appBar}>
        <PageState loading title="Menyiapkan riwayat" copy="Memuat catatan kehadiran terbaru." />
      </Screen>
    );
  if (query.isError)
    return (
      <Screen tone="app" appBar={appBar}>
        <PageState
          title="Riwayat belum dapat dimuat"
          copy={errorMessage(query.error)}
          action={() => void query.refetch()}
        />
      </Screen>
    );
  return (
    <Screen
      tone="app"
      padded={false}
      appBar={appBar}
      refreshing={query.isRefetching}
      onRefresh={() => {
        void clock.refetch();
        void query.refetch();
      }}
    >
      <View style={styles.content}>
        <ScreenIntro
          title={monthLabel}
          copy="Catatan terbaru ditampilkan lebih dulu. Ketuk tanggal untuk membuka bukti dan detail lokasi."
        />
        <View style={styles.toolbar}>
          <Pressable onPress={() => setPicker((value) => !value)} style={styles.select}>
            <Text style={styles.selectText}>{monthLabel}</Text>
            <Icon name="chevron-down" size={16} color={colors.muted} />
          </Pressable>
          <Pressable
            accessibilityLabel="Buat pengajuan"
            onPress={() => router.push("/izin/baru")}
            style={styles.add}
          >
            <Icon name="add" color={colors.ink} />
          </Pressable>
        </View>
        {picker ? (
          <View style={styles.picker}>
            {months.map((item) => (
              <Pressable
                key={item.key}
                onPress={() => {
                  setMonth(item.key);
                  setPicker(false);
                }}
                style={styles.pickerRow}
              >
                <Text
                  style={[styles.pickerText, item.key === month && { color: colors.primaryInk }]}
                >
                  {item.label}
                </Text>
                {item.key === month ? (
                  <Icon name="checkmark" size={17} color={colors.primary} />
                ) : null}
              </Pressable>
            ))}
          </View>
        ) : null}
        <View style={styles.summaryCard}>
          {summary.map((value, index) => (
            <View
              key={labels[index]}
              style={[styles.summaryCell, index > 0 && styles.summaryCellBorder]}
            >
              <Text style={styles.summaryValue}>{value}</Text>
              <Text style={styles.summaryLabel}>{labels[index]}</Text>
            </View>
          ))}
        </View>
        {records.length ? (
          <View style={styles.list}>
            {records.map((record, index) => {
              const date = formatDate(record.attendance_date, {
                day: "2-digit",
                month: "short",
              }).split(" ");
              const label =
                record.status === "HADIR"
                  ? "Hadir"
                  : record.status === "TERLAMBAT"
                    ? "Terlambat"
                    : record.status === "IZIN"
                      ? "Izin"
                      : record.status === "SAKIT"
                        ? "Sakit"
                        : "Tidak hadir";
              return (
                <Pressable
                  key={record.id}
                  onPress={() =>
                    record.source === "LEAVE"
                      ? router.push("/izin")
                      : router.push(`/riwayat/${record.id}`)
                  }
                  style={[styles.item, index === records.length - 1 && { borderBottomWidth: 0 }]}
                >
                  <View style={styles.dateBox}>
                    <Text style={styles.dateNumber}>{date[0]}</Text>
                    <Text style={styles.dateMonth}>{date[1]}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.day}>
                      {formatDate(record.attendance_date, { weekday: "long" })}
                    </Text>
                    <Text style={styles.detail} numberOfLines={1}>
                      {record.check_in_at
                        ? record.check_out_at
                          ? `Masuk ${formatTimestamp(record.check_in_at)} · Pulang ${formatTimestamp(record.check_out_at)}`
                          : `Masuk ${formatTimestamp(record.check_in_at)}`
                        : "Berdasarkan pengajuan yang disetujui"}
                    </Text>
                  </View>
                  <View style={styles.itemSide}>
                    <StatusPill
                      tone={
                        record.status === "HADIR"
                          ? "success"
                          : record.status === "TERLAMBAT"
                            ? "warning"
                            : "primary"
                      }
                    >
                      {label}
                    </StatusPill>
                    <Icon name="chevron-forward" size={15} color={colors.muted} />
                  </View>
                </Pressable>
              );
            })}
          </View>
        ) : (
          <EmptyState
            icon="calendar-outline"
            title="Belum ada riwayat"
            copy="Tidak ada catatan kehadiran pada bulan yang dipilih."
          />
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  headerAction: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  content: { paddingHorizontal: 18, paddingTop: 20, paddingBottom: 28 },
  toolbar: { marginTop: 16, flexDirection: "row", gap: 8 },
  select: {
    flex: 1,
    minHeight: 49,
    paddingHorizontal: 13,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 12,
    backgroundColor: colors.surface,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  selectText: { fontFamily: fonts.bold, color: colors.ink, fontSize: 12 },
  add: {
    width: 49,
    height: 49,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  picker: {
    marginTop: 6,
    borderWidth: 1,
    borderColor: colors.lineSoft,
    borderRadius: 13,
    backgroundColor: colors.surface,
    overflow: "hidden",
  },
  pickerRow: {
    minHeight: 45,
    paddingHorizontal: 13,
    borderBottomWidth: 1,
    borderBottomColor: colors.lineSoft,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  pickerText: { fontFamily: fonts.semibold, color: colors.ink, fontSize: 11 },
  summaryCard: {
    marginTop: 16,
    marginBottom: 18,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: colors.lineSoft,
    borderRadius: 16,
    backgroundColor: colors.surface,
    flexDirection: "row",
  },
  summaryCell: { flex: 1, flexBasis: 0, alignItems: "center", paddingHorizontal: 4 },
  summaryCellBorder: { borderLeftWidth: 1, borderLeftColor: colors.lineSoft },
  summaryValue: {
    fontFamily: fonts.extrabold,
    color: colors.ink,
    fontSize: 22,
    letterSpacing: -0.5,
    fontVariant: ["tabular-nums"],
  },
  summaryLabel: {
    marginTop: 3,
    fontFamily: fonts.semibold,
    color: colors.muted,
    fontSize: 11,
    textAlign: "center",
  },
  list: {
    borderWidth: 1,
    borderColor: colors.lineSoft,
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: colors.surface,
  },
  item: {
    minHeight: 82,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.lineSoft,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  dateBox: {
    width: 45,
    height: 52,
    borderRadius: 12,
    backgroundColor: colors.surface2,
    alignItems: "center",
    justifyContent: "center",
  },
  dateNumber: { fontFamily: fonts.extrabold, color: colors.ink, fontSize: 16, lineHeight: 18 },
  dateMonth: {
    marginTop: 3,
    fontFamily: fonts.extrabold,
    color: colors.muted,
    fontSize: 11,
    textTransform: "uppercase",
  },
  day: { fontFamily: fonts.extrabold, color: colors.ink, fontSize: 12 },
  detail: {
    marginTop: 3,
    fontFamily: fonts.regular,
    color: colors.muted,
    fontSize: 11,
    lineHeight: 16,
  },
  itemSide: { alignItems: "flex-end", gap: 7 },
  empty: {
    minHeight: 250,
    padding: 30,
    borderWidth: 1,
    borderColor: colors.lineSoft,
    borderRadius: 16,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyIcon: {
    width: 52,
    height: 52,
    borderRadius: 17,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyTitle: { marginTop: 13, fontFamily: fonts.extrabold, color: colors.ink, fontSize: 15 },
  emptyCopy: {
    marginTop: 5,
    textAlign: "center",
    fontFamily: fonts.regular,
    color: colors.muted,
    fontSize: 10,
    lineHeight: 16,
  },
});
