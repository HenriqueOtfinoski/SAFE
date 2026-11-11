// Carrega a cabeça de referência (pontos, linhas de contorno e marcos faciais) gerada
// fora do navegador a partir de um modelo 3D. Se algo faltar, devolve null e o rosto
// cai para a versão procedural.

const BASE = new URL("../../modelos/", import.meta.url);

async function binario(nome) {
  const resposta = await fetch(new URL(nome, BASE));
  if (!resposta.ok) throw new Error(`${nome}: ${resposta.status}`);
  const dados = new Int16Array(await resposta.arrayBuffer());
  if (dados.length === 0 || dados.length % 6 !== 0) throw new Error(`${nome}: formato inesperado`);
  return dados;
}

async function json(nome) {
  const resposta = await fetch(new URL(nome, BASE));
  if (!resposta.ok) throw new Error(`${nome}: ${resposta.status}`);
  return resposta.json();
}

export async function carregarModelo() {
  try {
    const [pontos, linhas, marcos] = await Promise.all([
      binario("rosto-pontos.bin"),
      binario("rosto-linhas.bin").catch(() => null),
      json("rosto-marcos.json").catch(() => null),
    ]);
    if (pontos.length < 6 * 500) return null;
    return { pontos, linhas, marcos };
  } catch {
    return null;
  }
}
