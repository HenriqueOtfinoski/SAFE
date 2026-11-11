// Inclinação 3D que acompanha o ponteiro. Devolve a função que desfaz o efeito.

import { podeUsarEfeitosDePonteiro } from "./cursor.js";

export function aplicarTilt(el, { max = 6 } = {}) {
  if (!el || !podeUsarEfeitosDePonteiro()) return () => {};

  function mover(e) {
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return;
    const px = (e.clientX - r.left) / r.width - 0.5;
    const py = (e.clientY - r.top) / r.height - 0.5;
    el.style.transform = `perspective(900px) rotateX(${(-py * 2 * max).toFixed(2)}deg) rotateY(${(px * 2 * max).toFixed(2)}deg)`;
  }

  function sair() {
    el.style.transform = "";
  }

  el.addEventListener("pointermove", mover);
  el.addEventListener("pointerleave", sair);

  return () => {
    el.removeEventListener("pointermove", mover);
    el.removeEventListener("pointerleave", sair);
    el.style.transform = "";
  };
}
