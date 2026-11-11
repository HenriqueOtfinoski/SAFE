// Cliente HTTP da API SAFE. Mesma origem; erros normalizados em ApiError.

const TIMEOUT = 10_000;
const TIMEOUT_UPLOAD = 30_000;
const PAGINA = 100;
const CONCORRENCIA = 6;

const MSG_CONEXAO = "Não foi possível conectar à API.";
const MSG_DUPLICADO = "E-mail ou identificador já cadastrado.";

export class ApiError extends Error {
  constructor(status, mensagem, campos = {}) {
    super(mensagem);
    this.name = "ApiError";
    this.status = status;
    this.mensagem = mensagem;
    this.campos = campos;
  }
}

const TRADUCOES = [
  [/at least 1 character|string_too_short/i, "Campo obrigatório."],
  [/at most (\d+) character/i, (m) => `Use no máximo ${m[1]} caracteres.`],
  [/email inv[aá]lido/i, "E-mail inválido."],
  [/futuro/i, "A data não pode estar no futuro."],
  [/valid date|date_from/i, "Data inválida."],
  [/campo n[aã]o pode ser nulo/i, "Campo obrigatório."],
];

function traduzir(msg) {
  const texto = String(msg || "").replace(/^Value error,\s*/i, "");
  for (const [padrao, saida] of TRADUCOES) {
    const m = padrao.exec(texto);
    if (m) return typeof saida === "function" ? saida(m) : saida;
  }
  return texto || "Valor inválido.";
}

function camposDe422(detail) {
  const campos = {};
  if (!Array.isArray(detail)) return campos;
  for (const item of detail) {
    const loc = Array.isArray(item.loc) ? item.loc : [];
    const ultimo = loc[loc.length - 1];
    const chave = loc.length <= 1 || ultimo === "body" ? "_form" : String(ultimo);
    if (!campos[chave]) campos[chave] = traduzir(item.msg);
  }
  return campos;
}

async function erroDaResposta(resposta) {
  let corpo = null;
  try {
    corpo = await resposta.json();
  } catch {
    /* corpo não-JSON */
  }
  const detail = corpo?.detail;
  const status = resposta.status;

  if (status === 422) {
    const campos = camposDe422(detail);
    return new ApiError(status, "Verifique os campos destacados.", campos);
  }
  if (status === 409) {
    return new ApiError(status, MSG_DUPLICADO, { email: MSG_DUPLICADO, identificador: MSG_DUPLICADO });
  }
  if (status === 404) {
    return new ApiError(status, typeof detail === "string" ? detail : "Não encontrado.");
  }
  if (status === 503) {
    return new ApiError(status, "Banco de dados indisponível.");
  }
  return new ApiError(status, typeof detail === "string" ? detail : `Erro inesperado da API (${status}).`);
}

async function requisitar(caminho, { metodo = "GET", json, corpo, timeout = TIMEOUT, semCorpo = false } = {}) {
  const controle = new AbortController();
  const timer = setTimeout(() => controle.abort(), timeout);
  const opcoes = { method: metodo, signal: controle.signal, headers: { Accept: "application/json" } };

  if (json !== undefined) {
    opcoes.headers["Content-Type"] = "application/json";
    opcoes.body = JSON.stringify(json);
  } else if (corpo !== undefined) {
    opcoes.body = corpo;
  }

  let resposta;
  try {
    resposta = await fetch(caminho, opcoes);
  } catch {
    throw new ApiError(0, MSG_CONEXAO);
  } finally {
    clearTimeout(timer);
  }

  if (!resposta.ok) throw await erroDaResposta(resposta);
  if (semCorpo || resposta.status === 204) return undefined;
  return resposta.json();
}

// ── Saúde ──
export const health = () => requisitar("/health", { timeout: 5_000 });
export const healthDatabase = () => requisitar("/health/database", { timeout: 5_000 });

// ── Pessoas ──
export async function listarTodasPessoas() {
  const todas = [];
  for (let offset = 0; ; offset += PAGINA) {
    const pagina = await requisitar(`/pessoas?offset=${offset}&limite=${PAGINA}`);
    todas.push(...pagina);
    if (pagina.length < PAGINA) return todas;
  }
}

export const buscarPessoa = (id) => requisitar(`/pessoas/${encodeURIComponent(id)}`);

export async function criarPessoa(dados) {
  const pessoa = await requisitar("/pessoas", { metodo: "POST", json: dados });
  cacheImagens.set(pessoa.id, { total: 0, primeira: null });
  return pessoa;
}

export const atualizarPessoa = (id, dados) =>
  requisitar(`/pessoas/${encodeURIComponent(id)}`, { metodo: "PATCH", json: dados });

export async function excluirPessoa(id) {
  await requisitar(`/pessoas/${encodeURIComponent(id)}`, { metodo: "DELETE", semCorpo: true });
  invalidarImagens(Number(id));
}

// ── Imagens ──
export const listarImagens = (id) => requisitar(`/pessoas/${encodeURIComponent(id)}/imagens`);

export async function enviarImagem(id, blob, nome) {
  const form = new FormData();
  form.append("arquivo", blob, nome);
  const imagem = await requisitar(`/pessoas/${encodeURIComponent(id)}/imagens`, {
    metodo: "POST",
    corpo: form,
    timeout: TIMEOUT_UPLOAD,
  });
  invalidarImagens(Number(id));
  return imagem;
}

export const urlImagem = (pessoaId, imagemId) =>
  `/pessoas/${encodeURIComponent(pessoaId)}/imagens/${encodeURIComponent(imagemId)}/arquivo`;

// Cache em memória: pessoaId → { total, primeira }
const cacheImagens = new Map();

export function invalidarImagens(id) {
  if (id === undefined) cacheImagens.clear();
  else cacheImagens.delete(id);
}

export async function contarImagens(pessoas) {
  const resultado = new Map();
  const pendentes = [];

  for (const p of pessoas) {
    if (cacheImagens.has(p.id)) resultado.set(p.id, cacheImagens.get(p.id));
    else pendentes.push(p.id);
  }

  let indice = 0;
  async function trabalhador() {
    while (indice < pendentes.length) {
      const id = pendentes[indice++];
      const imagens = await listarImagens(id);
      const info = { total: imagens.length, primeira: imagens[0]?.id ?? null };
      cacheImagens.set(id, info);
      resultado.set(id, info);
    }
  }

  await Promise.all(Array.from({ length: Math.min(CONCORRENCIA, pendentes.length) }, trabalhador));
  return resultado;
}
