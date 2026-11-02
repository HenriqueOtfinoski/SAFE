/* ═════════════════════════════════════════
   SAFE — Painel de Administração · App JS
   ═════════════════════════════════════════ */

"use strict";

// ── Estado Global ──────────────────────────────────────────
let API_URL = "";
let todasPessoas = [];      // cache da lista completa
let imagensCadastroPendentes = [];  // arquivos a enviar no cadastro
let imagensEdicaoPendentes   = [];  // arquivos a enviar na edição

// ── Inicialização ──────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  // URL da API = mesma origem da página (servida pelo FastAPI)
  API_URL = window.location.origin;
  document.getElementById("api-url").value = API_URL;
  verificarAPI();
});

// ── Configuração da API ────────────────────────────────────
function verificarAPI() {
  setStatus("checking");
  fetch(`${API_URL}/health`, { signal: AbortSignal.timeout(4000) })
    .then(r => {
      if (r.ok) { setStatus("online"); carregarPessoas(); }
      else       { setStatus("offline"); }
    })
    .catch(() => setStatus("offline"));
}

function setStatus(state) {
  const badge = document.getElementById("status-badge");
  const text  = document.getElementById("status-text");
  badge.className = `status-badge status-${state}`;
  const labels = { checking: "Verificando...", online: "API Conectada", offline: "Sem Conexão" };
  text.textContent = labels[state] ?? state;
}

// ── Cadastrar Pessoa ───────────────────────────────────────
async function cadastrarPessoa(event) {
  event.preventDefault();
  limparErros();

  const nome          = document.getElementById("cad-nome").value.trim();
  const identificador = document.getElementById("cad-identificador").value.trim();
  const email         = document.getElementById("cad-email").value.trim() || null;
  const nascimento    = document.getElementById("cad-nascimento").value || null;

  if (!validarCadastro(nome, identificador, email, nascimento)) return;

  const btn = document.getElementById("btn-cadastrar");
  setLoadingBtn(btn, true);

  try {
    // 1. Cria a pessoa
    const payload = { nome, identificador };
    if (email)     payload.email = email;
    if (nascimento) payload.data_nascimento = nascimento;

    const res = await fetch(`${API_URL}/pessoas`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      if (res.status === 409) {
        document.getElementById("err-identificador").textContent = "Identificador ou e-mail já cadastrado.";
      } else {
        toast("Erro ao cadastrar: " + (err.detail ?? res.statusText), "error");
      }
      return;
    }

    const pessoa = await res.json();

    // 2. Envia imagens se houver
    if (imagensCadastroPendentes.length > 0) {
      await enviarImagens(pessoa.id, imagensCadastroPendentes, "cadastro");
    }

    toast(`✓ ${pessoa.nome} cadastrado com sucesso!`, "success");
    document.getElementById("form-cadastro").reset();
    limparFormulario();
    carregarPessoas();

  } catch (e) {
    toast("Falha na conexão com a API.", "error");
  } finally {
    setLoadingBtn(btn, false);
  }
}

function validarCadastro(nome, identificador, email, nascimento) {
  let ok = true;
  if (!nome) {
    document.getElementById("err-nome").textContent = "Nome é obrigatório.";
    ok = false;
  }
  if (!identificador) {
    document.getElementById("err-identificador").textContent = "Identificador é obrigatório.";
    ok = false;
  }
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    document.getElementById("err-email").textContent = "E-mail inválido.";
    ok = false;
  }
  if (nascimento && new Date(nascimento) > new Date()) {
    document.getElementById("err-nascimento").textContent = "Data não pode ser no futuro.";
    ok = false;
  }
  return ok;
}

function limparErros() {
  ["err-nome", "err-identificador", "err-email", "err-nascimento"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.textContent = "";
  });
}

function limparFormulario() {
  imagensCadastroPendentes = [];
  const prev = document.getElementById("preview-container");
  if (prev) { prev.innerHTML = ""; prev.style.display = "none"; }
  limparErros();
}

// ── Upload de Imagens ──────────────────────────────────────
function previewImagens(event) {
  const files = Array.from(event.target.files);
  imagensCadastroPendentes = [...imagensCadastroPendentes, ...files];
  renderPreview("preview-container", imagensCadastroPendentes, "cadastro");
}

function previewImagensEdit(event) {
  const files = Array.from(event.target.files);
  imagensEdicaoPendentes = [...imagensEdicaoPendentes, ...files];
  renderPreview("preview-edit", imagensEdicaoPendentes, "edicao");
}

function renderPreview(containerId, files, tipo) {
  const container = document.getElementById(containerId);
  container.innerHTML = "";
  container.style.display = files.length ? "flex" : "none";

  files.forEach((file, idx) => {
    const url = URL.createObjectURL(file);
    const item = document.createElement("div");
    item.className = "preview-item";
    item.innerHTML = `
      <img src="${url}" alt="Foto ${idx + 1}" />
      <button class="remove-img" title="Remover" onclick="removerImagem(${idx}, '${tipo}')">×</button>`;
    container.appendChild(item);
  });
}

function removerImagem(idx, tipo) {
  if (tipo === "cadastro") {
    imagensCadastroPendentes.splice(idx, 1);
    renderPreview("preview-container", imagensCadastroPendentes, "cadastro");
  } else {
    imagensEdicaoPendentes.splice(idx, 1);
    renderPreview("preview-edit", imagensEdicaoPendentes, "edicao");
  }
}

async function enviarImagens(pessoaId, files, origem) {
  const erros = [];
  for (const file of files) {
    const form = new FormData();
    form.append("arquivo", file);
    try {
      const res = await fetch(`${API_URL}/pessoas/${pessoaId}/imagens`, {
        method: "POST",
        body: form,
      });
      if (!res.ok) erros.push(file.name);
    } catch {
      erros.push(file.name);
    }
  }
  if (erros.length) {
    toast(`⚠️ Falha ao enviar: ${erros.join(", ")}`, "warning");
  }
}

// ── Drag & Drop ────────────────────────────────────────────
function dragOver(e) {
  e.preventDefault();
  document.getElementById("dropzone").classList.add("active");
}
function dragLeave(e) {
  document.getElementById("dropzone").classList.remove("active");
}
function dropFiles(e) {
  e.preventDefault();
  document.getElementById("dropzone").classList.remove("active");
  const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith("image/"));
  imagensCadastroPendentes = [...imagensCadastroPendentes, ...files];
  renderPreview("preview-container", imagensCadastroPendentes, "cadastro");
}

// ── Listar Pessoas ─────────────────────────────────────────
async function carregarPessoas() {
  document.getElementById("pessoas-loading").style.display = "flex";
  document.getElementById("pessoas-empty").style.display   = "none";
  document.getElementById("tabela-pessoas").style.display  = "none";

  try {
    const res = await fetch(`${API_URL}/pessoas?limite=100`);
    if (!res.ok) throw new Error("Falha ao buscar pessoas.");
    todasPessoas = await res.json();
    renderTabela(todasPessoas);
  } catch (e) {
    toast("Erro ao carregar pessoas.", "error");
    document.getElementById("pessoas-loading").style.display = "none";
    document.getElementById("pessoas-empty").style.display = "flex";
  }
}

function renderTabela(pessoas) {
  document.getElementById("pessoas-loading").style.display = "none";

  if (pessoas.length === 0) {
    document.getElementById("pessoas-empty").style.display  = "flex";
    document.getElementById("tabela-pessoas").style.display = "none";
    return;
  }

  document.getElementById("pessoas-empty").style.display  = "none";
  document.getElementById("tabela-pessoas").style.display = "table";

  const tbody = document.getElementById("tbody-pessoas");
  tbody.innerHTML = pessoas.map(p => `
    <tr id="row-${p.id}">
      <td class="td-id">${p.id}</td>
      <td class="td-name">${escHtml(p.nome)}</td>
      <td class="td-mono">${escHtml(p.identificador)}</td>
      <td class="td-date">${p.email ? escHtml(p.email) : '<span style="color:var(--text-muted)">—</span>'}</td>
      <td class="td-date">${formatarData(p.data_registro)}</td>
      <td>
        <button class="badge-img" onclick="abrirImagens(${p.id})" title="Ver imagens faciais">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:12px;height:12px"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>
          Fotos
        </button>
      </td>
      <td class="td-actions">
        <button class="btn btn-edit" onclick="abrirEdicao(${p.id})">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          Editar
        </button>
        <button class="btn btn-danger" onclick="excluirPessoa(${p.id}, '${escHtml(p.nome)}')">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
          Excluir
        </button>
      </td>
    </tr>`).join("");
}

function filtrarPessoas() {
  const q = document.getElementById("busca-pessoa").value.toLowerCase();
  const filtrados = todasPessoas.filter(p =>
    p.nome.toLowerCase().includes(q) ||
    p.identificador.toLowerCase().includes(q) ||
    (p.email && p.email.toLowerCase().includes(q))
  );
  renderTabela(filtrados);
}

// ── Editar Pessoa ──────────────────────────────────────────
function abrirEdicao(id) {
  const p = todasPessoas.find(x => x.id === id);
  if (!p) return;

  document.getElementById("edit-id").value            = p.id;
  document.getElementById("edit-nome").value          = p.nome;
  document.getElementById("edit-identificador").value = p.identificador;
  document.getElementById("edit-email").value         = p.email ?? "";
  document.getElementById("edit-nascimento").value    = p.data_nascimento ?? "";
  imagensEdicaoPendentes = [];
  document.getElementById("preview-edit").innerHTML = "";
  document.getElementById("preview-edit").style.display = "none";

  // Carrega imagens salvas
  carregarImagensSalvas(id);
  document.getElementById("modal-editar").style.display = "grid";
}

async function carregarImagensSalvas(pessoaId) {
  const container    = document.getElementById("imagens-salvas");
  const containerBox = document.getElementById("imagens-salvas-container");
  container.innerHTML = "";

  try {
    const res = await fetch(`${API_URL}/pessoas/${pessoaId}/imagens`);
    const imgs = await res.json();
    if (!imgs.length) { containerBox.style.display = "none"; return; }

    containerBox.style.display = "block";
    imgs.forEach(img => {
      const item = document.createElement("div");
      item.className = "preview-item";
      item.innerHTML = `<img src="${API_URL}/pessoas/${pessoaId}/imagens/${img.id}/arquivo" alt="Foto ${img.id}" />`;
      container.appendChild(item);
    });
  } catch {
    containerBox.style.display = "none";
  }
}

async function salvarEdicao(event) {
  event.preventDefault();
  const id            = parseInt(document.getElementById("edit-id").value);
  const nome          = document.getElementById("edit-nome").value.trim();
  const identificador = document.getElementById("edit-identificador").value.trim();
  const email         = document.getElementById("edit-email").value.trim() || null;
  const nascimento    = document.getElementById("edit-nascimento").value || null;

  if (!nome || !identificador) {
    toast("Nome e identificador são obrigatórios.", "error"); return;
  }

  const payload = { nome, identificador };
  if (email)      payload.email = email;
  if (nascimento) payload.data_nascimento = nascimento;

  try {
    const res = await fetch(`${API_URL}/pessoas/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      toast("Erro ao salvar: " + (err.detail ?? res.statusText), "error");
      return;
    }

    // Envia imagens novas se houver
    if (imagensEdicaoPendentes.length > 0) {
      await enviarImagens(id, imagensEdicaoPendentes, "edicao");
    }

    toast("Dados atualizados com sucesso!", "success");
    fecharModal();
    carregarPessoas();
  } catch {
    toast("Falha na conexão com a API.", "error");
  }
}

// ── Excluir Pessoa ─────────────────────────────────────────
async function excluirPessoa(id, nome) {
  if (!confirm(`Excluir "${nome}"?\n\nEssa ação é irreversível e removerá todas as imagens faciais.`)) return;

  try {
    const res = await fetch(`${API_URL}/pessoas/${id}`, { method: "DELETE" });
    if (res.status === 204) {
      toast(`${nome} foi removido.`, "info");
      todasPessoas = todasPessoas.filter(p => p.id !== id);
      renderTabela(todasPessoas);
    } else {
      const err = await res.json().catch(() => ({}));
      toast("Erro ao excluir: " + (err.detail ?? res.statusText), "error");
    }
  } catch {
    toast("Falha na conexão com a API.", "error");
  }
}

// ── Imagens Faciais ────────────────────────────────────────
function abrirImagens(pessoaId) {
  const p = todasPessoas.find(x => x.id === pessoaId);
  if (p) abrirEdicao(pessoaId);
}

// ── Modal ──────────────────────────────────────────────────
function fecharModal(event) {
  if (event && event.target !== event.currentTarget) return;
  document.getElementById("modal-editar").style.display = "none";
  imagensEdicaoPendentes = [];
}
document.addEventListener("keydown", e => {
  if (e.key === "Escape") fecharModal();
});

// ── Toast Notifications ────────────────────────────────────
function toast(message, type = "info", duration = 4000) {
  const icons = {
    success: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M20 6L9 17l-5-5"/></svg>`,
    error:   `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`,
    info:    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`,
    warning: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
  };
  const el = document.createElement("div");
  el.className = `toast toast-${type}`;
  el.innerHTML = `${icons[type] ?? ""}<span>${message}</span>`;
  document.getElementById("toast-container").appendChild(el);
  setTimeout(() => el.remove(), duration);
}

// ── Utilitários ────────────────────────────────────────────
function escHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatarData(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("pt-BR", {
      day: "2-digit", month: "2-digit", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  } catch { return iso; }
}

function setLoadingBtn(btn, loading) {
  btn.disabled = loading;
  btn.textContent = loading ? "Aguarde..." : "";
  if (!loading) {
    btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6L9 17l-5-5"/></svg> Cadastrar Pessoa`;
  }
}
