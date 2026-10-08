import { useRouter } from "expo-router";
import { PageState, Screen } from "@/src/ui";

export default function NotFoundScreen() {
  const router = useRouter();
  return (
    <Screen>
      <PageState
        icon="compass-outline"
        title="Halaman tidak ditemukan"
        copy="Tautan yang kamu buka sudah tidak tersedia atau sudah dipindahkan."
        actionLabel="Kembali ke Beranda"
        action={() => router.replace("/")}
      />
    </Screen>
  );
}
