import { h } from "../dom.js";
import { led } from "./led.js";

export function blocoErro(mensagem, aoTentar) {
  return h(
    "div",
    { class: "error-block", role: "alert" },
    led("bad", true, "FALHA"),
    h("p", {}, mensagem),
    h("button", { type: "button", class: "btn btn--sm", onClick: aoTentar }, "Tentar novamente"),
  );
}
