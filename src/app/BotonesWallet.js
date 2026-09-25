// Los botones de Wallet son los oficiales, sin tocar: ni Apple ni Google dejan
// cambiarles color, radio ni texto, y Google lo revisa antes de dar acceso de
// publicación (tests/marcas.test.js). Se escalan enteros, nunca estirados.
//
// Google pide 8 px libres alrededor y Apple una décima parte del alto (5 px):
// los tiene que dar quien los coloca. Van centrados en una rejilla y el radio
// es para que el anillo de foco siga la forma del botón.

// El de Apple en España dice "Cartera de Apple": así se llama Wallet aquí. A 50 px
// de alto, como el de Google, que no puede quedar más pequeño que el de Apple.
export function BotonAppleWallet({ href }) {
  return (
    <a href={href} style={botonMarca}>
      <img src="/marcas/apple-wallet-anadir.svg" alt="Añadir a Cartera de Apple" width={188} height={50} style={{ display: "block" }} />
    </a>
  );
}

// El de Google no puede bajar de 48 px de alto: el ancho (298) no cabe en
// teléfonos de menos de 360 px, y ahí va la versión compacta, que es la que
// Google da para espacios estrechos.
export function BotonGoogleWallet({ href }) {
  return (
    <a href={href} style={botonMarca}>
      <picture>
        <source media="(max-width: 359px)" srcSet="/marcas/google-wallet-anadir-compacto.svg" width={199} height={55} />
        <img src="/marcas/google-wallet-anadir.svg" alt="Añadir a Google Wallet" width={298} height={50} style={{ display: "block" }} />
      </picture>
    </a>
  );
}

const botonMarca = { justifySelf: "center", lineHeight: 0, borderRadius: 12 };
