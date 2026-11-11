import { iniciarCena } from "./cena/cena.js";
import { iniciarCursor } from "./efeitos/cursor.js";
import { iniciarGrade } from "./efeitos/grade.js";
import { iniciarRouter } from "./router.js";
import { iniciarSaude } from "./saude.js";

const TITULOS = {
  painel: "Painel",
  pessoas: "Pessoas",
};

// A cena decide de forma síncrona se há movimento reduzido; os efeitos consultam isso.
iniciarCena(document.getElementById("cena"));
iniciarCursor();
iniciarGrade();
iniciarSaude(document.getElementById("health-api"), document.getElementById("health-db"));

iniciarRouter(
  document.getElementById("view"),
  [
    { padrao: "/painel", view: () => import("./views/painel.js") },
    { padrao: "/pessoas", view: () => import("./views/pessoas.js") },
    { padrao: "/pessoas/nova", view: () => import("./views/pessoa-form.js") },
    { padrao: "/pessoas/:id/editar", view: () => import("./views/pessoa-form.js") },
    { padrao: "/pessoas/:id", view: () => import("./views/pessoa.js") },
  ],
  {
    naoEncontrado: () => import("./views/nao-encontrado.js"),
    aoNavegar({ caminho }) {
      const secao = caminho.split("/")[1];
      document.title = `SAFE · ${TITULOS[secao] || "Painel"}`;
    },
  },
);
