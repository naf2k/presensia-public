"use client";

import type * as React from "react";

import { createPortal } from "react-dom";
import { useEffect } from "react";
import { Icon } from "./icon";

export function EmptyState({
  title,
  description,
  icon = "info",
}: {
  title: string;
  description?: string;
  icon?: "info" | "lihat" | "jurnal" | "izin";
}) {
  return (
    <div className="empty-state">
      <div>
        <span className="empty-state-icon">
          <Icon name={icon} />
        </span>
        <h3>{title}</h3>
        {description ? <p>{description}</p> : null}
      </div>
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="empty-state">
      <div>
        <span className="empty-state-icon">
          <Icon name="peringatan" />
        </span>
        <h3>Gagal memuat data</h3>
        <p>{message}</p>
        <p style={{ marginTop: 12 }}>
          <button type="button" className="btn-ui btn-secondary-ui" onClick={onRetry}>
            Coba lagi
          </button>
        </p>
      </div>
    </div>
  );
}

export function TableSkeleton({ rows = 5, columns = 6 }: { rows?: number; columns?: number }) {
  return (
    <div aria-hidden="true" style={{ padding: 14 }}>
      {Array.from({ length: rows }, (_, r) => (
        <div key={r} style={{ display: "flex", gap: 10, marginBottom: 10 }}>
          {Array.from({ length: columns }, (_, c) => (
            <div
              key={c}
              className="skeleton"
              style={{ height: 18, flex: c === 0 ? 2 : 1, borderRadius: 6 }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

export function Modal({
  title,
  description,
  onClose,
  children,
  labelledBy,
  tone,
}: {
  title: string;
  description?: string;
  onClose: () => void;
  children: React.ReactNode;
  labelledBy?: string;
  /** "dark" = penampil foto frameless (tanpa kartu putih). */
  tone?: "light" | "dark";
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  const dark = tone === "dark";
  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={labelledBy ?? "modal-title"}
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 50,
        display: "grid",
        placeItems: "center",
        padding: 20,
        overflow: "auto",
        background: dark ? "rgb(20 18 16 / 0.88)" : "rgb(37 36 33 / 0.55)",
      }}
    >
      <div
        className={dark ? undefined : "surface"}
        role="document"
        onClick={(e) => e.stopPropagation()}
        style={
          dark
            ? { width: "min(480px, 100%)", maxHeight: "90dvh", overflow: "auto" }
            : { width: "min(560px, 100%)", maxHeight: "90dvh", overflow: "auto" }
        }
      >
        {dark ? (
          <>
            <div className="modal-dark-head">
              <div>
                <h3 id={labelledBy ?? "modal-title"}>{title}</h3>
                {description ? <p>{description}</p> : null}
              </div>
              <button type="button" className="action-square" onClick={onClose} aria-label="Tutup">
                <Icon name="tutup" />
              </button>
            </div>
            {children}
          </>
        ) : (
          <>
            <div className="surface-header">
              <div>
                <h3 id={labelledBy ?? "modal-title"}>{title}</h3>
                {description ? <p>{description}</p> : null}
              </div>
              <button type="button" className="action-square" onClick={onClose} aria-label="Tutup">
                <Icon name="tutup" />
              </button>
            </div>
            <div className="surface-body">{children}</div>
          </>
        )}
      </div>
    </div>,
    document.body,
  );
}
