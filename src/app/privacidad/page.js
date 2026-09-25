import { getNegocio } from "@/lib/store";
import { esSlug } from "@/lib/negocios";
import { C, pagina, panel, titulo, h2 } from "@/app/ui";

export const dynamic = "force-dynamic";
export const metadata = { title: "Privacidad", robots: { index: true, follow: false } };

// ============================================================================
// AVISO DE PRIVACIDAD (lo que ve el cliente)
// ----------------------------------------------------------------------------
// Una página para todas las tiendas. Con ?b=<slug> dice el nombre de la tienda,
// que es la RESPONSABLE de los datos de sus clientes; fiddle es el ENCARGADO que
// los trata por ella. Se enlaza desde la landing de la tienda, la tarjeta web y
// el reverso del pase.
//
// Si cambia lo que se guarda (ver docs/PRIVACIDAD.md), esta página cambia con
// ello y su fecha también. Nunca prometer aquí algo que el código no hace.
// ============================================================================

const ACTUALIZADO = "25 de septiembre de 2026";

export default async function Privacidad({ searchParams }) {
  const { b } = await searchParams;
  const n = esSlug(b) ? await getNegocio(b).catch(() => null) : null;
  const tienda = n?.nombre || "la tienda que te dio la tarjeta";
  const contacto = process.env.CONTACTO_PRIVACIDAD?.trim() || null;

  return (
    <main style={pagina}>
      <article style={{ width: "min(720px, 94vw)", lineHeight: 1.6, fontSize: 15 }}>
        <h1 style={titulo}>Privacidad de tu tarjeta{n ? ` de ${n.nombre}` : ""}</h1>
        <p style={{ color: C.tenue, fontSize: 13, margin: "6px 0 20px" }}>Última actualización: {ACTUALIZADO}</p>

        <section style={seccion}>
          <p style={{ marginTop: 0 }}>
            La tarjeta de fidelización de {tienda} funciona con <strong>fiddle</strong>. Aquí
            explicamos qué datos se guardan, para qué y qué puedes hacer con ellos. En resumen:
            guardamos lo mínimo para contar tus sellos y avisarte, <strong>no pedimos email ni
            teléfono</strong>, no hay publicidad de terceros y no vendemos datos a nadie.
          </p>
        </section>

        <section style={seccion}>
          <h2 style={h2}>Quién es responsable</h2>
          <p>
            <strong>{n ? n.nombre : "Cada tienda"}</strong> es responsable de los datos de sus
            clientes. <strong>fiddle</strong> presta el servicio
            técnico y los trata solo por encargo de la tienda y para lo que se describe aquí.
          </p>
        </section>

        <section style={seccion}>
          <h2 style={h2}>Qué datos guardamos</h2>
          <ul style={lista}>
            <li><strong>Tu tarjeta:</strong> un identificador aleatorio y un código corto de 3 caracteres.</li>
            <li><strong>Tu saldo e historial:</strong> sellos, premios, visitas y sus fechas.</li>
            <li><strong>Tu nombre:</strong> el que escribes al sacar la tarjeta, para que la tienda te reconozca. Se guarda cifrado.</li>
            <li><strong>Notas de la tienda</strong> sobre ti, si las apunta (por ejemplo, una preferencia). Se guardan cifradas.</li>
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
          <h2 style={h2}>Para qué</h2>
          <ul style={lista}>
            <li>Llevar tu tarjeta: sumar sellos, darte premios y guardar los que no gastes.</li>
            <li>Actualizar la tarjeta en tu móvil y avisarte de sellos, premios y promociones de la tienda.</li>
            <li>Que la tienda vea cómo se usa su tarjeta (visitas, frecuencia) para mejorar su programa.</li>
          </ul>
          <p>
            La base legal es el propio programa de fidelización al que te apuntas al añadir la
            tarjeta. Los avisos de promociones solo te llegan si tienes la tarjeta en el móvil con
            los avisos activados; puedes desactivarlos cuando quieras desde Apple Wallet, Google
            Wallet o los ajustes del navegador.
          </p>
        </section>

        <section style={seccion}>
          <h2 style={h2}>Cuánto tiempo</h2>
          <p>
            Mientras tu tarjeta siga en uso. Puedes pedir que la borremos en cualquier momento (abajo
            explicamos cómo). Si la tienda deja el servicio, sus datos se borran.
          </p>
        </section>

        <section style={seccion}>
          <h2 style={h2}>Con quién se comparte</h2>
          <p>Con nadie para fines propios. Para que el servicio funcione usamos:</p>
          <ul style={lista}>
            <li><strong>Supabase</strong> (base de datos, alojada en Londres) y <strong>Vercel</strong> (servidor web, en Londres).</li>
            <li><strong>Apple</strong> y <strong>Google</strong>, solo para entregar la tarjeta y sus avisos a tu móvil.</li>
          </ul>
          <p>
            Reino Unido cuenta con una decisión de adecuación de la Unión Europea. Estos proveedores
            actúan bajo contratos de tratamiento de datos con garantías del RGPD.
          </p>
        </section>

        <section style={seccion}>
          <h2 style={h2}>Cookies</h2>
          <p>
            Solo usamos cookies <strong>técnicas</strong>: una recuerda qué tarjeta es la tuya en
            este móvil, para no darte otra al volver a escanear el QR, y otra mantiene la sesión
            del personal de la tienda. No usamos cookies de análisis ni de publicidad, así que
            no hace falta pedirte permiso para ellas.
          </p>
        </section>

        <section style={seccion}>
          <h2 style={h2}>Tus derechos</h2>
          <p>
            Puedes pedir ver tus datos, corregirlos, borrarlos, llevártelos u oponerte a su uso.
            {contacto
              ? <> Escríbenos a <a href={`mailto:${contacto}`} style={{ color: C.texto }}>{contacto}</a> o pídelo en {tienda}.</>
              : <> Pídelo en {tienda}.</>}
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
