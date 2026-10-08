import { zodResolver } from "@hookform/resolvers/zod";
import DateTimePicker, { type DateTimePickerEvent } from "@react-native-community/datetimepicker";
import * as DocumentPicker from "expo-document-picker";
import { useRouter } from "expo-router";
import { Controller, useForm } from "react-hook-form";
import { useEffect, useRef, useState } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { newOperationId, submitLeave } from "@/src/api";
import { MobileApiError, errorMessage, isoDateInJakarta } from "@/src/format";
import { queryKeys } from "@/src/queries";
import { useOperationalContext } from "@/src/server-time";
import { AppBar, Button, Field, Icon, Screen, ScreenIntro } from "@/src/ui";
import { colors, fonts } from "@/src/theme";

const schema = z
  .object({
    type: z.enum(["Izin", "Sakit"]),
    start: z.string().min(10),
    end: z.string().min(10),
    reason: z.string().trim().min(5, "Lengkapi tanggal dan alasan minimal 5 karakter.").max(500),
  })
  .refine((data) => data.end >= data.start, {
    path: ["end"],
    message: "Tanggal selesai tidak boleh sebelum tanggal mulai.",
  });
type LeaveForm = z.infer<typeof schema>;
type DateTarget = "start" | "end" | null;

function parseIsoDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year || 1970, (month || 1) - 1, day || 1, 12, 0, 0);
}

function toIsoDate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function formatDisplayDate(value: string) {
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(parseIsoDate(value));
}

export default function LeaveCreateScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [file, setFile] = useState<DocumentPicker.DocumentPickerAsset | null>(null);
  const [fileError, setFileError] = useState("");
  const [serverError, setServerError] = useState("");
  const [dateTarget, setDateTarget] = useState<DateTarget>(null);
  const clock = useOperationalContext();
  const today = clock.data?.operationalDate ?? isoDateInJakarta();
  const {
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<LeaveForm>({
    resolver: zodResolver(schema),
    defaultValues: { type: "Izin", start: today, end: today, reason: "" },
  });
  const type = watch("type");
  const reason = watch("reason");
  const startValue = watch("start");
  const endValue = watch("end");
  // One idempotency key per logical request: retries reconcile, edits rotate.
  const operationRef = useRef(newOperationId());
  useEffect(() => {
    operationRef.current = newOperationId();
  }, [type, startValue, endValue]);
  const dateInvalid = Boolean(errors.start || errors.end);
  const mutation = useMutation({
    mutationFn: ({
      values,
      attachment,
    }: {
      values: LeaveForm;
      attachment: DocumentPicker.DocumentPickerAsset | null;
    }) =>
      submitLeave(
        {
          type: values.type === "Izin" ? "IZIN" : "SAKIT",
          startDate: values.start,
          endDate: values.end,
          reason: values.reason,
          operationId: operationRef.current,
        },
        attachment,
      ),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.leaves });
      router.replace("/izin?sent=1");
    },
    onError: (error) => {
      if (
        error instanceof MobileApiError &&
        (error.code === "LEAVE_OVERLAP" || error.code === "ATTENDANCE_ALREADY_EXISTS")
      ) {
        setServerError(errorMessage(error));
      } else {
        setServerError(errorMessage(error));
      }
    },
  });

  async function chooseFile() {
    const result = await DocumentPicker.getDocumentAsync({
      type: ["image/jpeg", "image/png", "application/pdf"],
    });
    if (result.canceled) return;
    const asset = result.assets[0];
    if (!asset || (asset.size ?? 0) > 5 * 1024 * 1024) {
      setFile(null);
      setFileError("Lampiran harus berupa JPG, PNG, atau PDF dengan ukuran maksimal 5 MB.");
      return;
    }
    setFile(asset);
    setFileError("");
    setServerError("");
  }

  function onPickDate(event: DateTimePickerEvent, selected?: Date) {
    if (Platform.OS !== "ios") setDateTarget(null);
    if (event.type === "dismissed" || !selected) return;
    const iso = toIsoDate(selected);
    if (dateTarget === "start") {
      setValue("start", iso < today ? today : iso, { shouldValidate: true });
      if (endValue < iso) setValue("end", iso, { shouldValidate: true });
    } else if (dateTarget === "end") {
      setValue("end", iso < startValue ? startValue : iso, { shouldValidate: true });
    }
    setServerError("");
  }

  const submit = handleSubmit(
    (values) => {
      setServerError("");
      mutation.mutate({ values, attachment: file });
    },
    () => setServerError("Periksa kembali tanggal dan alasan pengajuanmu."),
  );

  return (
    <Screen
      tone="app"
      padded={false}
      appBar={<AppBar title="Pengajuan Baru" subtitle="Izin atau sakit" back />}
    >
      <View style={styles.content}>
        <ScreenIntro
          title="Beritahu pembina lebih awal"
          copy="Pengajuan akan berstatus menunggu sampai admin menyetujui atau menolaknya."
        />
        <View style={styles.form}>
          <View style={styles.field}>
            <Text style={styles.label}>Jenis pengajuan</Text>
            <View style={styles.segment}>
              {(["Izin", "Sakit"] as const).map((item) => (
                <Pressable
                  key={item}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: type === item }}
                  onPress={() => {
                    setValue("type", item);
                    setServerError("");
                  }}
                  style={[styles.segmentItem, type === item && styles.segmentActive]}
                >
                  <Text style={[styles.segmentText, type === item && styles.segmentTextActive]}>
                    {item}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
          <View style={styles.dateRow}>
            <View style={styles.dateField}>
              <Text style={styles.label}>Tanggal mulai</Text>
              <Pressable
                accessibilityLabel="Pilih tanggal mulai"
                accessibilityRole="button"
                onPress={() => setDateTarget("start")}
                style={[styles.dateControl, dateInvalid && styles.dateControlInvalid]}
              >
                <Icon name="calendar-outline" size={17} color={colors.muted} />
                <Text style={styles.dateValue}>{formatDisplayDate(startValue)}</Text>
              </Pressable>
              {errors.start ? <Text style={styles.error}>{errors.start.message}</Text> : null}
            </View>
            <View style={styles.dateField}>
              <Text style={styles.label}>Tanggal selesai</Text>
              <Pressable
                accessibilityLabel="Pilih tanggal selesai"
                accessibilityRole="button"
                onPress={() => setDateTarget("end")}
                style={[styles.dateControl, dateInvalid && styles.dateControlInvalid]}
              >
                <Icon name="calendar-outline" size={17} color={colors.muted} />
                <Text style={styles.dateValue}>{formatDisplayDate(endValue)}</Text>
              </Pressable>
              {errors.end ? <Text style={styles.error}>{errors.end.message}</Text> : null}
            </View>
          </View>
          {dateTarget ? (
            <View style={styles.pickerWrap}>
              <DateTimePicker
                value={parseIsoDate(dateTarget === "start" ? startValue : endValue)}
                mode="date"
                display={Platform.OS === "ios" ? "spinner" : "calendar"}
                minimumDate={parseIsoDate(today)}
                onChange={onPickDate}
              />
              {Platform.OS === "ios" ? (
                <Button
                  variant="quiet"
                  compact
                  label="Selesai memilih tanggal"
                  onPress={() => setDateTarget(null)}
                />
              ) : null}
            </View>
          ) : null}
          <Controller
            control={control}
            name="reason"
            render={({ field: { value, onChange } }) => (
              <View style={styles.field}>
                <View style={styles.labelRow}>
                  <Text style={styles.label}>Alasan</Text>
                  <Text style={styles.counter}>{reason.length}/500</Text>
                </View>
                <Field
                  accessibilityLabel="Alasan"
                  value={value}
                  onChangeText={(text) => {
                    onChange(text);
                    setServerError("");
                  }}
                  multiline
                  maxLength={500}
                  placeholder="Jelaskan alasan izin atau kondisi sakitmu"
                  error={errors.reason?.message}
                />
              </View>
            )}
          />
          <View style={styles.field}>
            <Text style={styles.label}>Lampiran (opsional)</Text>
            <Pressable
              accessibilityLabel="Pilih lampiran"
              accessibilityRole="button"
              onPress={() => void chooseFile()}
              style={[styles.file, fileError ? styles.fileInvalid : file ? styles.fileReady : null]}
            >
              <View style={[styles.fileIcon, file ? styles.fileIconReady : null]}>
                <Icon
                  name="cloud-upload-outline"
                  color={file ? colors.successInk : colors.primaryInk}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.fileTitle} numberOfLines={1}>
                  {file?.name || "Pilih foto atau dokumen"}
                </Text>
                <Text style={styles.fileCopy}>JPG, PNG, atau PDF · maks. 5 MB</Text>
              </View>
            </Pressable>
            {fileError ? <Text style={styles.error}>{fileError}</Text> : null}
          </View>
          {serverError ? <Text style={styles.error}>{serverError}</Text> : null}
          <View style={styles.privacy}>
            <Icon name="lock-closed-outline" size={14} color={colors.muted} />
            <Text style={styles.privacyText}>
              Lampiran hanya dapat dilihat oleh admin yang memproses pengajuanmu.
            </Text>
          </View>
          <Button
            label={serverError ? "Coba kirim lagi" : "Kirim pengajuan"}
            loading={mutation.isPending}
            onPress={() => void submit()}
          />
          <Button variant="quiet" label="Batal" onPress={() => router.replace("/izin")} />
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 18, paddingTop: 20, paddingBottom: 28 },
  form: { marginTop: 22, gap: 16 },
  field: { gap: 7 },
  label: { fontFamily: fonts.bold, color: colors.ink, fontSize: 12 },
  segment: {
    padding: 5,
    borderRadius: 13,
    backgroundColor: colors.surface2,
    flexDirection: "row",
    gap: 6,
  },
  segmentItem: {
    flex: 1,
    minHeight: 42,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  segmentActive: {
    backgroundColor: colors.surface,
    shadowColor: "#46332A",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.07,
    shadowRadius: 10,
    elevation: 2,
  },
  segmentText: { fontFamily: fonts.extrabold, color: colors.muted, fontSize: 12 },
  segmentTextActive: { color: colors.ink },
  dateRow: { flexDirection: "row", gap: 10 },
  dateField: { flex: 1, gap: 7 },
  dateControl: {
    minHeight: 49,
    paddingHorizontal: 13,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 12,
    backgroundColor: colors.surface,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
  },
  dateControlInvalid: { borderColor: colors.dangerInk },
  dateValue: { flex: 1, fontFamily: fonts.semibold, color: colors.ink, fontSize: 13 },
  pickerWrap: {
    padding: 6,
    borderWidth: 1,
    borderColor: colors.lineSoft,
    borderRadius: 13,
    backgroundColor: colors.surface,
  },
  labelRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  counter: { fontFamily: fonts.semibold, color: colors.muted, fontSize: 11 },
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
  fileInvalid: { borderColor: colors.dangerInk, backgroundColor: colors.dangerSoft },
  fileReady: { borderStyle: "solid", borderColor: colors.line },
  fileIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  fileIconReady: { backgroundColor: colors.successSoft },
  fileTitle: { fontFamily: fonts.bold, color: colors.ink, fontSize: 12 },
  fileCopy: { marginTop: 3, fontFamily: fonts.regular, color: colors.muted, fontSize: 11 },
  privacy: { flexDirection: "row", alignItems: "flex-start", gap: 7 },
  privacyText: {
    flex: 1,
    fontFamily: fonts.regular,
    color: colors.muted,
    fontSize: 11,
    lineHeight: 17,
  },
  error: {
    padding: 11,
    borderRadius: 11,
    color: colors.dangerInk,
    backgroundColor: colors.dangerSoft,
    fontFamily: fonts.medium,
    fontSize: 11,
    lineHeight: 17,
  },
});
