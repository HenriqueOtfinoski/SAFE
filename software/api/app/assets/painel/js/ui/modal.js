import { h, icone } from "../dom.js";

const FOCAVEIS =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

let contador = 0;
const abertos = new Set();

// Fecha tudo que estiver aberto (o router chama na troca de rota, para um modal de
// confirmação nunca agir sobre uma tela que já saiu).
export function fecharModais() {
  for (const fechar of [...abertos]) fechar();
}

export function abrirModal({ titulo, conteudo, acoes = [], largo = false, aoFechar } = {}) {
  const gatilho = document.activeElement;
  const idTitulo = `modal-titulo-${++contador}`;

  const botaoFechar = h(
    "button",
    { type: "button", class: "modal__close", "aria-label": "Fechar" },
    icone("fechar"),
  );

  const modal = h(
    "div",
    { class: ["modal", largo && "modal--wide"], role: "dialog", "aria-modal": "true", "aria-labelledby": idTitulo },
    h("div", { class: "modal__head" }, h("h2", { id: idTitulo }, titulo), botaoFechar),
    h("div", { class: "modal__body" }, conteudo),
    acoes.length ? h("div", { class: "modal__foot" }, acoes) : null,
  );

  const fundo = h("div", { class: "modal-backdrop" }, modal);
  let fechado = false;

  function fechar() {
    if (fechado) return;
    fechado = true;
    abertos.delete(fechar);
    document.removeEventListener("keydown", teclado, true);
    fundo.remove();
    if (gatilho && typeof gatilho.focus === "function" && document.contains(gatilho)) gatilho.focus();
    aoFechar?.();
  }

  function teclado(e) {
    if (e.key === "Escape") {
      e.preventDefault();
      fechar();
      return;
    }
    if (e.key !== "Tab") return;
    const itens = [...modal.querySelectorAll(FOCAVEIS)];
    if (itens.length === 0) return;
    const primeiro = itens[0];
    const ultimo = itens[itens.length - 1];
    if (e.shiftKey && document.activeElement === primeiro) {
      e.preventDefault();
      ultimo.focus();
    } else if (!e.shiftKey && document.activeElement === ultimo) {
      e.preventDefault();
      primeiro.focus();
    } else if (!modal.contains(document.activeElement)) {
      e.preventDefault();
      primeiro.focus();
    }
  }

  botaoFechar.addEventListener("click", fechar);
  fundo.addEventListener("mousedown", (e) => {
    if (e.target === fundo) fechar();
  });
  document.addEventListener("keydown", teclado, true);
  document.body.appendChild(fundo);
  abertos.add(fechar);

  const alvo = modal.querySelector("[data-autofocus]") || modal.querySelector(".modal__foot " + FOCAVEIS) || botaoFechar;
  alvo.focus();

  return { fechar, elemento: modal };
}

export function confirmar({ titulo, mensagem, rotuloConfirmar = "Confirmar", perigo = false }) {
  return new Promise((resolver) => {
    let resposta = false;
    const cancelar = h("button", { type: "button", class: "btn btn--ghost", "data-autofocus": "" }, "Cancelar");
    const ok = h(
      "button",
      { type: "button", class: ["btn", perigo ? "btn--danger-solid" : "btn--primary"] },
      rotuloConfirmar,
    );

    const conteudo = mensagem instanceof Node ? mensagem : h("p", {}, mensagem);
    const m = abrirModal({ titulo, conteudo, acoes: [cancelar, ok], aoFechar: () => resolver(resposta) });

    cancelar.addEventListener("click", () => m.fechar());
    ok.addEventListener("click", () => {
      resposta = true;
      m.fechar();
    });
  });
}
