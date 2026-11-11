import { h, icone } from "../dom.js";
import { abrirModal } from "../ui/modal.js";

const QUALIDADE = 0.92;

export function cameraDisponivel() {
  if (!window.isSecureContext) {
    return { ok: false, motivo: "A câmera só funciona em localhost ou HTTPS. Use o envio de arquivo." };
  }
  if (!navigator.mediaDevices?.getUserMedia) {
    return { ok: false, motivo: "Este navegador não permite acesso à câmera. Use o envio de arquivo." };
  }
  return { ok: true };
}

function mensagemErro(erro) {
  switch (erro?.name) {
    case "NotAllowedError":
    case "SecurityError":
      return "Permissão da câmera negada.";
    case "NotFoundError":
    case "OverconstrainedError":
      return "Nenhuma câmera encontrada.";
    case "NotReadableError":
      return "A câmera está em uso por outro aplicativo.";
    default:
      return "Não foi possível abrir a câmera.";
  }
}

// aoCapturar(blob) deve lançar erro com .mensagem quando o envio falhar.
export function abrirCamera({ aoCapturar }) {
  let fluxo = null;
  let fechado = false;

  const video = h("video", { autoplay: true, playsinline: true, muted: true, "aria-label": "Imagem ao vivo da câmera" });
  const canvas = h("canvas", { hidden: true, "aria-label": "Foto capturada" });
  const guia = h("div", { class: "camera__guide", "aria-hidden": "true" });
  const selo = h("span", { class: "camera__rec" }, "● AO VIVO");
  const status = h("p", { class: "small", role: "status", "aria-live": "polite" }, "Abrindo a câmera…");

  const capturar = h("button", { type: "button", class: "btn btn--primary", disabled: true }, icone("camera"), "Capturar");
  const enviar = h("button", { type: "button", class: "btn btn--primary", hidden: true }, icone("upload"), "Enviar foto");
  const refazer = h("button", { type: "button", class: "btn btn--ghost", hidden: true }, "Refazer");

  const conteudo = h(
    "div",
    { class: "camera" },
    h("div", { class: "camera__stage" }, video, canvas, guia, selo),
    h("p", { class: "small muted" }, "Centralize um único rosto no oval, de frente e bem iluminado."),
    status,
    h("div", { class: "actions" }, capturar, enviar, refazer),
  );

  const modal = abrirModal({ titulo: "Capturar pela webcam", conteudo, largo: true, aoFechar: parar });

  function parar() {
    fechado = true;
    fluxo?.getTracks().forEach((t) => t.stop());
    fluxo = null;
    video.srcObject = null;
  }

  function modoAoVivo() {
    canvas.hidden = true;
    video.hidden = false;
    guia.hidden = false;
    selo.hidden = false;
    capturar.hidden = false;
    capturar.disabled = false;
    enviar.hidden = true;
    refazer.hidden = true;
  }

  function modoPrevia() {
    canvas.hidden = false;
    video.hidden = true;
    guia.hidden = true;
    selo.hidden = true;
    capturar.hidden = true;
    enviar.hidden = false;
    enviar.disabled = false;
    refazer.hidden = false;
    enviar.focus();
  }

  capturar.addEventListener("click", () => {
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d").drawImage(video, 0, 0);
    status.textContent = "Confira a foto antes de enviar.";
    modoPrevia();
  });

  refazer.addEventListener("click", () => {
    status.textContent = "";
    modoAoVivo();
    capturar.focus();
  });

  enviar.addEventListener("click", async () => {
    enviar.disabled = true;
    refazer.disabled = true;
    status.textContent = "Enviando…";
    try {
      const blob = await new Promise((ok, falha) =>
        canvas.toBlob((b) => (b ? ok(b) : falha(new Error("captura"))), "image/jpeg", QUALIDADE),
      );
      await aoCapturar(blob);
      if (fechado) return;
      status.textContent = "Foto enviada. Capture outra ou feche a janela.";
      modoAoVivo();
    } catch (erro) {
      if (fechado) return;
      status.textContent = erro?.mensagem || "Não foi possível enviar a foto.";
    } finally {
      refazer.disabled = false;
    }
  });

  navigator.mediaDevices
    .getUserMedia({ video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 960 } }, audio: false })
    .then((stream) => {
      if (fechado) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      fluxo = stream;
      video.srcObject = stream;
      status.textContent = "";
      modoAoVivo();
      capturar.focus();
    })
    .catch((erro) => {
      if (fechado) return;
      status.textContent = `${mensagemErro(erro)} Use o envio de arquivo.`;
      selo.hidden = true;
    });

  return {
    fechar: modal.fechar,
    video,
  };
}
