// Revela títulos letra a letra. Só aceita elementos cujo conteúdo é texto puro;
// os caracteres são criados via DOM (nunca innerHTML).

const ATRASO = 0.035;

export function dividirLetras(el, { revelar = false } = {}) {
  if (!el || el.dataset.letras === "1") return;
  if (el.children.length > 0) return; // conteúdo com elementos: deixa como está

  const texto = el.textContent;
  el.dataset.letras = "1";
  el.setAttribute("aria-label", texto);
  el.textContent = "";

  let indice = 0;
  const partes = texto.split(/(\s+)/);
  for (const parte of partes) {
    if (parte === "") continue;
    if (/^\s+$/.test(parte)) {
      el.appendChild(document.createTextNode(" "));
      continue;
    }
    const palavra = document.createElement("span");
    palavra.className = "palavra";
    palavra.setAttribute("aria-hidden", "true");
    for (const letra of Array.from(parte)) {
      const span = document.createElement("span");
      span.className = "char";
      span.style.transitionDelay = `${(indice * ATRASO).toFixed(3)}s`;
      span.textContent = letra;
      palavra.appendChild(span);
      indice += 1;
    }
    el.appendChild(palavra);
  }

  if (revelar) {
    // Dois quadros: garante que o estado inicial foi pintado antes da transição.
    requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add("revelado")));
  }
}
