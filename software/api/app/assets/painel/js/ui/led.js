import { h } from "../dom.js";

// tom: 'ok' | 'wait' | 'bad' | 'idle' | 'ui'
export function led(tom, aceso, rotulo, { pulsar = false } = {}) {
  return h(
    "span",
    { class: ["led", `led--${tom}`, aceso && "led--on", pulsar && "led--pulse"] },
    h("span", { class: "led__dot", "aria-hidden": "true" }),
    rotulo ? h("span", { class: "led__label" }, rotulo) : null,
  );
}
