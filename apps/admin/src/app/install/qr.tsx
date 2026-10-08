import QRCode from "react-qr-code";

// Render QR murni SVG — aman dipakai di Server Component maupun client.
// Warna eksplisit + reset CSS di .install-qr melindungi dari gaya svg global.
export function InstallQr({ value, size = 200 }: { value: string; size?: number }) {
  return (
    <div className="install-qr" role="img" aria-label={`Kode QR menuju ${value}`}>
      <QRCode value={value} size={size} bgColor="#FFFFFF" fgColor="#000000" />
    </div>
  );
}
