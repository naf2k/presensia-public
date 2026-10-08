"use client";

import type * as React from "react";

import { useState } from "react";
import { Toaster } from "../ui/toast";
import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";

export function AdminShell({
  title,
  subtitle,
  withSearch,
  profileChevron,
  withNotif,
  children,
}: {
  title: string;
  subtitle: string;
  withSearch?: boolean;
  profileChevron?: boolean;
  withNotif?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <a className="skip" href="#konten-utama">
        Lewati ke konten utama
      </a>
      <div className={open ? "shell-open" : undefined}>
        <Sidebar onNavigate={() => setOpen(false)} />
      </div>
      {open ? (
        <button
          type="button"
          className="nav-scrim"
          aria-label="Tutup navigasi"
          onClick={() => setOpen(false)}
          style={{ display: "block" }}
        />
      ) : null}

      <main className="workspace" id="konten-utama">
        <Topbar
          title={title}
          subtitle={subtitle}
          onMenu={() => setOpen((v) => !v)}
          withSearch={withSearch}
          profileChevron={profileChevron}
          withNotif={withNotif}
        />
        {children}
      </main>
      <Toaster />
    </>
  );
}
