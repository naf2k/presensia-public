"use client";

import Link from "next/link";
import { useState } from "react";
import { Avatar, initialsOf } from "../ui/avatar";
import { Modal } from "../ui/states";
import type { AdminParticipant, PhotoTone } from "../../lib/admin-api";
import { useSignedUrl } from "../../lib/queries";
import { ErrorState } from "../ui/states";

export type { PhotoTone } from "../../lib/admin-api";

export function PhotoEvidence({
  participant,
  tone,
  path,
  variant = "button",
}: {
  participant: AdminParticipant;
  tone: PhotoTone;
  path?: string | null;
  variant?: "button" | "thumb";
}) {
  const [open, setOpen] = useState(false);
  const signed = useSignedUrl("attendance-photos", open ? (path ?? null) : null);
  const initials = initialsOf(participant.name);
  return (
    <>
      {variant === "thumb" ? (
        <button
          className={`photo-thumb ${tone}`}
          type="button"
          aria-label={`Lihat bukti foto ${participant.name}`}
          onClick={() => setOpen(true)}
        >
          {initials}
        </button>
      ) : (
        <button
          className="photo-button"
          type="button"
          aria-label={`Lihat bukti foto ${participant.name}`}
          onClick={() => setOpen(true)}
        >
          <span className={`photo-thumb ${tone}`} aria-hidden="true">
            {initials}
          </span>
          <span>Lihat</span>
        </button>
      )}
      {open ? (
        <Modal
          tone="dark"
          title={`Bukti foto — ${participant.name}`}
          description="Foto tersimpan privat dan ditampilkan melalui akses terproteksi."
          onClose={() => setOpen(false)}
        >
          {path && signed.isPending ? (
            <div className="photo-loading" role="status">
              <span className="spinner spinner-small" aria-hidden="true" />
              <p>Memuat foto…</p>
            </div>
          ) : path && signed.isError ? (
            <ErrorState message="Bukti foto tidak dapat dibuka." onRetry={() => signed.refetch()} />
          ) : signed.data ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                className="photo-viewer-img"
                src={signed.data}
                alt={`Bukti foto ${participant.name}`}
              />
              <p className="photo-caption">
                {participant.name} · {participant.institutionShort}
              </p>
            </>
          ) : (
            <div className="photo-empty" role="img" aria-label={`Bukti foto ${participant.name}`}>
              <span aria-hidden="true">{initials}</span>
              <p>Bukti foto tidak tersedia.</p>
            </div>
          )}
        </Modal>
      ) : null}
    </>
  );
}

export function PersonCell({ participant, href }: { participant: AdminParticipant; href?: string }) {
  const name = href ? (
    <Link className="text-link" href={href}>
      {participant.name}
    </Link>
  ) : (
    <strong>{participant.name}</strong>
  );
  return (
    <div className="person">
      <Avatar name={participant.name} variant={participant.avatarVariant} />
      <div>
        {name}
        <span>
          {participant.category === "SMK PKL" ? "SMK PKL" : "Mahasiswa"} · {participant.majorShort}
        </span>
      </div>
    </div>
  );
}

export function InstitutionCell({ participant }: { participant: AdminParticipant }) {
  return (
    <>
      <strong className="institution">{participant.institutionShort}</strong>
      <span className="cell-sub">{participant.city}</span>
    </>
  );
}
