// Utilitários de DOM. Nunca usa innerHTML: todo texto vira nó de texto.

const BOOLEANOS = new Set(["disabled", "hidden", "checked", "required", "multiple", "autofocus", "readonly"]);

export function h(tag, props = {}, ...filhos) {
  const el = document.createElement(tag);

  for (const [chave, valor] of Object.entries(props || {})) {
    if (valor === undefined || valor === null || valor === false) continue;

    if (chave === "class") {
      el.className = Array.isArray(valor) ? valor.filter(Boolean).join(" ") : valor;
    } else if (chave === "dataset") {
      Object.assign(el.dataset, valor);
    } else if (chave === "style" && typeof valor === "object") {
      Object.assign(el.style, valor);
    } else if (chave.startsWith("on") && typeof valor === "function") {
      el.addEventListener(chave.slice(2).toLowerCase(), valor);
    } else if (chave === "value") {
      el.value = valor;
    } else if (BOOLEANOS.has(chave)) {
      el[chave] = true;
    } else {
      el.setAttribute(chave, valor === true ? "" : String(valor));
    }
  }

  anexar(el, filhos);
  return el;
}

function anexar(el, filhos) {
  for (const filho of filhos) {
    if (filho === null || filho === undefined || filho === false) continue;
    if (Array.isArray(filho)) {
      anexar(el, filho);
    } else if (filho instanceof Node) {
      el.appendChild(filho);
    } else {
      el.appendChild(document.createTextNode(String(filho)));
    }
  }
}

export function limpar(el) {
  while (el.firstChild) el.removeChild(el.firstChild);
}

// SVG de ícones (traço), construído via DOM.
const ICONES = {
  mais: ["M12 5v14", "M5 12h14"],
  busca: ["M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14z", "M20 20l-4-4"],
  voltar: ["M15 18l-6-6 6-6"],
  editar: ["M4 20h4L19 9l-4-4L4 16v4z", "M14 6l4 4"],
  lixo: ["M4 7h16", "M9 7V4h6v3", "M6 7l1 13h10l1-13"],
  copiar: ["M9 9h11v11H9z", "M5 15H4V4h11v1"],
  upload: ["M12 16V4", "M7 9l5-5 5 5", "M4 20h16"],
  camera: ["M4 8h3l2-3h6l2 3h3v11H4z", "M12 10a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7z"],
  fechar: ["M6 6l12 12", "M18 6L6 18"],
  recarregar: ["M20 11a8 8 0 1 0-2.3 5.7", "M20 4v7h-7"],
};

export function icone(nome) {
  const ns = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(ns, "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", "1.8");
  svg.setAttribute("stroke-linecap", "round");
  svg.setAttribute("stroke-linejoin", "round");
  svg.setAttribute("aria-hidden", "true");
  for (const d of ICONES[nome] || []) {
    const path = document.createElementNS(ns, "path");
    path.setAttribute("d", d);
    svg.appendChild(path);
  }
  return svg;
}

function pad(n) {
  return String(n).padStart(2, "0");
}

// "2000-05-20" é tratado como data de calendário (sem fuso);
// timestamps completos são convertidos para o horário local.
// A API grava data_registro em UTC, mas o SQLite devolve sem fuso
// ("2026-11-10T23:12:00"). Sem indicação de fuso, tratamos como UTC.
export function lerDataHora(iso) {
  const texto = String(iso).replace(" ", "T");
  const temFuso = /(Z|[+-]\d{2}:?\d{2})$/i.test(texto);
  return new Date(temFuso ? texto : `${texto}Z`);
}

export function formatarData(iso) {
  if (!iso) return "—";
  const soData = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (soData) return `${soData[3]}/${soData[2]}/${soData[1]}`;
  const d = lerDataHora(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
}

export function formatarDataHora(iso) {
  if (!iso) return "—";
  const d = lerDataHora(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return `${formatarData(iso)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function formatarHora(data) {
  return `${pad(data.getHours())}:${pad(data.getMinutes())}:${pad(data.getSeconds())}`;
}

export function hojeISO() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function normalizar(texto) {
  return String(texto ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

export function iniciais(nome) {
  const partes = String(nome ?? "")
    .trim()
    .split(/\s+/)
    .filter((p) => p.length > 0 && !/^(da|de|do|das|dos|e)$/i.test(p));
  if (partes.length === 0) return "?";
  const letras = partes.length === 1 ? partes[0].slice(0, 2) : partes[0][0] + partes[partes.length - 1][0];
  return letras.toUpperCase();
}

export async function copiarTexto(texto) {
  if (navigator.clipboard && window.isSecureContext) {
    await navigator.clipboard.writeText(texto);
    return;
  }
  const area = h("textarea", { style: { position: "fixed", opacity: "0" } }, texto);
  document.body.appendChild(area);
  area.select();
  const ok = document.execCommand("copy");
  area.remove();
  if (!ok) throw new Error("copiar indisponível");
}
