"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, type FormEvent } from "react";
import { Avatar } from "../ui/avatar";
import { Icon } from "../ui/icon";
import { useAdminAuth } from "../../lib/auth";
import { friendlyError } from "../../lib/errors";
import { toast } from "../ui/toast";

export function Topbar({
  title,
  subtitle,
  onMenu,
  withSearch,
  profileChevron,
  withNotif = true,
}: {
  title: string;
  subtitle: string;
  onMenu: () => void;
  withSearch?: boolean;
  profileChevron?: boolean;
  withNotif?: boolean;
}) {
  const router = useRouter();
  const auth = useAdminAuth();
  const name = auth.profile?.fullName ?? "Administrator";
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const search = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const query = searchRef.current?.value.trim() ?? "";
    router.push(query ? `/peserta?query=${encodeURIComponent(query)}` : "/peserta");
  };

  const logout = async () => {
    try {
      await auth.signOut();
      router.replace("/login");
    } catch (error) {
      toast.error(friendlyError(error));
    }
  };

  return (
    <header className="topbar">
      <div className="topbar-title">
        <button type="button" className="menu-button" onClick={onMenu} aria-label="Buka navigasi">
          <Icon name="menu" />
        </button>
        <div>
          <h1>{title}</h1>
          <p>{subtitle}</p>
        </div>
      </div>
      <div className="topbar-actions">
        {withSearch ? (
          <form className="quick-search" onSubmit={search} role="search">
            <span className="sr-only">Cari peserta</span>
            <Icon name="cari" />
            <input
              ref={searchRef}
              type="search"
              placeholder="Cari peserta..."
              aria-label="Cari peserta"
            />
            <kbd>⌘ K</kbd>
          </form>
        ) : null}
        {withNotif ? (
          <Link
            className="icon-button"
            href="/izin-sakit"
            aria-label="Notifikasi: buka pengajuan menunggu"
          >
            <Icon name="notif" />
            <span className="notification-dot" aria-hidden="true" />
          </Link>
        ) : null}
        <button
          type="button"
          className="profile-button"
          aria-label={`Keluar dari akun ${name}`}
          onClick={logout}
        >
          <Avatar name={name} variant="av-rose" />
          <span className="profile-copy">
            <strong>{name}</strong>
            <small>Administrator</small>
          </span>
          {profileChevron ? <Icon name="chevronDown" /> : null}
        </button>
      </div>
    </header>
  );
}
