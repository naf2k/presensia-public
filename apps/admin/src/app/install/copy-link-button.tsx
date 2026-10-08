"use client";

import { useState } from "react";

import { Icon } from "../../components/ui/icon";
import { copyTextToClipboard } from "./copy-text";

// Tombol salin tautan halaman unduh — umpan balik inline, tanpa Toaster.
export function CopyInstallLink({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  const [failed, setFailed] = useState(false);

  const copyInstallLink = async () => {
    setFailed(false);
    if (await copyTextToClipboard(url)) {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 3000);
    } else {
      setFailed(true);
    }
  };

  return (
    <span className="install-copy">
      <button type="button" className="btn-ui btn-quiet-ui btn-compact" onClick={copyInstallLink}>
        <Icon name={copied ? "cek" : "daftar"} />
        {copied ? "Tautan tersalin!" : "Salin tautan halaman ini"}
      </button>
      {failed ? (
        <span className="field-error" role="alert">
          Gagal menyalin otomatis — salin manual dari kolom alamat browser.
        </span>
      ) : null}
    </span>
  );
}
