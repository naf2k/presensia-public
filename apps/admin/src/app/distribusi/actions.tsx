"use client";

import { useState } from "react";

import { Icon } from "../../components/ui/icon";
import { toast } from "../../components/ui/toast";
import { copyTextToClipboard } from "../install/copy-text";

// Aksi halaman distribusi: salin tautan QR + unduh QR sebagai PNG siap cetak.
// AdminShell sudah memasang <Toaster/>, jadi toast aman dipakai di sini.
export function DistribusiActions({ installUrl }: { installUrl: string }) {
  const [copied, setCopied] = useState(false);

  const copyInstallUrl = async () => {
    if (await copyTextToClipboard(installUrl)) {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 3000);
    } else {
      toast.error("Gagal menyalin — salin manual dari kolom tujuan QR.");
    }
  };

  const downloadPng = () => {
    const svg = document.getElementById("qr-presensia")?.querySelector("svg");
    if (!svg) {
      toast.error("QR belum tampil — muat ulang halaman lalu coba lagi.");
      return;
    }
    const blob = new Blob([new XMLSerializer().serializeToString(svg)], {
      type: "image/svg+xml;charset=utf-8",
    });
    const objectUrl = URL.createObjectURL(blob);
    const image = new Image();
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      toast.error("Gagal membuat PNG — coba lagi.");
    };
    image.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = 1024;
      canvas.height = 1024;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, 1024, 1024);
      ctx.drawImage(image, 0, 0, 1024, 1024);
      URL.revokeObjectURL(objectUrl);
      const link = document.createElement("a");
      link.download = "qr-presensia-install.png";
      link.href = canvas.toDataURL("image/png");
      // Safari mengabaikan klik pada anchor yang lepas dari dokumen.
      document.body.appendChild(link);
      link.click();
      link.remove();
    };
    image.src = objectUrl;
  };

  return (
    <div className="heading-actions">
      <button type="button" className="btn-ui btn-secondary-ui" onClick={copyInstallUrl}>
        <Icon name="daftar" />
        {copied ? "Tautan tersalin!" : "Salin tautan"}
      </button>
      <button type="button" className="btn-ui btn-primary-ui" onClick={downloadPng}>
        <Icon name="unduh" />
        Unduh QR (PNG)
      </button>
    </div>
  );
}
