// ============================================================================
// LOS TROZOS QUE SE REPITEN EN LA WEB (/home)
// ----------------------------------------------------------------------------
// El punto de los títulos, el encabezado de cada bloque y dos iconos. Sin estado
// ni nada del navegador: valen igual en el servidor y dentro de un componente de
// cliente. Sus estilos están en estilo.js (.punto, .encabezado, .flecha).
// ============================================================================

/** El punto del final de cada título: un sello (camel en claro, avena en oscuro). */
export function Punto() {
  return <span className="punto" aria-hidden="true" />;
}

export function Encabezado({ id, titulo, centrado = false, children }) {
  return (
    <div className={`encabezado revela${centrado ? " encabezado-centro" : ""}`}>
      <h2 id={id} className="titulo-bloque">
        {titulo}
        <Punto />
      </h2>
      {children && <p className="entradilla">{children}</p>}
    </div>
  );
}

/** Un bocadillo de conversación: dice «escribir», sin copiar el logo de WhatsApp. */
export function IconoMensaje() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20.5 11.6a8.4 8.4 0 0 1-12.3 7.4L3.5 20.5l1.6-4.5A8.4 8.4 0 1 1 20.5 11.6z" />
    </svg>
  );
}

export function Flecha() {
  return (
    <svg className="flecha" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}
