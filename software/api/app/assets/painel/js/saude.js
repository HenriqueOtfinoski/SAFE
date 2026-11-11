import { health, healthDatabase } from "./api.js";
import { led } from "./ui/led.js";

const INTERVALO = 15_000;
const TOM = { ok: "ok", bad: "bad", checking: "idle" };
const TEXTO = { ok: "Operacional", bad: "Indisponível", checking: "Verificando…" };

let instancia = null;

export function iniciarSaude(alvoApi, alvoDb) {
  let estado = { api: "checking", db: "checking", verificadoEm: null };
  const assinantes = new Set();
  let timer = null;
  let emAndamento = null;

  function desenhar() {
    alvoApi.replaceChildren(led(TOM[estado.api], estado.api !== "checking", "API"));
    alvoDb.replaceChildren(led(TOM[estado.db], estado.db !== "checking", "BANCO"));
    alvoApi.title = `API: ${TEXTO[estado.api]}`;
    alvoDb.title = `Banco: ${TEXTO[estado.db]}`;
  }

  function publicar() {
    desenhar();
    for (const fn of assinantes) fn(estado);
  }

  async function checar() {
    const [api, db] = await Promise.allSettled([health(), healthDatabase()]);
    estado = {
      api: api.status === "fulfilled" ? "ok" : "bad",
      db: db.status === "fulfilled" ? "ok" : "bad",
      verificadoEm: new Date(),
    };
    publicar();
  }

  function verificarAgora() {
    if (!emAndamento) emAndamento = checar().finally(() => (emAndamento = null));
    return emAndamento;
  }

  function agendar() {
    clearInterval(timer);
    timer = setInterval(() => {
      if (document.visibilityState === "visible") verificarAgora();
    }, INTERVALO);
  }

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") verificarAgora();
  });

  desenhar();
  verificarAgora();
  agendar();

  instancia = {
    estado: () => estado,
    assinar(fn) {
      assinantes.add(fn);
      return () => assinantes.delete(fn);
    },
    verificarAgora,
    texto: (s) => TEXTO[s],
    tom: (s) => TOM[s],
  };
  return instancia;
}

export function obterSaude() {
  return instancia;
}
