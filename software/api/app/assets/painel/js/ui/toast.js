import { h } from "../dom.js";
import { led } from "./led.js";

const DURACAO = 4000;
const TONS = { ok: "ok", erro: "bad", info: "ui" };

export function toast(mensagem, tipo = "info") {
  const area = document.getElementById("toasts");
  if (!area) return;

  const el = h(
    "div",
    { class: "toast", role: tipo === "erro" ? "alert" : "status" },
    led(TONS[tipo] || "ui", true),
    h("span", {}, mensagem),
  );
  area.appendChild(el);

  setTimeout(() => {
    el.classList.add("is-saindo");
    setTimeout(() => el.remove(), 220);
  }, DURACAO);
}
