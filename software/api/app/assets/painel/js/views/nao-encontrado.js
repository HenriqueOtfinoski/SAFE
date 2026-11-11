import { obterCena } from "../cena/cena.js";
import { h } from "../dom.js";
import { dividirLetras } from "../efeitos/letras.js";

export function render(container, _params, { titulo = "Página não encontrada", texto, link = "#/painel", rotulo = "Ir para o Painel" } = {}) {
  obterCena().enquadrar("neutro");
  const tituloEl = h("h2", { class: "titulo-pagina" }, titulo);
  dividirLetras(tituloEl, { revelar: true });
  container.append(
    h(
      "div",
      { class: "pagina" },
      h(
        "section",
        { class: "empty" },
        h("span", { class: "eyebrow" }, "404"),
        tituloEl,
        h("p", {}, texto || "O endereço acessado não existe neste painel."),
        h("a", { class: "btn btn--primary", href: link }, rotulo),
      ),
    ),
  );
}
