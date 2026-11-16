import Tareas from "@/app/admin/Tareas";

// El tablero de tareas, a pantalla completa y sin nada del admin alrededor: es una
// cosa aparte que vive aquí por comodidad (ver app/admin/Tareas.js). Solo el admin:
// el middleware guarda todo /admin y la API vuelve a comprobarlo.
export const metadata = { title: "Tareas · fiddle" };

export default function PaginaDeTareas() {
  return <Tareas />;
}
