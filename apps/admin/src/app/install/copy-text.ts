// Salin teks ke clipboard. Mengembalikan true bila berhasil.
// Dipakai tombol salin di halaman /install (publik) dan /distribusi (admin).
export async function copyTextToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
