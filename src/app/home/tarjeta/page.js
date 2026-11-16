import { redirect } from "next/navigation";

// «Diseña tu tarjeta» era una página aparte; desde el 16-11-2026 es el recorrido
// entero de /home (donde además se prueba y se guarda). Se deja la ruta para que los
// enlaces y favoritos de antes no den 404.
export default function DisenaTuTarjeta() {
  redirect("/home");
}
