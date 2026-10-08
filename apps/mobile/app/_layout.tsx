import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import {
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
  useFonts,
} from "@expo-google-fonts/plus-jakarta-sans";
import { Stack, useRouter, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { AppState, Platform, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { SessionProvider, useSession } from "@/src/session";
import { clockKeys } from "@/src/server-time";
import { colors } from "@/src/theme";
import "../global.css";

export {
  // Catch any errors thrown by the Layout component.
  ErrorBoundary,
} from "expo-router";

export const unstable_settings = {
  initialRouteName: "(auth)",
};

// Prevent the splash screen from auto-hiding before the app is ready.
void SplashScreen.preventAutoHideAsync();

function AppProviders({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            retry: 1,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <SessionProvider>{children}</SessionProvider>
    </QueryClientProvider>
  );
}

function SessionGate({ children }: { children: ReactNode }) {
  const { ready, signedIn } = useSession();
  const queryClient = useQueryClient();
  const segments = useSegments();
  const router = useRouter();

  const appState = useRef(AppState.currentState);
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (next) => {
      if (appState.current.match(/inactive|background/) && next === "active") {
        void queryClient.invalidateQueries({ queryKey: clockKeys.context });
      }
      appState.current = next;
    });
    return () => subscription.remove();
  }, [queryClient]);

  useEffect(() => {
    if (!ready) return;
    const inAuth = segments[0] === "(auth)";
    if (!signedIn && !inAuth) {
      queryClient.clear();
      router.replace("/login");
    }
    if (signedIn && inAuth) router.replace("/");
  }, [queryClient, ready, router, segments, signedIn]);

  if (!ready) return <View style={{ flex: 1, backgroundColor: colors.background }} />;
  const inAuth = segments[0] === "(auth)";
  return (
    <>
      <StatusBar style={inAuth ? "light" : "dark"} />
      {children}
    </>
  );
}

export default function RootLayout() {
  // Web memakai @font-face statis dari +html.tsx (loader JS Expo 404 di
  // hosting statis); lewati useFonts agar tidak menembak URL mati.
  const [fontsLoaded, fontError] = useFonts(
    Platform.OS === "web"
      ? {}
      : {
          PlusJakartaSans_400Regular,
          PlusJakartaSans_500Medium,
          PlusJakartaSans_600SemiBold,
          PlusJakartaSans_700Bold,
          PlusJakartaSans_800ExtraBold,
        },
  );

  useEffect(() => {
    if (fontsLoaded || fontError) void SplashScreen.hideAsync();
  }, [fontError, fontsLoaded]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <AppProviders>
      <SessionGate>
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: colors.background },
            animation: "slide_from_right",
          }}
        >
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="check-in" />
          <Stack.Screen name="check-out" />
          <Stack.Screen name="result" options={{ animation: "fade" }} />
          <Stack.Screen name="riwayat/[id]" />
          <Stack.Screen name="izin/index" />
          <Stack.Screen name="izin/baru" />
          <Stack.Screen name="+not-found" />
        </Stack>
      </SessionGate>
    </AppProviders>
  );
}
