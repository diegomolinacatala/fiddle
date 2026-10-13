import { cache } from "react";
import { cookies } from "next/headers";
import { getNegocio } from "@/lib/store";
import { COOKIE } from "@/lib/auth";
import { sesionDeCookie } from "@/lib/sesionVigente";

// El layout (metadatos, viewport y la cabecera) y la página piden el mismo
// negocio: con un solo `cache` compartido es una lectura de la base por
// petición, no tres.
export const negocioDePeticion = cache((slug) => getNegocio(slug));

// Lo mismo con la sesión: el layout la mira para saber si pone la cabecera del
// dueño y la página para dejar entrar. Una comprobación por petición.
export const sesionDePeticion = cache(async () => sesionDeCookie((await cookies()).get(COOKIE)?.value));
