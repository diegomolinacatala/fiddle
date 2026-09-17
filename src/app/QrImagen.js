"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";

// QR generado EN EL NAVEGADOR. Antes se pedía a api.qrserver.com, lo que
// mandaba el serial del cliente (su identidad) a un tercero.
export default function QrImagen({ texto, lado = 170, style }) {
  const [src, setSrc] = useState(null);

  useEffect(() => {
    if (!texto) return;
    let vivo = true;
    QRCode.toDataURL(texto, { width: lado * 2, margin: 1, errorCorrectionLevel: "M" })
      .then((url) => vivo && setSrc(url))
      .catch(() => vivo && setSrc(null));
    return () => { vivo = false; };
  }, [texto, lado]);

  if (!src) return <div style={{ width: lado, height: lado, ...style }} />;
  return <img src={src} alt="Código QR" width={lado} height={lado} style={style} />;
}
