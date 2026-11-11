import { buscarPessoa, enviarImagem, excluirPessoa, listarImagens, urlImagem } from "../api.js";
import { obterCena } from "../cena/cena.js";
import { copiarTexto, formatarData, formatarDataHora, h, icone } from "../dom.js";
import { dividirLetras } from "../efeitos/letras.js";
import { aplicarTilt } from "../efeitos/tilt.js";
import { navegar } from "../router.js";
import { abrirModal, confirmar } from "../ui/modal.js";
import { toast } from "../ui/toast.js";
import { abrirCamera, cameraDisponivel } from "./camera.js";
import { render as renderNaoEncontrado } from "./nao-encontrado.js";
import { blocoErro } from "../ui/erro.js";
import { avatar } from "./pessoas.js";

const TAMANHO_MAXIMO = 5 * 1024 * 1024;
const TIPOS = new Set(["image/jpeg", "image/png"]);
const MIME_CURTO = { "image/jpeg": "JPEG", "image/png": "PNG" };

export function render(container, params) {
  let vivo = true;
  const abertos = new Set(); // câmera/modais a fechar na saída da rota
  const limpezas = []; // inclinações a desfazer na saída da rota

  obterCena().enquadrar("detalhe");

  container.append(h("div", { class: "pagina" }, h("div", { class: "panel" }, h("span", { class: "skeleton", style: { width: "40%" } }))));

  async function carregar() {
    try {
      const [pessoa, imagens] = await Promise.all([buscarPessoa(params.id), listarImagens(params.id)]);
      if (!vivo) return;
      container.replaceChildren();
      montar(container, pessoa, imagens, params, abertos, () => vivo, limpezas);
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

  return () => {
    vivo = false;
    for (const item of abertos) item.fechar();
    abertos.clear();
    limpezas.forEach((fn) => fn());
    limpezas.length = 0;
  };
}

function montar(container, pessoa, imagensIniciais, params, abertos, estaVivo, limpezas) {
  let imagens = imagensIniciais;
  const cena = obterCena();
  let tiltsFotos = [];
  limpezas.push(() => tiltsFotos.forEach((fn) => fn()));

  // ── Cabeçalho ──
  const avatarSlot = h("div");
  const copiarId = h(
    "button",
    {
      type: "button",
      class: "btn btn--sm btn--ghost",
      "aria-label": `Copiar ID ${pessoa.id}`,
      onClick: async () => {
        try {
          await copiarTexto(String(pessoa.id));
          toast(`ID ${pessoa.id} copiado.`, "ok");
        } catch {
          toast("Não foi possível copiar.", "erro");
        }
      },
    },
    icone("copiar"),
  );

  const excluir = h("button", { type: "button", class: "btn btn--danger" }, icone("lixo"), "Excluir");
  excluir.addEventListener("click", async () => {
    const ok = await confirmar({
      titulo: "Excluir pessoa",
      mensagem: h(
        "p",
        {},
        "Excluir ",
        h("strong", {}, pessoa.nome),
        "? As fotos desta pessoa também serão removidas. Esta ação não pode ser desfeita.",
      ),
      rotuloConfirmar: "Excluir",
      perigo: true,
    });
    if (!ok) return;
    excluir.disabled = true;
    try {
      await excluirPessoa(pessoa.id);
      cena.pulsar("bad");
      toast("Pessoa excluída.", "ok");
      navegar("#/pessoas");
    } catch (erro) {
      excluir.disabled = false;
      toast(erro.mensagem || "Não foi possível excluir.", "erro");
    }
  });

  // ── Fotos ──
  const tituloFotos = h("span");
  const galeria = h("div");
  const avisoTreino = h(
    "div",
    { class: "notice notice--warn", hidden: true, role: "status" },
    h("span", {}, h("strong", {}, "Retreine o modelo no Pi para aplicar "), "(", h("code", {}, "python treinar.py"), ")."),
  );

  function desenharFotos() {
    tituloFotos.textContent = `Fotos (${imagens.length})`;
    avatarSlot.replaceChildren(avatar(pessoa, { primeira: imagens[0]?.id ?? null }, "avatar avatar--lg"));

    if (imagens.length === 0) {
      galeria.replaceChildren(
        h(
          "div",
          { class: "panel empty" },
          h("h2", {}, "Nenhuma foto ainda"),
          h("p", {}, "Sem fotos, esta pessoa não será reconhecida. Envie de 3 a 5 fotos."),
        ),
      );
      return;
    }

    tiltsFotos.forEach((fn) => fn());
    const botoes = [];
    galeria.replaceChildren(
      h(
        "div",
        { class: "photos" },
        imagens.map((img, i) => {
          const meta = `${img.largura}×${img.altura} · ${MIME_CURTO[img.tipo_mime] || img.tipo_mime} · ${formatarData(img.data_registro)}`;
          const botao = h(
            "button",
            {
              type: "button",
              class: "photo",
              "aria-label": `Ampliar foto ${i + 1} de ${imagens.length} (${meta})`,
              onClick: () => ampliar(img, meta),
            },
            h("img", { src: urlImagem(pessoa.id, img.id), alt: "", loading: "lazy", decoding: "async" }),
            h("span", { class: "photo__meta", "aria-hidden": "true" }, meta),
          );
          botoes.push(botao);
          return botao;
        }),
      ),
    );
    tiltsFotos = botoes.map((el) => aplicarTilt(el, { max: 6 }));
  }

  function ampliar(img, meta) {
    const m = abrirModal({
      titulo: `Foto #${img.id}`,
      largo: true,
      conteudo: h(
        "div",
        { class: "viewer" },
        h("img", { src: urlImagem(pessoa.id, img.id), alt: `Foto facial de ${pessoa.nome}` }),
        h("p", { class: "mono small", style: { marginTop: "10px" } }, `${meta} · enviada em ${formatarDataHora(img.data_registro)}`),
      ),
      aoFechar: () => abertos.delete(m),
    });
    abertos.add(m);
  }

  async function recarregarFotos() {
    try {
      const novas = await listarImagens(pessoa.id);
      if (!estaVivo()) return;
      imagens = novas;
      desenharFotos();
    } catch {
      /* a galeria antiga continua visível */
    }
  }

  // ── Envio ──
  const listaEnvios = h("ul", { class: "uploads", "aria-live": "polite" });
  const seletor = h("input", { type: "file", accept: "image/jpeg,image/png", multiple: true, hidden: true });
  const dropzone = h(
    "div",
    { class: "dropzone", role: "button", tabindex: "0", "aria-label": "Selecionar fotos para enviar" },
    icone("upload"),
    h("p", {}, h("strong", {}, "Arraste fotos aqui"), " ou clique para selecionar"),
    h("p", { class: "small" }, "JPEG ou PNG · até 5 MB · um único rosto"),
  );

  dropzone.addEventListener("click", () => seletor.click());
  dropzone.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      seletor.click();
    }
  });
  dropzone.addEventListener("dragover", (e) => {
    e.preventDefault();
    dropzone.classList.add("is-over");
  });
  dropzone.addEventListener("dragleave", () => dropzone.classList.remove("is-over"));
  dropzone.addEventListener("drop", (e) => {
    e.preventDefault();
    dropzone.classList.remove("is-over");
    enviarArquivos([...(e.dataTransfer?.files || [])]);
  });
  seletor.addEventListener("change", () => {
    enviarArquivos([...seletor.files]);
    seletor.value = "";
  });

  let fila = Promise.resolve();

  function itemEnvio(nome) {
    const ledSlot = h("span", { class: "led led--idle led--on" }, h("span", { class: "led__dot" }));
    const msg = h("span", { class: "upload__msg" }, "Na fila…");
    const li = h("li", { class: "upload" }, ledSlot, h("span", { class: "upload__name" }, nome), msg);
    listaEnvios.prepend(li);
    return {
      estado(tipo, texto) {
        li.className = `upload upload--${tipo}`;
        ledSlot.className = `led led--on led--${{ enviando: "wait", ok: "ok", erro: "bad" }[tipo]}`;
        msg.textContent = texto;
      },
    };
  }

  function validarArquivo(arquivo) {
    if (!TIPOS.has(arquivo.type)) return "Formato não suportado. Use JPEG ou PNG.";
    if (arquivo.size > TAMANHO_MAXIMO) return "Arquivo maior que 5 MB.";
    if (arquivo.size === 0) return "O arquivo está vazio.";
    return null;
  }

  async function enviarUm(blob, nome, item) {
    item.estado("enviando", "Enviando…");
    cena.pulsar("wait", 0); // âmbar enquanto o envio durar
    try {
      await enviarImagem(pessoa.id, blob, nome);
      cena.soltar();
      cena.pulsar("ok");
      if (!estaVivo()) return;
      item.estado("ok", "Enviada.");
      avisoTreino.hidden = false;
      await recarregarFotos();
    } catch (erro) {
      cena.soltar();
      cena.pulsar("bad");
      item.estado("erro", erro.mensagem || "Falha no envio.");
      throw erro;
    }
  }

  function enviarArquivos(arquivos) {
    for (const arquivo of arquivos) {
      const item = itemEnvio(arquivo.name);
      const problema = validarArquivo(arquivo);
      if (problema) {
        item.estado("erro", problema);
        cena.pulsar("bad");
        continue;
      }
      fila = fila.then(() => (estaVivo() ? enviarUm(arquivo, arquivo.name, item).catch(() => {}) : undefined));
    }
  }

  // ── Webcam ──
  const disponibilidade = cameraDisponivel();
  const botaoCamera = h(
    "button",
    { type: "button", class: "btn", disabled: !disponibilidade.ok, "aria-describedby": "camera-motivo" },
    icone("camera"),
    "Usar webcam",
  );
  const motivoCamera = h("p", { class: "field__hint", id: "camera-motivo" }, disponibilidade.ok ? "Captura direto do navegador." : disponibilidade.motivo);

  botaoCamera.addEventListener("click", () => {
    let contador = 0;
    const camera = abrirCamera({
      aoCapturar: async (blob) => {
        contador += 1;
        const nome = `webcam-${Date.now()}.jpg`;
        await enviarUm(blob, nome, itemEnvio(`webcam · captura ${contador}`));
      },
    });
    abertos.add(camera);
  });

  const painelEnvio = h(
    "div",
    { class: "panel photo-add", id: "enviar-fotos", tabindex: "-1" },
    h("h3", { class: "panel__title" }, "Adicionar fotos"),
    dropzone,
    seletor,
    h("div", { class: "actions", style: { alignItems: "center" } }, botaoCamera),
    motivoCamera,
    listaEnvios,
    avisoTreino,
  );

  // ── Montagem ──
  const titulo = h("h1", { class: "titulo-pagina" }, pessoa.nome);
  dividirLetras(titulo, { revelar: true });

  const pagina = h("div", { class: "pagina" });
  container.append(pagina);
  pagina.append(
    h("a", { class: "back", href: "#/pessoas" }, icone("voltar"), "Pessoas"),
    h(
      "header",
      { class: "profile" },
      avatarSlot,
      h(
        "div",
        { class: "profile__main" },
        h("span", { class: "eyebrow" }, "Pessoa"),
        titulo,
        h(
          "div",
          { class: "id-chip", title: "Use este ID no webcam.py" },
          h("span", {}, "ID ", h("b", {}, `#${pessoa.id}`)),
          copiarId,
        ),
      ),
      h(
        "div",
        { class: "actions" },
        h("a", { class: "btn", href: `#/pessoas/${pessoa.id}/editar` }, icone("editar"), "Editar"),
        excluir,
      ),
    ),
    h(
      "dl",
      { class: "profile__facts" },
      fato("Identificador", pessoa.identificador, true),
      fato("E-mail", pessoa.email || "—"),
      fato("Nascimento", formatarData(pessoa.data_nascimento)),
      fato("Cadastro", formatarDataHora(pessoa.data_registro)),
    ),
    h(
      "section",
      { class: "section" },
      h("div", { class: "section-label" }, tituloFotos),
      h(
        "div",
        { class: "grid grid--split" },
        h(
          "div",
          { class: "grid", style: { alignContent: "start" } },
          galeria,
          h("p", { class: "small muted" }, "Fotos não podem ser removidas pela interface."),
        ),
        painelEnvio,
      ),
    ),
  );

  desenharFotos();

  if (params.query.get("novo") === "1") {
    painelEnvio.scrollIntoView({ block: "center" });
    painelEnvio.focus({ preventScroll: true });
  }
}

function fato(rotulo, valor, mono = false) {
  return h("div", { class: "fact" }, h("dt", {}, rotulo), h("dd", { class: mono ? "mono" : null }, valor));
}
