import { zodResolver } from "@hookform/resolvers/zod";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Controller, useForm } from "react-hook-form";
import { useEffect, useRef, useState, type ReactNode, type Ref } from "react";
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  type TextInputProps,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { z } from "zod";
import presensiaMarkReverse from "../../assets/images/presensia-mark-reverse.png";
import { errorMessage } from "@/src/format";
import {
  clearRememberedEmail,
  getRememberedEmail,
  setRememberedEmail,
} from "@/src/remember-email";
import { useSession } from "@/src/session";
import { Icon, Sheet } from "@/src/ui";
import { colors, fonts } from "@/src/theme";

const loginSchema = z.object({
  email: z.email("Masukkan alamat email yang valid."),
  password: z.string().min(6),
});
type LoginValues = z.infer<typeof loginSchema>;

function LoginLogo() {
  return (
    <View style={styles.logoRow}>
      <Image
        accessible={false}
        source={presensiaMarkReverse}
        style={styles.logoMark}
      />
      <View style={styles.logoCopy}>
        <Text style={styles.logoName}>Presensia</Text>
        <Text style={styles.logoSub}>PKL & Magang Diskominfo Banten</Text>
      </View>
    </View>
  );
}

function LoginField({
  label,
  error,
  helper,
  trailing,
  inputRef,
  ...inputProps
}: TextInputProps & {
  label: string;
  error?: string;
  helper?: string;
  trailing?: ReactNode;
  inputRef?: Ref<TextInput>;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.inputWrap}>
        <TextInput
          ref={inputRef}
          accessibilityLabel={label}
          placeholderTextColor="#8A847C"
          style={[styles.input, trailing ? styles.inputWithTrailing : null, error ? styles.inputError : null]}
          {...inputProps}
        />
        {trailing}
      </View>
      {error ? (
        <Text accessibilityLiveRegion="polite" style={styles.fieldError}>
          {error}
        </Text>
      ) : helper ? (
        <Text style={styles.fieldHelper}>{helper}</Text>
      ) : null}
    </View>
  );
}

function LoginButton({
  label,
  onPress,
  loading = false,
}: {
  label: string;
  onPress: () => void;
  loading?: boolean;
}) {
  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityState={{ disabled: loading, busy: loading }}
      disabled={loading}
      activeOpacity={0.88}
      onPress={onPress}
      style={[styles.cta, loading ? styles.ctaBusy : null]}
    >
      {loading ? (
        <ActivityIndicator color="#fff" style={styles.ctaIcon} />
      ) : (
        <View style={styles.ctaIcon}>
          <Icon name="arrow-forward" size={19} color="#fff" />
        </View>
      )}
      <Text style={styles.ctaLabel}>{loading ? "Memproses..." : label}</Text>
    </TouchableOpacity>
  );
}

export default function LoginScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ recovery?: string }>();
  const { signIn, sendPasswordRecovery, updatePassword } = useSession();
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [recoveryOpen, setRecoveryOpen] = useState(params.recovery === "new-password");
  const [recoveryMode, setRecoveryMode] = useState<"email" | "password">(
    params.recovery === "new-password" ? "password" : "email",
  );
  const [recoveryResult, setRecoveryResult] = useState("");
  const [recoveryTone, setRecoveryTone] = useState<"success" | "error">("success");
  const [recoveryEmail, setRecoveryEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [recovering, setRecovering] = useState(false);
  const [serverError, setServerError] = useState("");
  const passwordRef = useRef<TextInput>(null);
  const {
    control,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  useEffect(() => {
    void (async () => {
      try {
        const remembered = await getRememberedEmail();
        if (remembered) {
          setValue("email", remembered);
          setRememberMe(true);
        }
      } catch {
        // Penyimpanan perangkat tidak tersedia; abaikan dan lanjutkan.
      }
    })();
  }, [setValue]);

  const submit = handleSubmit(
    async ({ email, password }) => {
      setServerError("");
      try {
        await signIn(email, password);
        try {
          if (rememberMe) {
            await setRememberedEmail(email.trim().toLowerCase());
          } else {
            await clearRememberedEmail();
          }
        } catch {
          // Gagal menyimpan preferensi email tidak boleh menggagalkan login.
        }
        router.replace("/");
      } catch (error) {
        setServerError(errorMessage(error));
      }
    },
    () => setServerError("Periksa kembali email dan kata sandimu, lalu coba lagi."),
  );

  async function recover() {
    setRecovering(true);
    setRecoveryResult("");
    try {
      if (recoveryMode === "email") {
        const email = recoveryEmail.trim().toLowerCase();
        if (!/^\S+@\S+\.\S+$/.test(email)) {
          setRecoveryTone("error");
          setRecoveryResult("Masukkan alamat email yang valid terlebih dahulu.");
          return;
        }
        await sendPasswordRecovery(email);
        setRecoveryTone("success");
        setRecoveryResult("Tautan pemulihan sudah dikirim. Periksa kotak masuk emailmu.");
      } else {
        if (newPassword.length < 8 || newPassword !== confirmPassword) {
          setRecoveryTone("error");
          setRecoveryResult("Kata sandi minimal 8 karakter dan kedua isian harus sama.");
          return;
        }
        await updatePassword(newPassword);
        setRecoveryTone("success");
        setRecoveryResult("Kata sandi berhasil diperbarui.");
      }
    } catch (error) {
      setRecoveryTone("error");
      setRecoveryResult(errorMessage(error));
    } finally {
      setRecovering(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.stage}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scroll}
        >
          <View pointerEvents="none" style={styles.art}>
            <View style={styles.ringCluster}>
              <View style={styles.ringThick} />
              <View style={styles.ringThin} />
              <View style={styles.ringDot} />
            </View>
            <View style={styles.ringCorner} />
          </View>

          <LoginLogo />

          <View style={styles.copy}>
            <View style={styles.eyebrow}>
              <View style={styles.eyebrowDot} />
              <Text style={styles.eyebrowText}>Presensi PKL & Magang</Text>
            </View>
            <Text style={styles.hero}>
              Hadir lebih mudah,{"\n"}
              <Text style={styles.heroAccent}>setiap hari.</Text>
            </Text>
            <Text style={styles.heroCopy}>
              Masuk menggunakan akun yang sudah dibuat oleh pengelola programmu.
            </Text>
          </View>

          <View style={styles.panel}>
            <View style={styles.panelHead}>
              <View style={styles.panelIcon}>
                <Icon name="shield-checkmark-outline" size={20} color={colors.primaryInk} />
              </View>
              <View style={styles.panelHeadCopy}>
                <Text style={styles.panelTitle}>Masuk Peserta</Text>
                <Text style={styles.panelSub}>Akses khusus akun peserta aktif</Text>
              </View>
            </View>

            <View style={styles.form}>
              <Controller
                control={control}
                name="email"
                render={({ field: { value, onChange, onBlur } }) => (
                  <LoginField
                    label="Email"
                    value={value}
                    onChangeText={(text) => {
                      onChange(text);
                      setServerError("");
                    }}
                    onBlur={onBlur}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    autoComplete="email"
                    textContentType="emailAddress"
                    returnKeyType="next"
                    blurOnSubmit={false}
                    onSubmitEditing={() => passwordRef.current?.focus()}
                    error={errors.email?.message}
                  />
                )}
              />
              <Controller
                control={control}
                name="password"
                render={({ field: { value, onChange, onBlur } }) => (
                  <LoginField
                    inputRef={passwordRef}
                    label="Kata sandi"
                    value={value}
                    onChangeText={(text) => {
                      onChange(text);
                      setServerError("");
                    }}
                    onBlur={onBlur}
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                    autoCorrect={false}
                    autoComplete="password"
                    textContentType="password"
                    returnKeyType="go"
                    onSubmitEditing={() => void submit()}
                    error={errors.password ? "Kata sandi minimal 6 karakter." : undefined}
                    trailing={
                      <Pressable
                        accessibilityLabel={
                          showPassword ? "Sembunyikan kata sandi" : "Tampilkan kata sandi"
                        }
                        accessibilityRole="button"
                        onPress={() => setShowPassword((valueNow) => !valueNow)}
                        style={styles.eye}
                      >
                        <Icon
                          name={showPassword ? "eye-off-outline" : "eye-outline"}
                          size={20}
                          color={colors.muted}
                        />
                      </Pressable>
                    }
                  />
                )}
              />
              <View style={styles.helpers}>
                <Pressable
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: rememberMe }}
                  accessibilityLabel="Ingat email saya di perangkat ini"
                  onPress={() => setRememberMe((valueNow) => !valueNow)}
                  style={styles.remember}
                >
                  <Icon
                    name={rememberMe ? "checkbox" : "square-outline"}
                    size={20}
                    color={rememberMe ? colors.primary : colors.muted}
                  />
                  <Text style={styles.rememberText}>Ingat saya</Text>
                </Pressable>
                {Platform.OS !== "web" ? (
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => {
                      setRecoveryMode("email");
                      setRecoveryResult("");
                      setRecoveryTone("success");
                      setRecoveryOpen(true);
                    }}
                    style={styles.forgot}
                  >
                    <Text style={styles.link}>Lupa kata sandi?</Text>
                  </Pressable>
                ) : null}
              </View>
              {serverError ? (
                <Text accessibilityLiveRegion="polite" style={styles.serverError}>
                  {serverError}
                </Text>
              ) : null}
              <LoginButton
                label="Masuk ke Presensia"
                onPress={() => void submit()}
                loading={isSubmitting}
              />
              <View style={styles.secureRow}>
                <Icon name="lock-closed-outline" size={13} color={colors.muted} />
                <Text style={styles.secureText}>Kredensial tersimpan aman di perangkat ini.</Text>
              </View>
            </View>
          </View>

          <Text style={styles.footnote}>
            Tidak memiliki akun? Hubungi pembina atau pengelola program PKL/magang.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>

      <Sheet
        visible={recoveryOpen}
        onClose={() => setRecoveryOpen(false)}
        title={recoveryMode === "email" ? "Pulihkan kata sandi" : "Buat kata sandi baru"}
        copy={
          recoveryMode === "email"
            ? "Kami akan mengirimkan tautan pemulihan ke emailmu."
            : "Gunakan minimal 8 karakter yang mudah kamu ingat."
        }
      >
        {recoveryMode === "email" ? (
          <LoginField
            label="Email terdaftar"
            value={recoveryEmail}
            onChangeText={setRecoveryEmail}
            placeholder="nama@email.com"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
            textContentType="emailAddress"
            returnKeyType="send"
            onSubmitEditing={() => void recover()}
          />
        ) : (
          <>
            <LoginField
              label="Kata sandi baru"
              value={newPassword}
              onChangeText={setNewPassword}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="password"
              textContentType="newPassword"
              helper="Minimal 8 karakter."
            />
            <LoginField
              label="Ulangi kata sandi"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="password"
              textContentType="newPassword"
            />
          </>
        )}
        {recoveryResult ? (
          <Text
            accessibilityLiveRegion="polite"
            style={recoveryTone === "error" ? styles.sheetError : styles.sheetSuccess}
          >
            {recoveryResult}
          </Text>
        ) : null}
        <LoginButton
          label={recoveryMode === "email" ? "Kirim tautan pemulihan" : "Simpan kata sandi baru"}
          loading={recovering}
          onPress={() => void recover()}
        />
      </Sheet>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#302B27", overflow: "hidden" },
  stage: { flex: 1 },
  scroll: { flexGrow: 1, paddingHorizontal: 22, paddingTop: 26, paddingBottom: 22 },
  art: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    overflow: "hidden",
  },
  ringCluster: {
    position: "absolute",
    top: -150,
    right: -140,
    width: 380,
    height: 380,
    alignItems: "center",
    justifyContent: "center",
  },
  ringThick: {
    position: "absolute",
    width: 380,
    height: 380,
    borderRadius: 190,
    borderWidth: 46,
    borderColor: "rgba(184,92,66,0.20)",
  },
  ringThin: {
    position: "absolute",
    width: 252,
    height: 252,
    borderRadius: 126,
    borderWidth: 1.5,
    borderColor: "rgba(247,244,239,0.12)",
  },
  ringDot: {
    position: "absolute",
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: colors.secondary,
    left: 66,
    bottom: 88,
  },
  ringCorner: {
    position: "absolute",
    left: -150,
    bottom: -170,
    width: 300,
    height: 300,
    borderRadius: 150,
    borderWidth: 1.5,
    borderColor: "rgba(247,244,239,0.08)",
  },
  logoRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  logoMark: {
    width: 48,
    height: 48,
  },
  logoCopy: { flex: 1 },
  logoName: { fontFamily: fonts.extrabold, fontSize: 19, color: "#fff", letterSpacing: -0.3 },
  logoSub: { marginTop: 2, fontFamily: fonts.medium, fontSize: 11, color: "#BDB4AD" },
  copy: { marginTop: 30 },
  eyebrow: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 7,
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(247,244,239,0.16)",
    backgroundColor: "rgba(247,244,239,0.07)",
  },
  eyebrowDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: "#E8A183" },
  eyebrowText: {
    fontFamily: fonts.bold,
    fontSize: 11,
    letterSpacing: 0.6,
    textTransform: "uppercase",
    color: "#E4D9D1",
  },
  hero: {
    marginTop: 14,
    fontFamily: fonts.extrabold,
    fontSize: 33,
    lineHeight: 40,
    letterSpacing: -1,
    color: "#fff",
  },
  heroAccent: { color: "#F2C9B8" },
  heroCopy: {
    marginTop: 10,
    maxWidth: 320,
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 21,
    color: "#C8C0BA",
  },
  panel: {
    marginTop: 24,
    padding: 20,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "#E7DFD3",
    backgroundColor: "#F7F4EF",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.28,
    shadowRadius: 26,
    elevation: 8,
  },
  panelHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.lineSoft,
  },
  panelIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  panelHeadCopy: { flex: 1 },
  panelTitle: { fontFamily: fonts.extrabold, fontSize: 16, color: colors.ink },
  panelSub: { marginTop: 2, fontFamily: fonts.medium, fontSize: 11.5, color: colors.muted },
  form: { marginTop: 16, gap: 14 },
  field: { gap: 7 },
  label: { fontFamily: fonts.bold, color: colors.ink, fontSize: 12.5 },
  inputWrap: { position: "relative", justifyContent: "center" },
  input: {
    minHeight: 52,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1.5,
    borderColor: colors.line,
    borderRadius: 14,
    color: colors.ink,
    backgroundColor: "#fff",
    fontFamily: fonts.regular,
    fontSize: 16,
  },
  inputWithTrailing: { paddingRight: 54 },
  inputError: { borderColor: colors.danger },
  fieldError: {
    padding: 10,
    borderRadius: 10,
    color: colors.dangerInk,
    backgroundColor: colors.dangerSoft,
    fontFamily: fonts.medium,
    fontSize: 11.5,
    lineHeight: 17,
  },
  fieldHelper: { fontFamily: fonts.regular, color: colors.muted, fontSize: 11, lineHeight: 16 },
  eye: {
    position: "absolute",
    right: 6,
    top: 6,
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 12,
  },
  helpers: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  remember: { minHeight: 44, flexDirection: "row", alignItems: "center", gap: 8 },
  rememberText: { fontFamily: fonts.semibold, color: colors.muted, fontSize: 12 },
  forgot: { minHeight: 44, justifyContent: "center" },
  link: { fontFamily: fonts.extrabold, color: colors.primaryInk, fontSize: 12 },
  serverError: {
    padding: 12,
    borderRadius: 12,
    backgroundColor: colors.dangerSoft,
    color: colors.dangerInk,
    fontFamily: fonts.medium,
    fontSize: 12,
    lineHeight: 18,
  },
  cta: {
    minHeight: 56,
    width: "100%",
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.primaryDeep,
    backgroundColor: colors.primary,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.32,
    shadowRadius: 18,
    elevation: 5,
  },
  ctaIcon: { marginRight: 10 },
  ctaBusy: { opacity: 0.8 },
  ctaLabel: { fontFamily: fonts.extrabold, fontSize: 15, color: "#fff" },
  secureRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 },
  secureText: { fontFamily: fonts.medium, color: colors.muted, fontSize: 11 },
  footnote: {
    marginTop: 18,
    textAlign: "center",
    fontFamily: fonts.regular,
    color: "#A99F98",
    fontSize: 11,
    lineHeight: 17,
  },
  sheetSuccess: {
    padding: 12,
    borderRadius: 12,
    backgroundColor: colors.successSoft,
    color: colors.successInk,
    fontFamily: fonts.medium,
    fontSize: 12,
    lineHeight: 18,
  },
  sheetError: {
    padding: 12,
    borderRadius: 12,
    backgroundColor: colors.dangerSoft,
    color: colors.dangerInk,
    fontFamily: fonts.medium,
    fontSize: 12,
    lineHeight: 18,
  },
});
