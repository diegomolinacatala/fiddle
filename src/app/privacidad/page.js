import { getNegocio } from "@/lib/store";
import { esSlug } from "@/lib/negocios";
import { VERSION_AVISO_TEXTO, MESES_SIN_USO, DIAS_BAJA_TIENDA, SUBENCARGADOS } from "@/lib/legal";
import { C, pagina, panel, titulo, h2 } from "@/app/ui";

export const dynamic = "force-dynamic";
export const metadata = { title: "Privacidad", robots: { index: true, follow: false } };

// ============================================================================
// AVISO DE PRIVACIDAD (lo que ve el cliente)
// ----------------------------------------------------------------------------
// Una página para todas las tiendas. Con ?b=<slug> dice quién es la tienda (su
// nombre y, si el admin los puso, razón social, NIF, dirección y email: art.
// 13.1.a), que es la RESPONSABLE de los datos de sus clientes; fiddle es el
// ENCARGADO que los trata por ella. Se enlaza desde la landing de la tienda, la
// tarjeta web, el reverso del pase y "Tu tarjeta y tus datos".
//
// Los plazos y los proveedores salen de lib/legal.js, los mismos números que
// cumple la pasada diaria. Si cambia lo que dice esta página, subir allí
// VERSION_AVISO: cada tarjeta guarda la versión que vio al darse de alta.
// Nunca prometer aquí algo que el código no hace.
// ============================================================================

export default async function Privacidad({ searchParams }) {
  const { b } = await searchParams;
  const n = esSlug(b) ? await getNegocio(b).catch(() => null) : null;
  const tienda = n?.nombre || "la tienda que te dio la tarjeta";
  const legal = n?.legal || null;
  // Dónde ejercer los derechos: el email de la tienda; si no, el de la plataforma.
  const contacto = legal?.email || process.env.CONTACTO_PRIVACIDAD?.trim() || null;

  return (
    <main style={pagina}>
      <article style={{ width: "min(720px, 100%)", lineHeight: 1.6, fontSize: 15 }}>
        <h1 style={titulo}>Privacidad de tu tarjeta{n ? ` de ${n.nombre}` : ""}</h1>
        <p style={{ color: C.tenue, fontSize: 13, margin: "6px 0 20px" }}>Última actualización: {VERSION_AVISO_TEXTO}</p>

        <section style={seccion}>
          <p style={{ marginTop: 0 }}>
            La tarjeta de fidelización de {tienda} funciona con <strong>fiddle</strong>. Aquí
            explicamos qué datos se guardan, para qué y qué puedes hacer con ellos. En resumen:
            guardamos lo mínimo para contar tus sellos y avisarte, <strong>no pedimos email ni
            teléfono</strong>, no hay publicidad de terceros y no vendemos datos a nadie.
          </p>
          <p style={{ marginBottom: 0 }}>
            Desde tu tarjeta puedes <strong>dejar de recibir promos, descargar tus datos o
            borrarla</strong>: en Apple Wallet, toca la (i) y «Promos, descargar o borrar»; en Google
            Wallet o en la tarjeta web, «Tu tarjeta y tus datos».
          </p>
        </section>

        <section style={seccion}>
          <h2 style={h2}>Quién es responsable</h2>
          <p style={{ marginBottom: legal ? 6 : undefined }}>
            <strong>{n ? n.nombre : "Cada tienda"}</strong> es responsable de los datos de sus
            clientes. <strong>fiddle</strong> presta el servicio técnico y los trata solo por encargo
            de la tienda y para lo que se describe aquí.
          </p>
          {legal && (
            <p style={{ margin: 0, color: C.suave, fontSize: 14 }}>
              {[legal.razonSocial, legal.nif && `NIF ${legal.nif}`, legal.direccion].filter(Boolean).join(" · ")}
              {legal.email && <>{(legal.razonSocial || legal.nif || legal.direccion) ? " · " : ""}<a href={`mailto:${legal.email}`} style={{ color: C.texto }}>{legal.email}</a></>}
            </p>
          )}
        </section>

        <section style={seccion}>
          <h2 style={h2}>Qué datos guardamos</h2>
          <ul style={lista}>
            <li><strong>Tu tarjeta:</strong> un identificador aleatorio y un código corto de 3 caracteres.</li>
            <li><strong>Tu saldo e historial:</strong> sellos, premios, visitas y sus fechas.</li>
            <li>
              <strong>Tu nombre</strong>, si lo das al sacar la tarjeta o se lo dices a la tienda, para
              que te reconozcan en caja. No sale en tu tarjeta. Se guarda cifrado.
            </li>
            <li><strong>Notas de la tienda</strong> sobre ti, si las apunta (por ejemplo, «siempre a primera hora»). Se guardan cifradas y puedes leerlas.</li>
            <li><strong>Si quieres promos</strong> y qué versión de este aviso había cuando sacaste la tarjeta.</li>
            <li>
              <strong>Datos técnicos para avisarte:</strong> el identificador que Apple Wallet, Google
              Wallet o tu navegador dan para mandar avisos a tu tarjeta. No identifican a una persona.
            </li>
            <li>
              <strong>Protección contra abusos:</strong> una huella irreversible de tu IP para limitar
              intentos repetidos. Se borra en 24 horas. Nunca guardamos la IP.
            </li>
          </ul>
        </section>

        <section style={seccion}>
          <h2 style={h2}>Para qué, y con qué base</h2>
          <ul style={lista}>
            <li>
              <strong>Llevar tu tarjeta</strong>: sumar sellos, darte premios, guardar los que no gastes
              y avisarte de ellos. Es lo que pides al sacarla (art. 6.1.b del RGPD).
            </li>
            <li>
              <strong>Que la tienda vea cómo se usa</strong>: agrupa a los clientes según su ritmo de
              visitas (por ejemplo, quién lleva tiempo sin venir) y puede mandarle un aviso automático
              a ese grupo. Es interés legítimo de la tienda en cuidar a sus clientes (art. 6.1.f). No es
              una decisión automatizada sobre ti: no tiene ningún efecto más allá de un aviso.
            </li>
            <li>
              <strong>Promos de la tienda</strong>: sus ofertas y avisos sobre sus propios productos, a
              quien ya es cliente (art. 21.2 de la LSSI). Vienen de partida y{" "}
              <strong>puedes dejarlas cuando quieras</strong>, gratis, desde tu tarjeta o en la tienda;
              los avisos de tus sellos y premios te siguen llegando.
            </li>
          </ul>
          <p style={{ marginBottom: 0 }}>
            También puedes silenciar todos los avisos desde Apple Wallet, Google Wallet o los ajustes
            del navegador.
          </p>
        </section>

        <section style={seccion}>
          <h2 style={h2}>Cuánto tiempo</h2>
          <ul style={{ ...lista, marginBottom: 0 }}>
            <li>Una tarjeta sin ningún uso en <strong>{MESES_SIN_USO} meses</strong> se borra sola, con sus datos. El historial de más de {MESES_SIN_USO} meses también.</li>
            <li>Si pides borrarla, queda vacía y anulada al momento, y desaparece del todo al día siguiente.</li>
            <li>Si la tienda deja el servicio, sus datos se borran a los <strong>{DIAS_BAJA_TIENDA} días</strong>.</li>
            <li>Las copias de seguridad de la base de datos caducan solas según el plazo de nuestro proveedor.</li>
          </ul>
        </section>

        <section style={seccion}>
          <h2 style={h2}>Con quién se comparte</h2>
          <p>Con nadie para fines propios. Para que el servicio funcione usamos:</p>
          <div style={{ overflowX: "auto" }}>
            <table style={tabla}>
              <thead>
                <tr>{["Quién", "Para qué", "Dónde", "Garantía"].map((t) => <th key={t} style={celdaTitulo}>{t}</th>)}</tr>
              </thead>
              <tbody>
                {SUBENCARGADOS.map((s) => (
                  <tr key={s.quien}>
                    <td style={{ ...celda, fontWeight: 600 }}>{s.quien}</td>
                    <td style={celda}>{s.para}</td>
                    <td style={celda}>{s.donde}</td>
                    <td style={celda}>{s.garantia}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p style={{ marginBottom: 0 }}>
            Reino Unido cuenta con una decisión de adecuación de la Unión Europea. Todos actúan bajo
            contratos de tratamiento de datos con garantías del RGPD.
          </p>
        </section>

        <section style={seccion}>
          <h2 style={h2}>Cookies</h2>
          <p>
            Solo usamos cookies <strong>técnicas</strong>: una recuerda qué tarjeta es la tuya en
            este móvil, para no darte otra al volver a escanear el QR (y para que solo tú puedas
            gestionarla), y otra mantiene la sesión del personal de la tienda. No usamos cookies de
            análisis ni de publicidad, así que no hace falta pedirte permiso para ellas.
          </p>
        </section>

        <section style={seccion}>
          <h2 style={h2}>Tus derechos</h2>
          <p>
            Puedes ver tus datos, corregirlos, borrarlos, llevártelos u oponerte a su uso. Desde tu
            tarjeta («Tu tarjeta y tus datos») puedes descargarlos, dejar las promos o borrarla tú
            mismo.
            {contacto
              ? <> Para lo demás, escribe a <a href={`mailto:${contacto}`} style={{ color: C.texto }}>{contacto}</a> o pídelo en {tienda}.</>
              : <> Para lo demás, pídelo en {tienda}.</>}
            {" "}Para identificar tu tarjeta basta con el código de 3 caracteres que aparece bajo el QR.
          </p>
          <p style={{ marginBottom: 0 }}>
            Si crees que no se han respetado tus derechos, puedes reclamar ante la Agencia Española
            de Protección de Datos (<a href="https://www.aepd.es" style={{ color: C.texto }}>aepd.es</a>).
          </p>
        </section>
      </article>
    </main>
  );
}

const seccion = { ...panel, marginBottom: 14 };
const lista = { margin: "0 0 10px", paddingLeft: 20 };
const tabla = { width: "100%", borderCollapse: "collapse", fontSize: 13.5, lineHeight: 1.4, margin: "0 0 12px", minWidth: 520 };
const celdaTitulo = { textAlign: "left", padding: "6px 8px", borderBottom: `1px solid ${C.borde}`, color: C.suave, fontWeight: 600 };
const celda = { padding: "8px", borderBottom: `1px solid ${C.borde}`, verticalAlign: "top" };
