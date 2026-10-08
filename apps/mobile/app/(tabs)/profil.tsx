import { useRouter } from "expo-router";
import { useState } from "react";
import { Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { errorMessage, formatDate, initials } from "@/src/format";
import { useParticipantContext } from "@/src/queries";
import { useSession } from "@/src/session";
import { checkAndFetchUpdate, getAppUpdateInfo, restartApp } from "@/src/update-status";
import {
  AppBar,
  Button,
  Field,
  Icon,
  PageState,
  Screen,
  SectionHead,
  Sheet,
  Surface,
} from "@/src/ui";
import { colors, fonts } from "@/src/theme";

export default function ProfilScreen() {
  const router = useRouter();
  const { signOut, updatePassword } = useSession();
  const context = useParticipantContext();
  const [passwordSheet, setPasswordSheet] = useState(false);
  const [logoutSheet, setLogoutSheet] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [passwordFeedback, setPasswordFeedback] = useState("");
  const [updatingPassword, setUpdatingPassword] = useState(false);
  const [updateCopy, setUpdateCopy] = useState("Cek versi terbaru dari server.");
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const [updateReady, setUpdateReady] = useState(false);
  const updateInfo = getAppUpdateInfo();
  async function checkUpdate() {
    setCheckingUpdate(true);
    setUpdateCopy("Memeriksa ke server...");
    try {
      const result = await checkAndFetchUpdate();
      if (result === "latest") {
        setUpdateReady(false);
        setUpdateCopy("Sudah versi terbaru.");
      } else {
        setUpdateReady(true);
        setUpdateCopy("Update diunduh. Mulai ulang untuk menerapkan.");
      }
    } catch (error) {
      setUpdateReady(false);
      setUpdateCopy(errorMessage(error));
    } finally {
      setCheckingUpdate(false);
    }
  }
  async function logout() {
    setLoggingOut(true);
    try {
      await signOut();
      router.replace("/login");
    } finally {
      setLoggingOut(false);
      setLogoutSheet(false);
    }
  }
  async function changePassword() {
    if (newPassword.length < 8) {
      setPasswordFeedback("Kata sandi minimal 8 karakter.");
      return;
    }
    setUpdatingPassword(true);
    setPasswordFeedback("");
    try {
      await updatePassword(newPassword);
      setPasswordFeedback("Kata sandi berhasil diperbarui.");
      setNewPassword("");
    } catch (error) {
      setPasswordFeedback(errorMessage(error));
    } finally {
      setUpdatingPassword(false);
    }
  }
  const appBar = <AppBar title="Profil" subtitle="Akun peserta" />;
  if (context.isPending)
    return (
      <Screen tone="app" padded={false} appBar={appBar}>
        <PageState loading title="Menyiapkan profil" copy="Memuat data akun dan programmu." />
      </Screen>
    );
  if (context.isError)
    return (
      <Screen tone="app" padded={false} appBar={appBar}>
        <PageState
          title="Profil belum dapat dimuat"
          copy={errorMessage(context.error)}
          action={() => void context.refetch()}
        />
      </Screen>
    );
  const { profile, internship, institution, settings } = context.data;
  const program = internship?.participant_type === "SMK_PKL" ? "PKL SMK" : "Magang mahasiswa";
  return (
    <Screen tone="app" padded={false} appBar={appBar}>
      <View style={styles.content}>
        <Surface style={styles.identityCard}>
          <View style={styles.identity}>
            <View style={styles.avatar}>
              <Text style={styles.initial}>{initials(profile.full_name)}</Text>
              <View style={styles.online} />
            </View>
            <Text style={styles.name}>{profile.full_name}</Text>
            <Text style={styles.role}>
              {institution?.name ?? "Institusi belum tersedia"} ·{" "}
              {internship?.major ?? "Program belum tersedia"}
            </Text>
            <View style={styles.period}>
              <Icon name="calendar-outline" size={15} color={colors.secondaryDeep} />
              <Text style={styles.periodText}>
                {internship
                  ? `Aktif sampai ${formatDate(internship.end_date)}`
                  : "Belum ada periode aktif"}
              </Text>
            </View>
          </View>
        </Surface>
        <SectionHead title="Informasi akun" subtitle="Dikelola oleh admin program" />
        <Surface style={styles.profileListCard}>
          <View style={styles.profileList}>
            <ProfileRow icon="mail-outline" label="Email" value={profile.email} />
            <ProfileRow
              icon="school-outline"
              label="NIS/NIM · Jurusan"
              value={
                internship ? `${internship.student_number} · ${internship.major}` : "Belum tersedia"
              }
            />
            <ProfileRow icon="briefcase-outline" label="Program" value={program} />
            <ProfileRow
              icon="location-outline"
              label="Lokasi penugasan"
              value={settings.location_name}
              last
            />
          </View>
        </Surface>
        <SectionHead title="Info aplikasi" subtitle="Versi dan status update" />
        <Surface style={styles.profileListCard}>
          <View style={styles.profileList}>
            <ProfileRow icon="phone-portrait-outline" label="Versi aplikasi" value={updateInfo.appVersion} />
            <ProfileRow icon="refresh-outline" label="Runtime" value={updateInfo.runtimeVersion} />
            <ProfileRow icon="cloud-download-outline" label="Kanal update" value={updateInfo.channel} />
            <ProfileRow icon="information-circle-outline" label="Update berjalan" value={updateInfo.updateLabel} last />
          </View>
        </Surface>
        <SectionHead title="Keamanan & bantuan" />
        <View style={styles.menu}>
          <MenuRow
            icon="key-outline"
            title="Ubah kata sandi"
            copy="Perbarui kredensial akun"
            onPress={() => setPasswordSheet(true)}
          />
          <MenuRow
            icon="mail-unread-outline"
            title="Hubungi admin"
            copy="Untuk perubahan data akun"
            onPress={() => void Linking.openURL("mailto:admin.presensia@bantenprov.go.id")}
          />
          <MenuRow
            icon="cloud-download-outline"
            title="Periksa update"
            copy={updateCopy}
            onPress={() => void checkUpdate()}
            last
          />
          {updateReady ? (
            <View style={styles.restartWrap}>
              <Button
                label={checkingUpdate ? "Memeriksa..." : "Mulai ulang sekarang"}
                onPress={() => void restartApp()}
              />
            </View>
          ) : null}
        </View>
        <View style={styles.logout}>
          <Button
            variant="danger"
            icon="log-out-outline"
            label="Keluar dari akun"
            onPress={() => setLogoutSheet(true)}
          />
        </View>
      </View>
      <Sheet
        visible={passwordSheet}
        onClose={() => setPasswordSheet(false)}
        title="Ubah kata sandi"
        copy="Gunakan minimal 8 karakter dengan kombinasi yang tidak mudah ditebak."
      >
        <Field
          label="Kata sandi baru"
          value={newPassword}
          onChangeText={(value) => {
            setNewPassword(value);
            setPasswordFeedback("");
          }}
          secureTextEntry
        />
        {passwordFeedback ? <Text style={styles.sheetText}>{passwordFeedback}</Text> : null}
        <Button
          label="Simpan kata sandi"
          loading={updatingPassword}
          onPress={() => void changePassword()}
        />
      </Sheet>
      <Sheet
        visible={logoutSheet}
        onClose={() => setLogoutSheet(false)}
        title="Keluar dari akun?"
        copy="Kamu harus masuk kembali untuk melakukan presensi."
      >
        <Button
          variant="danger"
          label="Ya, keluar"
          loading={loggingOut}
          onPress={() => void logout()}
        />
        <Button variant="secondary" label="Batal" onPress={() => setLogoutSheet(false)} />
      </Sheet>
    </Screen>
  );
}

function ProfileRow({
  icon,
  label,
  value,
  last,
}: {
  icon: React.ComponentProps<typeof Icon>["name"];
  label: string;
  value: string;
  last?: boolean;
}) {
  return (
    <View style={[styles.profileRow, last && { borderBottomWidth: 0 }]}>
      <View style={styles.rowIcon}>
        <Icon name={icon} size={16} color={colors.primaryInk} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.rowLabel}>{label}</Text>
        <Text style={styles.rowValue}>{value}</Text>
      </View>
    </View>
  );
}
function MenuRow({
  icon,
  title,
  copy,
  danger,
  onPress,
  last,
}: {
  icon: React.ComponentProps<typeof Icon>["name"];
  title: string;
  copy?: string;
  danger?: boolean;
  onPress: () => void;
  last?: boolean;
}) {
  return (
    <Pressable onPress={onPress} style={[styles.menuRow, last && { borderBottomWidth: 0 }]}>
      <View style={[styles.menuIcon, danger && { backgroundColor: colors.dangerSoft }]}>
        <Icon
          name={icon}
          size={16}
          color={danger ? colors.dangerInk : colors.secondaryDeep}
        />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.menuTitle, danger && { color: colors.dangerInk }]}>{title}</Text>
        {copy ? <Text style={styles.menuCopy}>{copy}</Text> : null}
      </View>
      <Icon name="chevron-forward" size={14} color="#A59E96" />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 18, paddingTop: 20, paddingBottom: 28 },
  identityCard: {},
  profileListCard: { paddingHorizontal: 16 },
  identity: { alignItems: "center", padding: 24 },
  avatar: {
    width: 82,
    height: 82,
    borderRadius: 27,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  initial: { fontFamily: fonts.extrabold, color: colors.primaryInk, fontSize: 22 },
  online: {
    position: "absolute",
    right: 4,
    bottom: 4,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: colors.success,
    borderWidth: 3,
    borderColor: colors.surface,
  },
  name: { marginTop: 13, fontFamily: fonts.extrabold, color: colors.ink, fontSize: 20, letterSpacing: -0.4 },
  role: {
    maxWidth: 290,
    marginTop: 4,
    textAlign: "center",
    fontFamily: fonts.regular,
    color: colors.muted,
    fontSize: 11,
    lineHeight: 17,
  },
  period: {
    marginTop: 14,
    paddingHorizontal: 11,
    paddingVertical: 9,
    borderRadius: 11,
    backgroundColor: colors.secondarySoft,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  periodText: { fontFamily: fonts.bold, color: colors.secondaryDeep, fontSize: 11 },
  profileList: {},
  profileRow: {
    minHeight: 62,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.lineSoft,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  rowIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  rowLabel: { fontFamily: fonts.semibold, color: colors.muted, fontSize: 11 },
  rowValue: { marginTop: 2, fontFamily: fonts.bold, color: colors.ink, fontSize: 11 },
  logout: { marginTop: 16 },
  menu: {
    borderWidth: 1,
    borderColor: colors.lineSoft,
    borderRadius: 16,
    backgroundColor: colors.surface,
    overflow: "hidden",
  },
  menuRow: {
    minHeight: 58,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.lineSoft,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  menuIcon: {
    width: 34,
    height: 34,
    borderRadius: 11,
    backgroundColor: colors.secondarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  menuTitle: { fontFamily: fonts.extrabold, color: colors.ink, fontSize: 12 },
  menuCopy: { marginTop: 2, fontFamily: fonts.regular, color: colors.muted, fontSize: 11 },
  restartWrap: { paddingHorizontal: 14, paddingBottom: 12 },
  sheetText: { fontFamily: fonts.regular, color: colors.muted, fontSize: 11, lineHeight: 18 },
});
