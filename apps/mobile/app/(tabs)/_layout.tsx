import { Tabs } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Icon } from "@/src/ui";
import { colors, fonts } from "@/src/theme";

const tabs = [
  { name: "index", title: "Beranda", icon: "home-outline" },
  { name: "riwayat", title: "Riwayat", icon: "calendar-outline" },
  { name: "jurnal", title: "Jurnal", icon: "book-outline" },
  { name: "profil", title: "Profil", icon: "person-outline" },
] as const;

type TabProps = {
  state: {
    index: number;
    routes: { key: string; name: string; params?: object }[];
  };
  navigation: {
    emit: (event: { type: string; target: string; canPreventDefault: boolean }) => {
      defaultPrevented: boolean;
    };
    navigate: (name: string, params?: object) => void;
  };
};

function PresensiaTabBar({ state, navigation }: TabProps) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.bar, { paddingBottom: Math.max(9, insets.bottom) }]}>
      {state.routes.map((route, index) => {
        const focused = state.index === index;
        const meta =
          tabs.find((item) => item.name === route.name) ??
          ({ name: route.name, title: route.name, icon: "ellipse-outline" } as const);
        const onPress = () => {
          const event = navigation.emit({
            type: "tabPress",
            target: route.key,
            canPreventDefault: true,
          });
          if (!focused && !event.defaultPrevented) {
            navigation.navigate(route.name, route.params);
          }
        };
        return (
          <Pressable
            key={route.key}
            accessibilityRole="button"
            accessibilityState={focused ? { selected: true } : {}}
            accessibilityLabel={meta.title}
            onPress={onPress}
            style={styles.item}
          >
            <View style={styles.indicatorSlot}>
              {focused ? <View style={styles.indicator} /> : null}
            </View>
            <Icon
              name={meta.icon}
              size={19}
              color={focused ? colors.primary : colors.muted}
            />
            <Text style={[styles.label, focused && styles.labelActive]}>{meta.title}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{ headerShown: false }}
      tabBar={(props) => <PresensiaTabBar {...(props as unknown as TabProps)} />}
    >
      <Tabs.Screen name="index" />
      <Tabs.Screen name="riwayat" />
      <Tabs.Screen name="jurnal" />
      <Tabs.Screen name="profil" />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    minHeight: 68,
    paddingTop: 6,
    paddingHorizontal: 12,
    borderTopWidth: 1,
    borderTopColor: colors.lineSoft,
    backgroundColor: colors.surface,
  },
  item: { flex: 1, minWidth: 52, minHeight: 48, alignItems: "center", borderRadius: 12 },
  indicatorSlot: { height: 5, alignItems: "center", justifyContent: "flex-start" },
  indicator: { width: 24, height: 3, borderRadius: 3, backgroundColor: colors.primary },
  label: { marginTop: 3, fontFamily: fonts.bold, fontSize: 11, color: "#68625C" },
  labelActive: { color: colors.primary },
});
