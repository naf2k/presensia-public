import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { newOperationId, saveTodayJournal } from "@/src/api";
import {
  errorMessage,
  formatDate,
  formatMonthKey,
  formatTimestamp,
  isoDateInJakarta,
} from "@/src/format";
import { queryKeys, useJournalRevisions, useJournals, useParticipantContext } from "@/src/queries";
import { useOperationalContext } from "@/src/server-time";
import {
  AppBar,
  Button,
  EmptyState,
  Icon,
  InlineFeedback,
  PageState,
  Screen,
  SectionHead,
  StatusPill,
} from "@/src/ui";
import { colors, fonts } from "@/src/theme";

function monthOptions(base: Date) {
  return Array.from({ length: 6 }, (_, index) => {
    const date = new Date(base.getFullYear(), base.getMonth() - index, 1);
    return {
      key: formatMonthKey(date),
      label: new Intl.DateTimeFormat("id-ID", { month: "long", year: "numeric" }).format(date),
    };
  });
}

export default function JurnalScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const context = useParticipantContext();
  const maxJournalLength = context.data?.settings.max_journal_length ?? 500;
  const clock = useOperationalContext();
  const today = clock.data?.operationalDate ?? isoDateInJakarta();
  const [month, setMonth] = useState(() => formatMonthKey());
  const [pickerOpen, setPickerOpen] = useState(false);
  const journals = useJournals(month);
  const todayJournal = journals.data?.find((journal) => journal.journal_date === today);
  const previous = journals.data?.filter((journal) => journal.journal_date !== today) ?? [];
  const revisions = useJournalRevisions(todayJournal?.id);
  const [text, setText] = useState("");
  const [feedback, setFeedback] = useState("");
  const [showRevisions, setShowRevisions] = useState(false);
  const failed = Boolean(feedback) && !feedback.includes("berhasil");
  useEffect(() => {
    if (todayJournal) setText(todayJournal.content);
  }, [todayJournal]);
  const saveMutation = useMutation({
    mutationFn: (content: string) => saveTodayJournal(content, newOperationId()),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["journals"] });
      await queryClient.invalidateQueries({ queryKey: queryKeys.today });
      if (todayJournal?.id)
        await queryClient.invalidateQueries({
          queryKey: queryKeys.journalRevisions(todayJournal.id),
        });
      setFeedback("Jurnal hari ini berhasil disimpan.");
    },
    onError: (error) => setFeedback(errorMessage(error)),
  });
  const months = monthOptions(clock.data ? new Date(clock.data.serverNow) : new Date());
  const monthLabel = months.find((item) => item.key === month)?.label ?? month;
  const isCurrentMonth = month === formatMonthKey();
  const revisionCount = revisions.data?.length ?? 0;
  const appBar = (
    <AppBar
      title="Jurnal"
      subtitle="Catatan kegiatanmu"
      action={
        <Pressable
          accessibilityLabel="Buka riwayat"
          accessibilityRole="button"
          onPress={() => router.push("/riwayat")}
          style={styles.headerAction}
        >
          <Icon name="time-outline" />
        </Pressable>
      }
    />
  );
  if (journals.isPending)
    return (
      <Screen tone="app" padded={false} appBar={appBar}>
        <PageState loading title="Menyiapkan jurnal" copy="Memuat catatan terbaru milikmu." />
      </Screen>
    );
  if (journals.isError)
    return (
      <Screen tone="app" padded={false} appBar={appBar}>
        <PageState
          title="Jurnal belum dapat dimuat"
          copy={errorMessage(journals.error)}
          action={() => void journals.refetch()}
        />
      </Screen>
    );

  return (
    <Screen
      tone="app"
      padded={false}
      appBar={appBar}
      refreshing={journals.isRefetching}
      onRefresh={() => {
        void clock.refetch();
        void journals.refetch();
        void context.refetch();
      }}
    >
      <View style={styles.content}>
        <Pressable
          accessibilityLabel="Pilih periode jurnal"
          accessibilityRole="button"
          onPress={() => setPickerOpen((value) => !value)}
          style={styles.monthSelect}
        >
          <Text style={styles.monthSelectText}>{monthLabel}</Text>
          <Icon name="chevron-down" size={16} color={colors.muted} />
        </Pressable>
        {pickerOpen ? (
          <View style={styles.monthPicker}>
            {months.map((item) => (
              <Pressable
                key={item.key}
                onPress={() => {
                  setMonth(item.key);
                  setPickerOpen(false);
                }}
                style={styles.monthRow}
              >
                <Text
                  style={[styles.monthRowText, item.key === month && { color: colors.primaryInk }]}
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
        <View style={styles.today}>
          <View style={styles.todayHead}>
            <View style={styles.todayHeadCopy}>
              <Text style={styles.todayTitle}>
                {isCurrentMonth ? "Jurnal hari ini" : "Jurnal bulan ini"}
              </Text>
              <Text style={styles.todayDate}>
                {formatDate(today, {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
              </Text>
            </View>
            <StatusPill tone="primary">Opsional</StatusPill>
          </View>
          {!isCurrentMonth ? (
            <View style={styles.emptyToday}>
              <Text style={styles.emptyTodayTitle}>Hanya bulan berjalan yang dapat diedit</Text>
              <Text style={styles.emptyTodayCopy}>
                Pilih bulan berjalan untuk menulis atau memperbarui jurnal hari ini.
              </Text>
            </View>
          ) : (
            <>
              {!todayJournal ? (
                <View style={styles.emptyToday}>
                  <Text style={styles.emptyTodayTitle}>Mulai catatan pertamamu hari ini</Text>
                  <Text style={styles.emptyTodayCopy}>
                    Tulis satu atau dua kalimat tentang kegiatanmu. Jurnal dapat diubah sampai hari
                    berakhir.
                  </Text>
                </View>
              ) : null}
              <TextInput
                accessibilityLabel="Apa yang kamu kerjakan hari ini?"
                value={text}
                onChangeText={(value) => {
                  setText(value);
                  setFeedback("");
                }}
                maxLength={maxJournalLength}
                multiline
                placeholder="Apa yang kamu kerjakan hari ini?"
                placeholderTextColor="#827D76"
                style={styles.textarea}
              />
              <View style={styles.meta}>
                <Text style={styles.metaText}>Masih dapat diedit sampai hari berakhir.</Text>
                <Text style={styles.metaText}>
                  {text.length}/{maxJournalLength}
                </Text>
              </View>
              {feedback ? (
                <View style={styles.feedbackWrap}>
                  <InlineFeedback tone={failed ? "error" : "success"} text={feedback} />
                </View>
              ) : null}
              <View style={styles.saveWrap}>
                <Button
                  label={
                    failed
                      ? "Coba simpan lagi"
                      : todayJournal
                        ? "Simpan perubahan"
                        : "Simpan jurnal"
                  }
                  loading={saveMutation.isPending}
                  onPress={() => {
                    setFeedback("");
                    saveMutation.mutate(text);
                  }}
                />
              </View>
              {revisionCount > 1 ? (
                <Pressable
                  accessibilityRole="button"
                  onPress={() => setShowRevisions((value) => !value)}
                  style={styles.revisionToggle}
                >
                  <Text style={styles.revisionToggleText}>
                    {showRevisions ? "Sembunyikan" : "Lihat"} riwayat revisi ({revisionCount})
                  </Text>
                  <Icon
                    name={showRevisions ? "chevron-up" : "chevron-down"}
                    size={15}
                    color="#C9C1BB"
                  />
                </Pressable>
              ) : null}
              {showRevisions && revisions.data?.length ? (
                <View style={styles.revisionList}>
                  {revisions.data.map((revision) => (
                    <View key={revision.id} style={styles.revisionItem}>
                      <Text style={styles.revisionMeta}>
                        Versi {revision.revision_no} · {formatTimestamp(revision.created_at, true)}
                      </Text>
                      <Text style={styles.revisionCopy}>{revision.content}</Text>
                    </View>
                  ))}
                </View>
              ) : null}
            </>
          )}
        </View>
        <SectionHead
          title="Jurnal sebelumnya"
          subtitle={`Catatan pada ${monthLabel} · hanya-baca`}
        />
        {!previous.length ? (
          <EmptyState
            icon="book-outline"
            title="Belum ada jurnal pada bulan ini"
            copy="Catatan yang sudah lewat akan tampil di bagian ini. Ganti periode untuk melihat bulan lain."
          />
        ) : (
          <View style={styles.list}>
            {previous.map((journal, index) => (
              <View
                key={journal.id}
                style={[styles.entry, index === previous.length - 1 && { borderBottomWidth: 0 }]}
              >
                <View style={styles.entryHead}>
                  <Text style={styles.entryDate}>
                    {formatDate(journal.journal_date, {
                      weekday: "long",
                      day: "numeric",
                      month: "long",
                    })}
                  </Text>
                  <Text style={styles.entryTime}>{formatTimestamp(journal.updated_at, true)}</Text>
                </View>
                <Text style={styles.entryCopy}>{journal.content}</Text>
              </View>
            ))}
          </View>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  headerAction: { width: 44, height: 44, justifyContent: "center", alignItems: "center" },
  content: { paddingHorizontal: 18, paddingTop: 20, paddingBottom: 28 },
  monthSelect: {
    minHeight: 49,
    marginBottom: 12,
    paddingHorizontal: 13,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 12,
    backgroundColor: colors.surface,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  monthSelectText: { fontFamily: fonts.bold, color: colors.ink, fontSize: 12 },
  monthPicker: {
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.lineSoft,
    borderRadius: 13,
    backgroundColor: colors.surface,
    overflow: "hidden",
  },
  monthRow: {
    minHeight: 45,
    paddingHorizontal: 13,
    borderBottomWidth: 1,
    borderBottomColor: colors.lineSoft,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  monthRowText: { fontFamily: fonts.semibold, color: colors.ink, fontSize: 11 },
  today: { padding: 17, borderRadius: 18, backgroundColor: colors.dark },
  todayHead: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
  },
  todayHeadCopy: { flex: 1 },
  todayTitle: { fontFamily: fonts.extrabold, color: "#fff", fontSize: 17 },
  todayDate: { marginTop: 4, fontFamily: fonts.regular, color: "#C9C1BB", fontSize: 11 },
  emptyToday: {
    marginTop: 14,
    padding: 12,
    borderRadius: 12,
    backgroundColor: "rgba(116,134,106,0.2)",
  },
  emptyTodayTitle: { fontFamily: fonts.bold, color: "#DCE8DC", fontSize: 12 },
  emptyTodayCopy: {
    marginTop: 3,
    fontFamily: fonts.regular,
    color: "#C9D5C8",
    fontSize: 11,
    lineHeight: 17,
  },
  textarea: {
    minHeight: 132,
    marginTop: 15,
    padding: 13,
    borderRadius: 12,
    backgroundColor: "#fff",
    color: colors.ink,
    fontFamily: fonts.regular,
    fontSize: 16,
    lineHeight: 24,
    textAlignVertical: "top",
  },
  meta: { marginTop: 10, flexDirection: "row", justifyContent: "space-between", gap: 12 },
  metaText: { fontFamily: fonts.regular, color: "#C9C1BB", fontSize: 11 },
  feedbackWrap: { marginTop: 12 },
  saveWrap: { marginTop: 14 },
  revisionToggle: {
    marginTop: 14,
    minHeight: 36,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  revisionToggleText: { fontFamily: fonts.bold, color: "#C9C1BB", fontSize: 11 },
  revisionList: {
    marginTop: 10,
    padding: 12,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.06)",
    gap: 10,
  },
  revisionItem: { gap: 4 },
  revisionMeta: { fontFamily: fonts.semibold, color: "#C9C1BB", fontSize: 10 },
  revisionCopy: {
    fontFamily: fonts.regular,
    color: "#E8E2DC",
    fontSize: 11,
    lineHeight: 17,
  },
  list: {
    borderWidth: 1,
    borderColor: colors.lineSoft,
    borderRadius: 16,
    backgroundColor: colors.surface,
    overflow: "hidden",
  },
  entry: {
    paddingHorizontal: 16,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: colors.lineSoft,
  },
  entryHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  entryDate: { fontFamily: fonts.extrabold, color: colors.ink, fontSize: 12 },
  entryTime: { fontFamily: fonts.regular, color: colors.muted, fontSize: 11 },
  entryCopy: {
    marginTop: 8,
    fontFamily: fonts.regular,
    color: colors.muted,
    fontSize: 11,
    lineHeight: 18,
  },
});
