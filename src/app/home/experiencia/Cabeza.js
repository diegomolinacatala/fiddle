// El título y la pista de un paso. `data-titulo` es a donde va el foco al cambiar de paso.
export default function Cabeza({ titulo, pista, nivel = 2 }) {
  const Titulo = `h${nivel}`;
  return (
    <div className="prob-cabeza">
      <Titulo data-titulo tabIndex={-1}>{titulo}</Titulo>
      {pista && <p>{pista}</p>}
    </div>
  );
}
