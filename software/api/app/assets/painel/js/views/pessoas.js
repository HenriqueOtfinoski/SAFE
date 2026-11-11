import { contarImagens, listarTodasPessoas, urlImagem } from "../api.js";
import { obterCena } from "../cena/cena.js";
import { formatarData, h, icone, iniciais, normalizar } from "../dom.js";
import { dividirLetras } from "../efeitos/letras.js";
import { aplicarTilt } from "../efeitos/tilt.js";
import { blocoErro } from "../ui/erro.js";

export function render(container, params) {
  let vivo = true;
  let tilts = [];
  const semFoto = params.query.get("filtro") === "sem-foto";
  let pessoas = [];
  let contagem = new Map();

  obterCena().enquadrar("pessoas");

  const titulo = h("h1", { class: "titulo-pagina" }, "Pessoas");
  dividirLetras(titulo, { revelar: true });
  const contador = h("span", { class: "badge", "aria-label": "Total de pessoas" }, "…");
  const busca = h("input", {
    class: "input",
    type: "search",
    placeholder: "Buscar por nome, identificador ou e-mail",
    "aria-label": "Buscar pessoas",
    autocomplete: "off",
  });
  const lista = h("div", { class: "panel panel--flush" });
  const statusBusca = h("p", { class: "sr-only", "aria-live": "polite" });

  busca.addEventListener("input", desenhar);

  container.append(
    h(
      "div",
      { class: "pagina" },
      h(
        "header",
        { class: "page-head" },
        h(
          "div",
          {},
          h("span", { class: "eyebrow" }, "Cadastros"),
          h("div", { class: "titulo-linha" }, titulo, contador),
          h("p", { class: "lede" }, "Pessoas autorizadas e suas fotos de referência para o reconhecimento facial."),
        ),
        h("a", { class: "btn btn--primary", href: "#/pessoas/nova" }, icone("mais"), "Nova pessoa"),
      ),
      h(
        "div",
        { class: "toolbar" },
        h("div", { class: "search" }, icone("busca"), busca),
        h(
          "nav",
          { class: "segmented", "aria-label": "Filtro" },
          h("a", { href: "#/pessoas", "aria-current": semFoto ? "false" : "true" }, "Todas"),
          h("a", { href: "#/pessoas?filtro=sem-foto", "aria-current": semFoto ? "true" : "false" }, "Sem foto"),
        ),
      ),
      lista,
      statusBusca,
    ),
  );

  function limparTilts() {
    tilts.forEach((fn) => fn());
    tilts = [];
  }

  function esqueleto() {
    lista.replaceChildren(
      ...Array.from({ length: 4 }, () =>
        h("div", { class: "skeleton-row" }, h("span", { class: "skeleton" }), h("span", { class: "skeleton", style: { width: "40%" } })),
      ),
    );
  }

  async function carregar() {
    esqueleto();
    try {
      pessoas = await listarTodasPessoas();
      contagem = await contarImagens(pessoas);
      if (!vivo) return;
      desenhar();
    } catch (erro) {
      if (!vivo) return;
      contador.textContent = "—";
      lista.replaceChildren(h("div", { style: { padding: "18px" } }, blocoErro(erro.mensagem || "Falha ao carregar pessoas.", carregar)));
    }
  }

  function desenhar() {
    limparTilts();
    contador.textContent = String(pessoas.length);

    if (pessoas.length === 0) {
      lista.replaceChildren(
        h(
          "div",
          { class: "empty" },
          h("h2", {}, "Nenhuma pessoa cadastrada"),
          h("p", {}, "Cadastre a primeira pessoa autorizada e envie as fotos dela."),
          h("a", { class: "btn btn--primary", href: "#/pessoas/nova" }, "Cadastrar pessoa"),
        ),
      );
      return;
    }

    const termo = normalizar(busca.value.trim());
    const visiveis = pessoas.filter((p) => {
      if (semFoto && (contagem.get(p.id)?.total ?? 0) > 0) return false;
      if (!termo) return true;
      return normalizar(`${p.nome} ${p.identificador} ${p.email ?? ""}`).includes(termo);
    });

    statusBusca.textContent = `${visiveis.length} ${visiveis.length === 1 ? "pessoa" : "pessoas"} na lista`;

    if (visiveis.length === 0) {
      const mensagem = termo
        ? `Nada encontrado para “${busca.value.trim()}”.`
        : "Todas as pessoas já têm ao menos uma foto.";
      lista.replaceChildren(h("div", { class: "empty" }, h("p", {}, mensagem)));
      return;
    }

    const linhas = visiveis.map((p) => linha(p, contagem.get(p.id)));
    lista.replaceChildren(h("ul", { class: "people" }, linhas.map((el) => h("li", {}, el))));
    tilts = linhas.map((el) => aplicarTilt(el, { max: 2.5 }));
  }

  carregar();
  return () => {
    vivo = false;
    limparTilts();
  };
}

export function avatar(pessoa, info, classe = "avatar") {
  if (info?.primeira != null) {
    return h("img", {
      class: classe,
      src: urlImagem(pessoa.id, info.primeira),
      alt: "",
      loading: "lazy",
      decoding: "async",
    });
  }
  return h("span", { class: classe, "aria-hidden": "true" }, iniciais(pessoa.nome));
}

function linha(p, info) {
  const total = info?.total ?? 0;
  return h(
    "a",
    { class: "person", href: `#/pessoas/${p.id}` },
    avatar(p, info),
    h("span", { style: { minWidth: 0 } }, h("span", { class: "person__name", style: { display: "block" } }, p.nome), h("span", { class: "person__id", style: { display: "block" } }, `#${p.id} · ${p.identificador}`)),
    h("span", { class: "person__email" }, p.email || "—"),
    h("span", { class: ["badge", total === 0 ? "badge--warn" : "badge--ok"] }, total === 1 ? "1 foto" : `${total} fotos`),
    h("span", { class: "person__date" }, formatarData(p.data_registro)),
  );
}
