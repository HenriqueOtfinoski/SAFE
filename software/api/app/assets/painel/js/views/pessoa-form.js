import { ApiError, atualizarPessoa, buscarPessoa, criarPessoa } from "../api.js";
import { obterCena } from "../cena/cena.js";
import { h, hojeISO, icone } from "../dom.js";
import { dividirLetras } from "../efeitos/letras.js";
import { navegar } from "../router.js";
import { toast } from "../ui/toast.js";
import { render as renderNaoEncontrado } from "./nao-encontrado.js";
import { blocoErro } from "../ui/erro.js";

const PADRAO_EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const CAMPOS = ["nome", "identificador", "email", "data_nascimento"];

export function validar(valores) {
  const erros = {};
  const nome = (valores.nome ?? "").trim();
  const identificador = (valores.identificador ?? "").trim();
  const email = (valores.email ?? "").trim();
  const data = valores.data_nascimento ?? "";

  if (!nome) erros.nome = "Informe o nome.";
  else if (nome.length > 100) erros.nome = "Use no máximo 100 caracteres.";

  if (!identificador) erros.identificador = "Informe o identificador.";
  else if (identificador.length > 80) erros.identificador = "Use no máximo 80 caracteres.";

  if (email && (email.length > 255 || !PADRAO_EMAIL.test(email))) erros.email = "E-mail inválido.";

  if (data && data > hojeISO()) erros.data_nascimento = "A data não pode estar no futuro.";

  return erros;
}

// Campos alterados em relação à pessoa original. Opcionais vazios viram null.
export function diferencas(original, valores) {
  const saida = {};
  for (const campo of CAMPOS) {
    const novo = (valores[campo] ?? "").trim();
    const antigo = original[campo] ?? "";
    if (campo === "email" && novo.toLowerCase() === String(antigo).toLowerCase()) continue;
    if (novo === antigo) continue;
    if (campo === "email" || campo === "data_nascimento") saida[campo] = novo === "" ? null : novo;
    else if (novo !== "") saida[campo] = novo;
  }
  return saida;
}

function paraCriacao(valores) {
  const dados = { nome: valores.nome.trim(), identificador: valores.identificador.trim() };
  if (valores.email.trim()) dados.email = valores.email.trim();
  if (valores.data_nascimento) dados.data_nascimento = valores.data_nascimento;
  return dados;
}

export function render(container, params) {
  let vivo = true;
  const edicao = params.id !== undefined;

  obterCena().enquadrar("form");

  if (!edicao) {
    montar(container, null);
    return () => (vivo = false);
  }

  container.append(h("div", { class: "pagina" }, h("div", { class: "panel" }, h("span", { class: "skeleton", style: { width: "40%" } }))));

  async function carregar() {
    try {
      const pessoa = await buscarPessoa(params.id);
      if (!vivo) return;
      container.replaceChildren();
      montar(container, pessoa);
    } catch (erro) {
      if (!vivo) return;
      container.replaceChildren();
      if (erro.status === 404) {
        renderNaoEncontrado(container, params, {
          titulo: "Pessoa não encontrada",
          texto: "Ela pode ter sido excluída.",
          link: "#/pessoas",
          rotulo: "Voltar para Pessoas",
        });
      } else {
        container.append(h("div", { class: "pagina" }, blocoErro(erro.mensagem, carregar)));
      }
    }
  }

  carregar();
  return () => (vivo = false);
}

function montar(container, pessoa) {
  const edicao = pessoa !== null;
  const destino = edicao ? `#/pessoas/${pessoa.id}` : "#/pessoas";
  const campos = {};
  let enviando = false;

  function campo(nome, rotulo, attrs, { obrigatorio = false, dica } = {}) {
    const id = `f-${nome}`;
    const erro = h("span", { class: "field__error", id: `${id}-erro` });
    const input = h("input", {
      class: "input",
      id,
      name: nome,
      "aria-describedby": `${id}-erro`,
      ...attrs,
      value: edicao ? pessoa[nome] ?? "" : "",
    });
    const wrap = h(
      "div",
      { class: "field" },
      h("label", { class: "field__label", for: id }, rotulo, obrigatorio ? h("span", { class: "req", "aria-hidden": "true" }, "*") : null),
      input,
      dica ? h("span", { class: "field__hint" }, dica) : null,
      erro,
    );
    campos[nome] = { input, erro, wrap, tocado: false };
    input.addEventListener("blur", () => {
      campos[nome].tocado = true;
      mostrarErros(validar(valores()), true);
    });
    input.addEventListener("input", () => {
      if (campos[nome].tocado) mostrarErros(validar(valores()), true);
      atualizarBotao();
    });
    return wrap;
  }

  const avisoForm = h("div", { class: "notice notice--bad", role: "alert", hidden: true });
  const salvar = h("button", { type: "submit", class: "btn btn--primary" }, edicao ? "Salvar alterações" : "Cadastrar pessoa");

  const form = h(
    "form",
    { class: "form", novalidate: true },
    h(
      "div",
      { class: "form__row" },
      campo("nome", "Nome completo", { type: "text", maxlength: "100", autocomplete: "name", required: true, placeholder: "Ex.: Maria Silva" }, { obrigatorio: true }),
      campo("identificador", "Identificador", { type: "text", maxlength: "80", required: true, placeholder: "Ex.: SAFE-001", spellcheck: "false" }, { obrigatorio: true, dica: "Único. Matrícula, crachá ou código interno." }),
    ),
    h(
      "div",
      { class: "form__row" },
      campo("email", "E-mail", { type: "email", maxlength: "255", autocomplete: "email", placeholder: "maria@exemplo.com" }, { dica: "Opcional e único." }),
      campo("data_nascimento", "Data de nascimento", { type: "date", max: hojeISO() }, { dica: "Opcional." }),
    ),
    avisoForm,
    h("div", { class: "actions" }, salvar, h("a", { class: "btn btn--ghost", href: destino }, "Cancelar")),
  );

  function valores() {
    return Object.fromEntries(CAMPOS.map((c) => [c, campos[c].input.value]));
  }

  function mostrarErros(erros, apenasTocados = false) {
    for (const nome of CAMPOS) {
      const c = campos[nome];
      const msg = apenasTocados && !c.tocado ? "" : erros[nome] || "";
      c.erro.textContent = msg;
      c.wrap.classList.toggle("field--erro", Boolean(msg));
      if (msg) c.input.setAttribute("aria-invalid", "true");
      else c.input.removeAttribute("aria-invalid");
    }
  }

  function atualizarBotao() {
    salvar.disabled = enviando || (edicao && Object.keys(diferencas(pessoa, valores())).length === 0);
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (enviando) return;
    avisoForm.hidden = true;

    CAMPOS.forEach((c) => (campos[c].tocado = true));
    const erros = validar(valores());
    mostrarErros(erros);
    const primeiro = CAMPOS.find((c) => erros[c]);
    if (primeiro) {
      campos[primeiro].input.focus();
      return;
    }

    enviando = true;
    salvar.textContent = "Salvando…";
    atualizarBotao();

    try {
      if (edicao) {
        await atualizarPessoa(pessoa.id, diferencas(pessoa, valores()));
        obterCena().pulsar("ok");
        toast("Alterações salvas.", "ok");
        navegar(`#/pessoas/${pessoa.id}`);
      } else {
        const nova = await criarPessoa(paraCriacao(valores()));
        obterCena().pulsar("ok");
        toast("Pessoa cadastrada. Agora envie as fotos.", "ok");
        navegar(`#/pessoas/${nova.id}?novo=1`);
      }
    } catch (erro) {
      enviando = false;
      salvar.textContent = edicao ? "Salvar alterações" : "Cadastrar pessoa";
      atualizarBotao();
      tratarErro(erro);
    }
  });

  function tratarErro(erro) {
    obterCena().pulsar("bad");
    if (!(erro instanceof ApiError)) {
      toast("Erro inesperado.", "erro");
      return;
    }
    const doCampo = Object.fromEntries(Object.entries(erro.campos).filter(([k]) => CAMPOS.includes(k)));
    if (Object.keys(doCampo).length) {
      mostrarErros(doCampo);
      campos[CAMPOS.find((c) => doCampo[c])].input.focus();
    }
    const geral = erro.campos._form || (Object.keys(doCampo).length ? null : erro.mensagem);
    if (geral) {
      avisoForm.replaceChildren(h("span", {}, geral));
      avisoForm.hidden = false;
    }
  }

  const titulo = h("h1", { class: "titulo-pagina" }, edicao ? pessoa.nome : "Nova pessoa");
  dividirLetras(titulo, { revelar: true });

  container.append(
    h(
      "div",
      { class: "pagina pagina--estreita" },
      h("a", { class: "back", href: destino }, icone("voltar"), edicao ? "Voltar para a pessoa" : "Voltar para Pessoas"),
      h(
        "header",
        { class: "page-head" },
        h(
          "div",
          {},
          h("span", { class: "eyebrow" }, edicao ? `Editar · #${pessoa.id}` : "Novo cadastro"),
          titulo,
          h("p", { class: "lede" }, edicao ? "Altere os dados. As fotos são gerenciadas na página da pessoa." : "Depois de cadastrar, você poderá enviar as fotos faciais."),
        ),
      ),
      h("div", { class: "panel" }, form),
    ),
  );

  atualizarBotao();
  campos.nome.input.focus();
}
