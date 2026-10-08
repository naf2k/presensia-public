import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Easing,
  Image,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  type ColorValue,
  type KeyboardTypeOptions,
  type TextInputProps,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import presensiaMark from "../assets/images/presensia-mark.png";
import presensiaMarkReverse from "../assets/images/presensia-mark-reverse.png";
import { appBackground, cardShadow, colors, fonts, popShadow } from "./theme";

type IconName = React.ComponentProps<typeof Ionicons>["name"];

export function Icon({
  name,
  size = 20,
  color = colors.ink,
}: {
  name: IconName;
  size?: number;
  color?: ColorValue;
}) {
  return <Ionicons name={name} size={size} color={color} />;
}

export function Screen({
  children,
  scroll = true,
  padded = true,
  appBar,
  tone = "home",
  refreshing = false,
  onRefresh,
}: {
  children: React.ReactNode;
  scroll?: boolean;
  padded?: boolean;
  appBar?: React.ReactNode;
  tone?: "home" | "app";
  refreshing?: boolean;
  onRefresh?: () => void;
}) {
  const backgroundColor = tone === "app" ? appBackground : colors.background;
  const fade = useRef(new Animated.Value(0)).current;
  useFocusEffect(
    useCallback(() => {
      fade.setValue(0);
      const animation = Animated.timing(fade, {
        toValue: 1,
        duration: 180,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      });
      animation.start();
      return () => animation.stop();
    }, [fade]),
  );
  const content = (
    <View style={[styles.screenInner, padded && styles.padded, { backgroundColor }]}>
      {children}
    </View>
  );
  return (
    <SafeAreaView edges={["top"]} style={[styles.safe, { backgroundColor }]}>
      <Animated.View style={[styles.fadeWrap, { opacity: fade }]}>
        {appBar}
        {scroll ? (
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.scroll}
            style={{ backgroundColor }}
            refreshControl={
              onRefresh ? (
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={onRefresh}
                  tintColor={colors.primary}
                />
              ) : undefined
            }
          >
            {content}
          </ScrollView>
        ) : (
          content
        )}
      </Animated.View>
    </SafeAreaView>
  );
}

export function AppBar({
  title,
  subtitle,
  back,
  action,
}: {
  title: string;
  subtitle?: string;
  back?: boolean;
  action?: React.ReactNode;
}) {
  const router = useRouter();
  return (
    <View style={styles.appBar}>
      <View style={styles.appBarSide}>
        {back ? (
          <Pressable
            accessibilityLabel="Kembali"
            accessibilityRole="button"
            onPress={() => router.back()}
            style={styles.iconButton}
          >
            <Icon name="arrow-back" />
          </Pressable>
        ) : null}
      </View>
      <View style={styles.appBarTitle} accessible accessibilityRole="header">
        <Text style={styles.appBarHeading} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={styles.appBarSubtitle} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      <View style={[styles.appBarSide, styles.appBarAction]}>{action}</View>
    </View>
  );
}

export function ScreenIntro({ title, copy }: { title: string; copy?: string }) {
  return (
    <View style={styles.screenIntro}>
      <Text style={styles.screenIntroTitle}>{title}</Text>
      {copy ? <Text style={styles.screenIntroCopy}>{copy}</Text> : null}
    </View>
  );
}

export function BrandMark({ light = false }: { light?: boolean }) {
  return (
    <View style={styles.brand}>
      <Image
        accessible={false}
        source={light ? presensiaMarkReverse : presensiaMark}
        style={styles.brandGlyph}
      />
      <Text style={[styles.brandText, light && { color: colors.surface }]}>Presensia</Text>
    </View>
  );
}

export function Button({
  label,
  onPress,
  variant = "primary",
  icon,
  loading = false,
  disabled = false,
  compact = false,
}: {
  label: string;
  onPress?: () => void;
  variant?: "primary" | "secondary" | "quiet" | "danger";
  icon?: IconName;
  loading?: boolean;
  disabled?: boolean;
  compact?: boolean;
}) {
  const inactive = disabled || loading;
  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityState={{ disabled: inactive, busy: loading }}
      disabled={inactive}
      activeOpacity={0.9}
      onPress={onPress}
      style={[
        styles.button,
        styles[`button_${variant}`],
        compact && styles.buttonCompact,
        inactive && styles.disabled,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={variant === "primary" ? "#fff" : colors.primary} />
      ) : icon ? (
        <Icon
          name={icon}
          size={19}
          color={
            variant === "primary"
              ? "#fff"
              : variant === "danger"
                ? colors.dangerInk
                : colors.primaryInk
          }
        />
      ) : null}
      <Text style={[styles.buttonText, styles[`buttonText_${variant}`]]}>{label}</Text>
    </TouchableOpacity>
  );
}

export function Field({
  label,
  error,
  helper,
  multiline,
  ...props
}: TextInputProps & {
  label?: string;
  error?: string;
  helper?: string;
  keyboardType?: KeyboardTypeOptions;
}) {
  return (
    <View style={styles.field}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <TextInput
        accessibilityLabel={label}
        accessibilityState={{ disabled: props.editable === false }}
        aria-invalid={Boolean(error)}
        placeholderTextColor="#827D76"
        multiline={multiline}
        style={[styles.input, multiline && styles.textarea, error && styles.inputError]}
        {...props}
      />
      {error ? (
        <Text accessibilityLiveRegion="polite" style={styles.errorText}>
          {error}
        </Text>
      ) : helper ? (
        <Text style={styles.helper}>{helper}</Text>
      ) : null}
    </View>
  );
}

export function Surface({
  children,
  style,
  elevated = false,
}: {
  children: React.ReactNode;
  style?: object;
  elevated?: boolean;
}) {
  return <View style={[styles.surface, elevated && cardShadow, style]}>{children}</View>;
}

export function StatusPill({
  children,
  tone = "success",
}: {
  children: React.ReactNode;
  tone?: "success" | "warning" | "danger" | "neutral" | "primary";
}) {
  return (
    <View style={[styles.pill, styles[`pill_${tone}`]]}>
      <View style={[styles.pillDot, styles[`pillDot_${tone}`]]} />
      <Text style={[styles.pillText, styles[`pillText_${tone}`]]}>{children}</Text>
    </View>
  );
}

export function SectionHead({
  title,
  subtitle,
  aside,
}: {
  title: string;
  subtitle?: string;
  aside?: React.ReactNode;
}) {
  return (
    <View style={styles.sectionHead}>
      <View style={styles.sectionHeadCopy}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {subtitle ? <Text style={styles.sectionSubtitle}>{subtitle}</Text> : null}
      </View>
      {aside}
    </View>
  );
}

export function InlineFeedback({
  tone = "info",
  text,
}: {
  tone?: "success" | "error" | "warning" | "info";
  text: string;
}) {
  return (
    <Text accessibilityLiveRegion="polite" style={[styles.feedback, styles[`feedback_${tone}`]]}>
      {text}
    </Text>
  );
}

export function EmptyState({
  icon,
  title,
  copy,
  action,
  actionLabel = "Coba lagi",
  loading = false,
}: {
  icon?: IconName;
  title: string;
  copy: string;
  action?: () => void;
  actionLabel?: string;
  loading?: boolean;
}) {
  return (
    <View style={styles.empty}>
      <View style={styles.emptyIcon}>
        {icon ? <Icon name={icon} size={23} color={colors.primaryInk} /> : null}
      </View>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyCopy}>{copy}</Text>
      {action ? (
        <View style={styles.emptyAction}>
          <Button label={actionLabel} onPress={action} loading={loading} />
        </View>
      ) : null}
    </View>
  );
}

export function PageState({
  icon = "cloud-offline-outline",
  title,
  copy,
  action,
  actionLabel = "Coba lagi",
  loading = false,
  tone = "primary",
}: {
  icon?: IconName;
  title: string;
  copy: string;
  action?: () => void;
  actionLabel?: string;
  loading?: boolean;
  tone?: "primary" | "success" | "error" | "neutral";
}) {
  return (
    <View style={styles.pageState}>
      {loading ? (
        <View style={styles.skeleton} aria-hidden>
          <View style={styles.skeletonTitle} />
          <View style={styles.skeletonLine} />
          <View style={styles.skeletonBlock} />
          <View style={styles.skeletonLineShort} />
        </View>
      ) : (
        <>
          <View style={[styles.stateIcon, styles[`stateIcon_${tone}`]]}>
            <Icon
              name={icon}
              size={25}
              color={tone === "error" ? colors.dangerInk : colors.primaryInk}
            />
          </View>
          <Text style={styles.stateTitle}>{title}</Text>
          <Text style={styles.stateCopy}>{copy}</Text>
          {action ? (
            <View style={styles.pageStateAction}>
              <Button label={actionLabel} onPress={action} />
            </View>
          ) : null}
        </>
      )}
    </View>
  );
}

export function Sheet({
  visible,
  onClose,
  title,
  copy,
  children,
}: {
  visible: boolean;
  onClose: () => void;
  title: string;
  copy?: string;
  children: React.ReactNode;
}) {
  const [rendered, setRendered] = useState(visible);
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const sheetOffset = useRef(new Animated.Value(64)).current;
  useEffect(() => {
    if (visible) {
      setRendered(true);
      backdropOpacity.setValue(0);
      sheetOffset.setValue(64);
      Animated.parallel([
        Animated.timing(backdropOpacity, {
          toValue: 1,
          duration: 160,
          useNativeDriver: true,
        }),
        Animated.timing(sheetOffset, {
          toValue: 0,
          duration: 260,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start();
      return undefined;
    }
    const animation = Animated.parallel([
      Animated.timing(backdropOpacity, {
        toValue: 0,
        duration: 160,
        useNativeDriver: true,
      }),
      Animated.timing(sheetOffset, {
        toValue: 64,
        duration: 200,
        easing: Easing.in(Easing.quad),
        useNativeDriver: true,
      }),
    ]);
    animation.start(() => setRendered(false));
    return () => animation.stop();
  }, [visible, backdropOpacity, sheetOffset]);
  if (!rendered) return null;
  return (
    <Modal visible transparent animationType="none" onRequestClose={onClose}>
      <View style={styles.backdropRoot}>
        <Animated.View
          pointerEvents="none"
          style={[styles.backdropShade, { opacity: backdropOpacity }]}
        />
        <Pressable
          style={styles.backdropPress}
          onPress={onClose}
          accessibilityLabel="Tutup"
          accessibilityRole="button"
        />
        <Animated.View style={[styles.sheet, { transform: [{ translateY: sheetOffset }] }]}>
          <View style={styles.handle} />
          <View style={styles.sheetHeader}>
            <View style={styles.sheetHeadCopy} accessible accessibilityRole="header">
              <Text style={styles.sheetTitle}>{title}</Text>
              {copy ? <Text style={styles.sheetCopy}>{copy}</Text> : null}
            </View>
            <Pressable accessibilityLabel="Tutup" onPress={onClose} style={styles.sheetClose}>
              <Icon name="close" color={colors.muted} />
            </Pressable>
          </View>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.sheetBody}>
            {children}
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
}

export const typography = StyleSheet.create({
  h1: {
    fontFamily: fonts.extrabold,
    color: colors.ink,
    fontSize: 24,
    lineHeight: 29,
    letterSpacing: -0.9,
  },
  h2: {
    fontFamily: fonts.extrabold,
    color: colors.ink,
    fontSize: 18,
    lineHeight: 24,
    letterSpacing: -0.3,
  },
  body: { fontFamily: fonts.regular, color: colors.ink, fontSize: 14, lineHeight: 22 },
  muted: { fontFamily: fonts.regular, color: colors.muted, fontSize: 13, lineHeight: 21 },
  caption: { fontFamily: fonts.semibold, color: colors.muted, fontSize: 11, lineHeight: 16 },
});

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  scroll: { flexGrow: 1 },
  screenInner: { flex: 1, width: "100%", maxWidth: 480, alignSelf: "center" },
  padded: { paddingHorizontal: 18, paddingBottom: 30 },
  appBar: {
    minHeight: 60,
    paddingHorizontal: 13,
    paddingVertical: 7,
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: colors.lineSoft,
    backgroundColor: appBackground,
  },
  appBarSide: { width: 44, alignItems: "flex-start" },
  appBarAction: { alignItems: "flex-end" },
  iconButton: {
    width: 44,
    height: 44,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 13,
  },
  appBarTitle: { flex: 1, alignItems: "center" },
  appBarHeading: {
    fontFamily: fonts.extrabold,
    fontSize: 16,
    lineHeight: 20,
    letterSpacing: -0.4,
    color: colors.ink,
  },
  appBarSubtitle: { marginTop: 1, fontFamily: fonts.medium, fontSize: 11, color: colors.muted },
  screenIntro: { marginHorizontal: 2, marginTop: 2, marginBottom: 20 },
  screenIntroTitle: {
    fontFamily: fonts.extrabold,
    color: colors.ink,
    fontSize: 23,
    lineHeight: 28,
    letterSpacing: -0.8,
  },
  screenIntroCopy: { marginTop: 7, fontFamily: fonts.regular, color: colors.muted, fontSize: 13, lineHeight: 21 },
  brand: { flexDirection: "row", alignItems: "center", gap: 9 },
  brandGlyph: { width: 31, height: 31 },
  brandText: { fontFamily: fonts.extrabold, color: colors.ink, fontSize: 15, letterSpacing: -0.4 },
  button: {
    minHeight: 52,
    width: "100%",
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 9,
  },
  buttonCompact: { minHeight: 44 },
  button_primary: { backgroundColor: colors.primary, borderColor: colors.primary },
  button_secondary: { backgroundColor: colors.surface, borderColor: colors.line },
  button_quiet: { backgroundColor: "transparent", borderColor: "transparent" },
  button_danger: { backgroundColor: colors.dangerSoft, borderColor: "#EAC7C3" },
  buttonText: { fontFamily: fonts.extrabold, fontSize: 14 },
  buttonText_primary: { color: colors.surface },
  buttonText_secondary: { color: colors.ink },
  buttonText_quiet: { color: colors.primaryInk },
  buttonText_danger: { color: colors.dangerInk },
  disabled: { opacity: 0.6 },
  field: { gap: 7 },
  label: { fontFamily: fonts.bold, color: colors.ink, fontSize: 12 },
  input: {
    minHeight: 49,
    paddingHorizontal: 13,
    paddingVertical: 11,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 12,
    color: colors.ink,
    backgroundColor: colors.surface,
    fontFamily: fonts.regular,
    fontSize: 16,
  },
  textarea: { minHeight: 132, textAlignVertical: "top", lineHeight: 24 },
  inputError: { borderColor: colors.dangerInk },
  errorText: {
    padding: 10,
    borderRadius: 10,
    color: colors.dangerInk,
    backgroundColor: colors.dangerSoft,
    fontFamily: fonts.medium,
    fontSize: 11,
    lineHeight: 17,
  },
  helper: { fontFamily: fonts.regular, color: colors.muted, fontSize: 11, lineHeight: 17 },
  surface: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.lineSoft,
    borderRadius: 16,
    overflow: "hidden",
  },
  pill: {
    minHeight: 27,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 999,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    alignSelf: "flex-start",
  },
  pillDot: { width: 5, height: 5, borderRadius: 3 },
  pillDot_success: { backgroundColor: colors.successInk },
  pillDot_warning: { backgroundColor: colors.amberInk },
  pillDot_danger: { backgroundColor: colors.dangerInk },
  pillDot_neutral: { backgroundColor: colors.slateInk },
  pillDot_primary: { backgroundColor: colors.primaryInk },
  pillText: { fontFamily: fonts.extrabold, fontSize: 11 },
  pill_success: { backgroundColor: colors.successSoft },
  pillText_success: { color: colors.successInk },
  pill_warning: { backgroundColor: colors.amberSoft },
  pillText_warning: { color: colors.amberInk },
  pill_danger: { backgroundColor: colors.dangerSoft },
  pillText_danger: { color: colors.dangerInk },
  pill_neutral: { backgroundColor: colors.slateSoft },
  pillText_neutral: { color: colors.slateInk },
  pill_primary: { backgroundColor: colors.primarySoft },
  pillText_primary: { color: colors.primaryInk },
  sectionHead: {
    marginTop: 24,
    marginBottom: 10,
    marginHorizontal: 2,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    gap: 12,
  },
  sectionHeadCopy: { flex: 1 },
  sectionTitle: { fontFamily: fonts.extrabold, color: colors.ink, fontSize: 14, letterSpacing: -0.3 },
  sectionSubtitle: { marginTop: 2, fontFamily: fonts.regular, color: colors.muted, fontSize: 11 },
  feedback: {
    padding: 12,
    borderRadius: 12,
    fontFamily: fonts.medium,
    fontSize: 11,
    lineHeight: 17,
  },
  feedback_success: { backgroundColor: colors.successSoft, color: colors.successInk },
  feedback_error: { backgroundColor: colors.dangerSoft, color: colors.dangerInk },
  feedback_warning: { backgroundColor: colors.amberSoft, color: colors.amberInk },
  feedback_info: { backgroundColor: colors.secondarySoft, color: colors.secondaryDeep },
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
    marginBottom: 13,
  },
  emptyTitle: { fontFamily: fonts.extrabold, color: colors.ink, fontSize: 14, textAlign: "center" },
  emptyCopy: {
    marginTop: 6,
    textAlign: "center",
    fontFamily: fonts.regular,
    color: colors.muted,
    fontSize: 11,
    lineHeight: 18,
  },
  emptyAction: { width: "100%", marginTop: 16 },
  pageState: {
    flex: 1,
    minHeight: 290,
    padding: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  skeleton: { width: "100%", maxWidth: 320, gap: 10 },
  skeletonTitle: { width: "42%", height: 24, borderRadius: 7, backgroundColor: "#E9E4DC" },
  skeletonLine: { width: "82%", height: 18, borderRadius: 7, backgroundColor: "#E9E4DC" },
  skeletonBlock: { width: "100%", height: 86, borderRadius: 7, backgroundColor: "#E9E4DC" },
  skeletonLineShort: { width: "68%", height: 18, borderRadius: 7, backgroundColor: "#E9E4DC" },
  stateIcon: {
    width: 58,
    height: 58,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.primarySoft,
    marginBottom: 15,
  },
  stateIcon_primary: {},
  stateIcon_error: { backgroundColor: colors.dangerSoft },
  stateIcon_success: { backgroundColor: colors.successSoft },
  stateIcon_neutral: { backgroundColor: colors.surface2 },
  stateTitle: {
    fontFamily: fonts.extrabold,
    color: colors.ink,
    fontSize: 19,
    letterSpacing: -0.5,
    textAlign: "center",
    maxWidth: 290,
  },
  stateCopy: {
    marginTop: 8,
    fontFamily: fonts.regular,
    color: colors.muted,
    fontSize: 13,
    lineHeight: 21,
    textAlign: "center",
    maxWidth: 310,
  },
  pageStateAction: { width: "100%", marginTop: 18 },
  fadeWrap: { flex: 1 },
  backdropRoot: {
    flex: 1,
    justifyContent: "flex-end",
    padding: 14,
  },
  backdropShade: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    backgroundColor: "rgba(37,34,31,0.5)",
  },
  backdropPress: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
  },
  sheet: {
    maxHeight: "78%",
    backgroundColor: colors.surface,
    borderRadius: 22,
    overflow: "hidden",
    ...popShadow,
  },
  handle: {
    width: 38,
    height: 4,
    borderRadius: 4,
    backgroundColor: "#D6D0C8",
    alignSelf: "center",
    marginTop: 10,
  },
  sheetHeader: {
    flexDirection: "row",
    gap: 14,
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.lineSoft,
  },
  sheetHeadCopy: { flex: 1 },
  sheetTitle: { fontFamily: fonts.extrabold, color: colors.ink, fontSize: 17, letterSpacing: -0.4 },
  sheetCopy: {
    marginTop: 4,
    fontFamily: fonts.regular,
    color: colors.muted,
    fontSize: 11,
    lineHeight: 17,
  },
  sheetClose: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.surface2,
    justifyContent: "center",
    alignItems: "center",
  },
  sheetBody: { padding: 18, gap: 12 },
});
