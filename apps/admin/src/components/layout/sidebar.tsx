"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@presensia/utils";
import { Icon, type IconName } from "../ui/icon";
import { useDashboard } from "../../lib/queries";
import { useAdminAuth } from "../../lib/auth";
import { friendlyError } from "../../lib/errors";
import { toast } from "../ui/toast";

interface NavEntry {
  href: string;
  label: string;
  icon: IconName;
  count?: number;
  match: (path: string) => boolean;
}

const WORKSPACE_NAV: NavEntry[] = [
  { href: "/", label: "Dashboard", icon: "dashboard", match: (p) => p === "/" },
  { href: "/peserta", label: "Peserta", icon: "peserta", match: (p) => p.startsWith("/peserta") },
  {
    href: "/institusi",
    label: "Institusi",
    icon: "gedung",
    match: (p) => p.startsWith("/institusi"),
  },
  {
    href: "/kehadiran",
    label: "Kehadiran",
    icon: "kehadiran",
    match: (p) => p.startsWith("/kehadiran"),
  },
  { href: "/jurnal", label: "Jurnal", icon: "jurnal", match: (p) => p.startsWith("/jurnal") },
  {
    href: "/izin-sakit",
    label: "Izin & Sakit",
    icon: "izin",
    match: (p) => p.startsWith("/izin-sakit"),
  },
  { href: "/laporan", label: "Laporan", icon: "laporan", match: (p) => p.startsWith("/laporan") },
];

const SYSTEM_NAV: NavEntry[] = [
  {
    href: "/pengaturan",
    label: "Pengaturan",
    icon: "pengaturan",
    match: (p) => p === "/pengaturan" || p === "/audit-log",
  },
  {
    href: "/distribusi",
    label: "Distribusi",
    icon: "unduh",
    match: (p) => p === "/distribusi",
  },
  { href: "/login", label: "Keluar", icon: "keluar", match: () => false },
];

export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const router = useRouter();
  const auth = useAdminAuth();
  const dashboard = useDashboard();
  // Prototype: dashboard tidak menampilkan item Keluar; halaman lain menampilkannya.
  const systemNav = pathname === "/" ? SYSTEM_NAV.slice(0, 1) : SYSTEM_NAV;

  const renderItem = (item: NavEntry) => {
    if (item.label === "Keluar") {
      return (
        <button
          key={item.href}
          type="button"
          className="nav-item"
          onClick={async () => {
            try {
              await auth.signOut();
              onNavigate?.();
              router.replace("/login");
            } catch (error) {
              toast.error(friendlyError(error));
            }
          }}
        >
          <Icon name={item.icon} />
          <span>{item.label}</span>
        </button>
      );
    }
    const active = item.match(pathname);
    return (
      <Link
        key={item.href}
        href={item.href}
        onClick={onNavigate}
        aria-current={active ? "page" : undefined}
        className={cn("nav-item", active && "is-active")}
      >
        <Icon name={item.icon} />
        <span>{item.label}</span>
        {item.label === "Izin & Sakit" && dashboard.data ? (
          <span className="nav-count">{dashboard.data.summary.pendingLeaves}</span>
        ) : item.count !== undefined ? (
          <span className="nav-count">{item.count}</span>
        ) : null}
      </Link>
    );
  };

  return (
    <aside className="sidebar" aria-label="Navigasi utama">
      <div className="brand">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.svg" width={44} height={44} alt="" />
        <div>
          <strong>Presensia</strong>
          <span>Admin PKL &amp; Magang</span>
        </div>
      </div>

      <nav className="side-nav">
        <p className="nav-label">Ruang kerja</p>
        {WORKSPACE_NAV.map(renderItem)}
        <p className="nav-label nav-label-spaced">Sistem</p>
        {systemNav.map(renderItem)}
      </nav>

      <div className="sidebar-foot">
        <div className="location-mark">
          <Icon name="lokasi" />
        </div>
        <div>
          <strong>Lokasi aktif</strong>
          <span>
            {dashboard.data
              ? `${dashboard.data.settings.location_name} · ${dashboard.data.settings.radius_meters} m`
              : "Memuat lokasi..."}
          </span>
        </div>
      </div>
    </aside>
  );
}
