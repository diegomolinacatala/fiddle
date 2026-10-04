import { cache } from "react";
import { getNegocio } from "@/lib/store";

// El layout (metadatos y viewport) y la página piden el mismo negocio: con un
// solo `cache` compartido es una lectura de la base por petición, no tres.
export const negocioDePeticion = cache((slug) => getNegocio(slug));
