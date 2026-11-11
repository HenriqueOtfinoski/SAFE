import { blocoErro } from "./ui/erro.js";
import { fecharModais } from "./ui/modal.js";

// Roteamento por hash: "#/pessoas/12/editar?x=1" → { id: "12", query }.

let rotasRegistradas = [];
let alvo = null;
let limpezaAtual = null;
let geracao = 0;
let callback = null;

const DURACAO_SAIDA = 180;

function compilar(padrao) {
  const nomes = [];
  const regex = padrao.replace(/:(\w+)/g, (_, nome) => {
    nomes.push(nome);
    return "([^/]+)";
  });
  return { regex: new RegExp(`^${regex}/?$`), nomes };
}

export function analisarHash(hash) {
  const bruto = (hash || "").replace(/^#/, "");
  const [caminhoBruto, busca = ""] = bruto.split("?");
  const caminho = !caminhoBruto || caminhoBruto === "/" ? "/painel" : caminhoBruto;
  return { caminho, query: new URLSearchParams(busca) };
}

// Um "%" solto no endereço não pode derrubar a navegação.
function decodificar(texto) {
  try {
    return decodeURIComponent(texto);
  } catch {
    return texto;
  }
}

function encontrar(caminho) {
  for (const rota of rotasRegistradas) {
    const m = rota.compilado.regex.exec(caminho);
    if (m) {
      const params = {};
      rota.compilado.nomes.forEach((nome, i) => (params[nome] = decodificar(m[i + 1])));
      return { rota, params };
    }
  }
  return null;
}

function marcarNavegacao(caminho) {
  const secao = caminho.split("/")[1] || "painel";
  document.querySelectorAll("[data-route]").forEach((link) => {
    if (link.dataset.route === secao) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  });
}

async function resolver() {
  const minhaGeracao = ++geracao;
  const { caminho, query } = analisarHash(location.hash);
  const achado = encontrar(caminho);
  const rota = achado?.rota ?? rotasRegistradas.naoEncontrado;
  const params = { ...(achado?.params ?? {}), query };

  if (typeof limpezaAtual === "function") {
    try {
      limpezaAtual();
    } catch (e) {
      console.error(e);
    }
  }
  limpezaAtual = null;
  fecharModais();

  marcarNavegacao(caminho);

  // Saída da tela atual: 180 ms (em paralelo com o carregamento da próxima).
  const reduzido = document.documentElement.classList.contains("movimento-reduzido");
  const temConteudo = alvo.childElementCount > 0;
  if (temConteudo) alvo.classList.add("saindo");
  const espera = temConteudo && !reduzido ? new Promise((ok) => setTimeout(ok, DURACAO_SAIDA)) : Promise.resolve();
  // A API serve também os módulos: com ela fora do ar o import falha. Nesse caso a tela
  // mostra um erro com nova tentativa, em vez de ficar em branco.
  let modulo = null;
  let falha = null;
  try {
    [modulo] = await Promise.all([rota.view(), espera]);
  } catch (erro) {
    falha = erro;
    await espera;
  }
  if (minhaGeracao !== geracao) return;

  alvo.replaceChildren();
  window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  alvo.classList.remove("saindo");

  if (!falha) {
    try {
      limpezaAtual = modulo.render(alvo, params) || null;
    } catch (erro) {
      falha = erro;
      alvo.replaceChildren();
    }
  }
  if (falha) {
    console.warn("Falha ao abrir a tela:", falha?.message || falha);
    const pagina = document.createElement("div");
    pagina.className = "pagina";
    pagina.append(blocoErro("Não foi possível carregar esta tela. Verifique se a API está no ar.", recarregarRota));
    alvo.append(pagina);
  }

  // Não rouba o foco se a tela já o colocou em um campo.
  if (!alvo.contains(document.activeElement) || document.activeElement === alvo) alvo.focus({ preventScroll: true });
  callback?.({ caminho, params });
}

export function iniciarRouter(container, rotas, { naoEncontrado, aoNavegar } = {}) {
  alvo = container;
  callback = aoNavegar ?? null;
  rotasRegistradas = rotas.map((r) => ({ ...r, compilado: compilar(r.padrao) }));
  rotasRegistradas.naoEncontrado = { view: naoEncontrado };
  window.addEventListener("hashchange", resolver);
  if (!location.hash) {
    // Em contextos que bloqueiam o histórico (página embutida), cai para a troca de hash.
    try {
      history.replaceState(null, "", "#/painel");
    } catch {
      location.hash = "#/painel";
      return;
    }
  }
  resolver();
}

export function navegar(hash) {
  if (location.hash === hash) resolver();
  else location.hash = hash;
}

export function recarregarRota() {
  resolver();
}
