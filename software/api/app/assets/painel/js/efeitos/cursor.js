// Cursor de dois anéis. Só com ponteiro fino e sem movimento reduzido;
// sobre campos de texto os anéis somem e o cursor nativo volta.

const INTERATIVO = 'a, button, [role="button"], [role="switch"], label, select, summary, .photo, .dropzone';
const TEXTO = 'input:not([type="checkbox"]):not([type="radio"]):not([type="file"]), textarea, [contenteditable="true"]';
const FATOR = 0.2;

export function podeUsarEfeitosDePonteiro() {
  return window.matchMedia("(pointer: fine)").matches && !document.documentElement.classList.contains("movimento-reduzido");
}

export function iniciarCursor() {
  const interno = document.querySelector(".cursor-interno");
  const externo = document.querySelector(".cursor-externo");
  if (!interno || !externo || !podeUsarEfeitosDePonteiro()) return;

  let x = window.innerWidth / 2;
  let y = window.innerHeight / 2;
  let ex = x;
  let ey = y;
  let visto = false;

  function ocultar(sim) {
    interno.classList.toggle("oculto", sim);
    externo.classList.toggle("oculto", sim);
  }

  window.addEventListener(
    "pointermove",
    (e) => {
      if (e.pointerType === "touch") return;
      x = e.clientX;
      y = e.clientY;
      interno.style.left = `${x}px`;
      interno.style.top = `${y}px`;
      if (!visto) {
        visto = true;
        ex = x;
        ey = y;
        document.documentElement.classList.add("cursor-ativo");
      }
    },
    { passive: true },
  );

  document.addEventListener("pointerover", (e) => {
    const alvo = e.target instanceof Element ? e.target : null;
    if (!alvo) return;
    const emTexto = Boolean(alvo.closest(TEXTO));
    ocultar(emTexto);
    externo.classList.toggle("sobre", !emTexto && Boolean(alvo.closest(INTERATIVO)));
  });

  document.documentElement.addEventListener("pointerleave", () => ocultar(true));
  document.documentElement.addEventListener("pointerenter", () => ocultar(false));

  function quadro() {
    requestAnimationFrame(quadro);
    ex += (x - ex) * FATOR;
    ey += (y - ey) * FATOR;
    externo.style.left = `${ex}px`;
    externo.style.top = `${ey}px`;
  }
  requestAnimationFrame(quadro);
}
