// Painel: jornada por scroll em seis momentos, sincronizada com a cena 3D.

import { contarImagens, listarTodasPessoas } from "../api.js";
import { obterCena } from "../cena/cena.js";
import {
  CENTROS,
  ESTADOS,
  ESTADO_DO_MOMENTO,
  corDaJornada,
  momentoAtivo,
  momentoMaisProximo,
  paraCss,
} from "../cena/paleta.js";
import { copiarTexto, formatarHora, h } from "../dom.js";
import { dividirLetras } from "../efeitos/letras.js";
import { obterSaude } from "../saude.js";
import { blocoErro } from "../ui/erro.js";
import { led } from "../ui/led.js";
import { toast } from "../ui/toast.js";

const SUAVIZACAO = 0.06;
const COMANDO_TREINO = "python treinar.py";

const NOMES = ["Visão geral", "Aguardando", "Validando", "Aceito", "Negado", "Operação"];

const PINOS = [
  ["S", "GPIO 17", "pino 11"],
  ["V", "GPIO 27", "pino 13"],
  ["CLK", "GPIO 22", "pino 15"],
];

// Momento de cada combinação de sinais, na chave "sv".
const MOMENTO_DOS_SINAIS = { "00": 1, "10": 2, "01": 3, "11": 4 };

export function render(container) {
  const raiz = document.documentElement;
  const reduzido = raiz.classList.contains("movimento-reduzido");
  const cena = obterCena();
  const limpezas = [];
  let vivo = true;

  cena.enquadrar("jornada");

  // ── Momentos ──
  const momentos = [
    momento(0, {
      rotulo: ["SAFE · Sistema de Acesso Facial Embarcado"],
      titulo: "Acesso pelo olhar",
      nivel: "h1",
      corpo: [
        h(
          "p",
          { class: "momento__desc" },
          "O SAFE reconhece rostos em um Raspberry Pi 5 e traduz o resultado em dois sinais elétricos, que uma máquina de estados transforma em acesso liberado ou negado.",
        ),
        blocoSaude(limpezas),
        blocoCadastros(() => vivo),
      ],
    }),
    momentoDeEstado(1, "aguardando", "A câmera está ativa e nenhum rosto está em processamento."),
    momentoDeEstado(2, "validando", "Um rosto foi detectado. A identidade só é confirmada após 5 quadros coincidentes."),
    momentoDeEstado(3, "aceito", "Pessoa reconhecida. O circuito libera o acesso."),
    momentoDeEstado(4, "negado", "Pessoa desconhecida ou não confirmada. O acesso permanece fechado."),
    momento(5, {
      rotulo: ["Do cadastro ao reconhecimento"],
      titulo: "Operação",
      largo: true,
      corpo: [blocoPassos(), blocoPinos()],
    }),
  ];

  const jornada = h("div", { class: "jornada" }, momentos.map((m) => m.el));
  const consoleSv = criarConsole((indice) => irPara(indice));
  container.append(jornada, consoleSv.el);

  // ── Progresso (traços na última linha da grade) ──
  const progresso = document.getElementById("progresso");
  const tracos = NOMES.map((nome, i) => {
    const cheio = h("span", { "aria-hidden": "true" });
    const botao = h(
      "button",
      { type: "button", class: "progresso__traco", "aria-label": `Ir para: ${nome}`, onClick: () => irPara(i) },
      cheio,
    );
    return { botao, cheio };
  });
  if (progresso && !reduzido) {
    progresso.replaceChildren(...tracos.map((t) => t.botao));
    progresso.hidden = false;
  }

  function alturaRolavel() {
    return document.documentElement.scrollHeight - window.innerHeight;
  }

  function progressoAlvo() {
    const max = alturaRolavel();
    return max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
  }

  function irPara(indice) {
    window.scrollTo({ top: alturaRolavel() * CENTROS[indice], behavior: reduzido ? "auto" : "smooth" });
  }

  // ── Laço da jornada ──
  let p = progressoAlvo();
  let raf = 0;
  let ativoAnterior = -2;
  let proximoAnterior = -1;
  let corAnterior = "";

  function aplicar() {
    cena.jornada(p);

    const cor = paraCss(corDaJornada(p));
    if (cor !== corAnterior) {
      raiz.style.setProperty("--acento", cor);
      corAnterior = cor;
    }

    const ativo = momentoAtivo(p);
    if (ativo !== ativoAnterior) {
      momentos.forEach((m, i) => {
        m.el.classList.toggle("ativo", i === ativo);
        m.el.setAttribute("aria-hidden", i === ativo ? "false" : "true");
      });
      ativoAnterior = ativo;
    }

    const proximo = momentoMaisProximo(p);
    if (proximo !== proximoAnterior) {
      consoleSv.mostrar(proximo);
      tracos.forEach((t, i) => {
        if (i === proximo) t.botao.setAttribute("aria-current", "step");
        else t.botao.removeAttribute("aria-current");
      });
      proximoAnterior = proximo;
    }

    tracos.forEach((t, i) => {
      const cheio = Math.min(1, Math.max(0, (p - (CENTROS[i] - 0.1)) / 0.2));
      t.cheio.style.setProperty("--cheio", cheio.toFixed(3));
    });
  }

  function quadro() {
    raf = requestAnimationFrame(quadro);
    const alvo = progressoAlvo();
    const diferenca = alvo - p;
    p = Math.abs(diferenca) < 0.0002 ? alvo : p + diferenca * SUAVIZACAO;
    aplicar();
  }

  if (reduzido) {
    // Sem jornada animada: todo o conteúdo fica visível em fluxo normal (CSS).
    momentos.forEach((m) => m.el.classList.add("ativo"));
  } else {
    aplicar();
    raf = requestAnimationFrame(quadro);
  }

  return () => {
    vivo = false;
    cancelAnimationFrame(raf);
    limpezas.forEach((fn) => fn());
    raiz.style.removeProperty("--acento");
    if (progresso) {
      progresso.replaceChildren();
      progresso.hidden = true;
    }
  };
}

// ── Construção dos momentos ──

function momento(indice, { rotulo, titulo, corpo, nivel = "h2", largo = false }) {
  const id = `momento-${indice}`;
  const tituloEl = h(nivel, { class: "titulo-jornada", id }, titulo);
  dividirLetras(tituloEl);
  const el = h(
    "section",
    { class: ["momento", largo && "momento--largo"], "aria-labelledby": id },
    h("div", { class: "momento__rotulo" }, rotulo),
    tituloEl,
    h("div", { class: "momento__corpo" }, corpo),
  );
  return { el };
}

function momentoDeEstado(indice, chave, descricao) {
  const estado = ESTADOS[chave];
  return momento(indice, {
    rotulo: [
      `Estado 0${indice} / 04`,
      led("acento", estado.s === 1, `S = ${estado.s}`),
      led("acento", estado.v === 1, `V = ${estado.v}`),
    ],
    titulo: estado.nome,
    corpo: [h("p", { class: "momento__desc" }, `S = ${estado.s} · V = ${estado.v}. ${descricao}`)],
  });
}

// ── Momento 0: saúde e cadastros ──

function blocoSaude(limpezas) {
  const saude = obterSaude();
  const api = h("span");
  const db = h("span");
  const hora = h("span", { class: "saude-linha__hora" });

  function atualizar(estado) {
    api.replaceChildren(led(saude.tom(estado.api), estado.api !== "checking", `API · ${saude.texto(estado.api)}`, { pulsar: estado.api === "ok" }));
    db.replaceChildren(led(saude.tom(estado.db), estado.db !== "checking", `Banco · ${saude.texto(estado.db)}`, { pulsar: estado.db === "ok" }));
    hora.textContent = estado.verificadoEm ? `checado às ${formatarHora(estado.verificadoEm)}` : "";
  }

  atualizar(saude.estado());
  limpezas.push(saude.assinar(atualizar));

  return h("div", { class: "saude-linha", "aria-live": "polite" }, api, db, hora);
}

function blocoCadastros(estaVivo) {
  const corpo = h("div");

  async function carregar() {
    corpo.replaceChildren(
      h(
        "div",
        { class: "leituras" },
        ["Pessoas", "Fotos", "Sem foto"].map((r) =>
          h("div", { class: "leitura" }, h("span", { class: "skeleton" }), h("span", { class: "leitura__rotulo" }, r)),
        ),
      ),
    );

    try {
      const pessoas = await listarTodasPessoas();
      const contagem = await contarImagens(pessoas);
      if (!estaVivo()) return;

      let fotos = 0;
      let semFoto = 0;
      for (const pessoa of pessoas) {
        const total = contagem.get(pessoa.id)?.total ?? 0;
        fotos += total;
        if (total === 0) semFoto += 1;
      }

      corpo.replaceChildren(
        h(
          "div",
          { class: "leituras" },
          leitura(pessoas.length, pessoas.length === 1 ? "Pessoa" : "Pessoas"),
          leitura(fotos, fotos === 1 ? "Foto" : "Fotos"),
          leitura(semFoto, "Sem foto", semFoto > 0),
          semFoto > 0
            ? h("a", { class: "leitura__link", href: "#/pessoas?filtro=sem-foto" }, "Não serão reconhecidas — ver lista")
            : null,
        ),
      );
    } catch (erro) {
      if (!estaVivo()) return;
      if (erro.status === 0 || erro.status === 503) obterSaude()?.verificarAgora();
      corpo.replaceChildren(
        h("div", { style: { marginTop: "22px" } }, blocoErro(erro.mensagem || "Falha ao carregar os cadastros.", carregar)),
      );
    }
  }

  carregar();
  return corpo;
}

function leitura(valor, rotulo, alerta = false) {
  return h(
    "div",
    { class: ["leitura", alerta && "leitura--alerta"] },
    h("span", { class: "leitura__valor" }, String(valor)),
    h("span", { class: "leitura__rotulo" }, rotulo),
  );
}

// ── Momento 5: operação ──

function blocoPassos() {
  const copiar = h(
    "button",
    {
      type: "button",
      class: "btn btn--sm btn--ghost",
      "aria-label": "Copiar comando de treino",
      onClick: async () => {
        try {
          await copiarTexto(COMANDO_TREINO);
          toast("Comando copiado.", "ok");
        } catch {
          toast("Não foi possível copiar. Selecione o comando manualmente.", "erro");
        }
      },
    },
    "Copiar",
  );

  return h(
    "ol",
    { class: "passos" },
    h(
      "li",
      { class: "passo" },
      h("h3", {}, "Cadastrar pessoa"),
      h("p", {}, "Nome e um identificador único. E-mail e nascimento são opcionais."),
      h("a", { class: "btn btn--sm btn--primary", href: "#/pessoas/nova" }, "Cadastrar"),
    ),
    h(
      "li",
      { class: "passo" },
      h("h3", {}, "Enviar fotos"),
      h("p", {}, "De 3 a 5 fotos por pessoa, com um único rosto, de frente e bem iluminado."),
      h("a", { class: "btn btn--sm", href: "#/pessoas" }, "Ver pessoas"),
    ),
    h(
      "li",
      { class: "passo" },
      h("h3", {}, "Treinar o modelo no Pi"),
      h("p", {}, "Novos cadastros só valem depois de retreinar, na pasta software/."),
      h("div", { class: "cmd" }, h("code", {}, COMANDO_TREINO), copiar),
    ),
  );
}

function blocoPinos() {
  return h(
    "p",
    { class: "pinos", "aria-label": "Mapeamento de pinos do Raspberry Pi 5" },
    PINOS.map(([sinal, bcm, pino]) => h("span", {}, h("b", {}, sinal), ` · ${bcm} · ${pino}`)),
  );
}

// ── Console S/V ──

function criarConsole(aoEscolher) {
  const sinais = { s: 0, v: 0 };
  const nomeEstado = h("span", { class: "console-sv__estado" }, "Aguardando");

  function interruptor(chave, nome, descricao) {
    const bit = h("span", { class: "switch__bit" }, "0");
    const botao = h(
      "button",
      { type: "button", class: "switch", role: "switch", "aria-checked": "false", "aria-label": `Sinal ${nome}` },
      h("span", { class: "switch__label" }, h("b", {}, nome), h("span", {}, descricao)),
      bit,
      h("span", { class: "switch__track", "aria-hidden": "true" }),
    );
    botao.addEventListener("click", () => {
      const novo = { ...sinais, [chave]: sinais[chave] ? 0 : 1 };
      aoEscolher(MOMENTO_DOS_SINAIS[`${novo.s}${novo.v}`]);
    });
    return { botao, bit };
  }

  const s = interruptor("s", "S · Strobe", "Processamento ativo");
  const v = interruptor("v", "V · Validade", "Resultado disponível");

  const el = h(
    "aside",
    { class: "console-sv", "aria-label": "Sinais da máquina de estados" },
    h("div", { class: "console-sv__topo" }, h("span", {}, "FSM"), nomeEstado),
    s.botao,
    v.botao,
  );

  // Reflete o momento mais próximo; fora dos quatro estados o console fica inativo.
  function mostrar(indice) {
    const chave = ESTADO_DO_MOMENTO[indice];
    const estado = ESTADOS[chave];
    const semSinais = estado.s === null;
    el.classList.toggle("inativo", semSinais);
    el.classList.toggle("recolhido", indice === 5);
    nomeEstado.textContent = semSinais ? "—" : estado.nome;
    sinais.s = semSinais ? 0 : estado.s;
    sinais.v = semSinais ? 0 : estado.v;
    for (const [item, valor] of [[s, sinais.s], [v, sinais.v]]) {
      item.botao.setAttribute("aria-checked", valor ? "true" : "false");
      item.botao.disabled = semSinais;
      item.bit.textContent = String(valor);
    }
  }

  return { el, mostrar };
}
