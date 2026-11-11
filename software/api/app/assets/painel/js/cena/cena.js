// Cena 3D do painel. As telas só falam com a fachada devolvida por obterCena().

import { CENTROS, corDaJornada, corDoEstado, estadoDaJornada } from "./paleta.js";

const TOM_PARA_ESTADO = { ok: "aceito", wait: "validando", bad: "negado" };

// Comportamento de cada estado (spec §4).
const PARAMS = {
  aguardando: { brilho: 0.72, scanVel: 0.5, scanForca: 0.35, falha: 0, estab: 0.2, anel: 0, marcos: 0.4, partVel: 0.6, partAgito: 0 },
  validando: { brilho: 0.82, scanVel: 2.4, scanForca: 1.0, falha: 0, estab: 0.3, anel: 0, marcos: 0.6, partVel: 1.0, partAgito: 0.05 },
  aceito: { brilho: 1.0, scanVel: 0.0, scanForca: 0.0, falha: 0, estab: 1.0, anel: 1, marcos: 1.0, partVel: 1.5, partAgito: 0 },
  negado: { brilho: 0.88, scanVel: 1.2, scanForca: 0.7, falha: 1, estab: 0, anel: 0, marcos: 0.55, partVel: 1.8, partAgito: 0.35 },
  neutro: { brilho: 0.65, scanVel: 0.6, scanForca: 0.4, falha: 0, estab: 0.5, anel: 0, marcos: 0.45, partVel: 0.7, partAgito: 0 },
};

// Enquadramentos das telas de gestão: ângulo (graus), altura, raio, deslocamento lateral e intensidade.
const QUADROS = {
  pessoas: { angulo: 28, altura: 0.25, raio: 5.2, lateral: 1.9, intensidade: 0.38 },
  form: { angulo: -32, altura: 0.2, raio: 4.9, lateral: 1.8, intensidade: 0.42 },
  detalhe: { angulo: 55, altura: 0.3, raio: 5.4, lateral: 2.0, intensidade: 0.32 },
  neutro: { angulo: 0, altura: 0.2, raio: 5.0, lateral: 0, intensidade: 0.4 },
};

// Ângulo da câmera no centro de cada momento da jornada (graus). O rosto fica sempre
// visível; o caminho total soma cerca de 185°.
const ANGULOS_JORNADA = [0, 30, 55, -8, -48, -22];

const LARGURA_COMPACTA = 840;

// Abaixo disso a cena reduz resolução e partículas. Fica abaixo de 30 porque há telas e
// navegadores que limitam a animação a 30 quadros por segundo.
const FPS_MINIMO = 24;

function suave(t) {
  const x = Math.min(1, Math.max(0, t));
  return x * x * (3 - 2 * x);
}

export function anguloDaJornada(p) {
  const x = Math.min(1, Math.max(0, p));
  for (let i = 0; i < CENTROS.length - 1; i++) {
    if (x <= CENTROS[i + 1]) {
      const t = suave((x - CENTROS[i]) / (CENTROS[i + 1] - CENTROS[i]));
      return ANGULOS_JORNADA[i] + (ANGULOS_JORNADA[i + 1] - ANGULOS_JORNADA[i]) * t;
    }
  }
  return ANGULOS_JORNADA[ANGULOS_JORNADA.length - 1];
}

function fachadaInerte(motivo) {
  let enquadramento = "neutro";
  return {
    jornada() {},
    enquadrar(nome) {
      enquadramento = nome;
    },
    pulsar() {},
    soltar() {},
    destruir() {},
    estado: () => ({ ativa: false, motivo, quadros: 0, fps: 0, estado: "neutro", enquadramento, pontos: 0 }),
  };
}

// As telas guardam sempre a mesma fachada; a implementação por trás pode trocar
// (cena ainda carregando → cena real → inerte se o contexto WebGL for perdido).
let impl = fachadaInerte("não iniciada");
let ultimoEnquadramento = "neutro";

const cena = {
  jornada: (p) => impl.jornada(p),
  enquadrar(nome) {
    ultimoEnquadramento = nome;
    impl.enquadrar(nome);
  },
  pulsar: (tom, ms) => impl.pulsar(tom, ms),
  soltar: () => impl.soltar(),
  destruir: () => impl.destruir(),
  estado: () => impl.estado(),
  _degradar: () => impl._degradar?.(),
};

function trocar(nova) {
  impl = nova;
  impl.enquadrar(ultimoEnquadramento);
  return cena;
}

export function obterCena() {
  return cena;
}

function webglDisponivel() {
  try {
    const teste = document.createElement("canvas");
    return Boolean(teste.getContext("webgl2") || teste.getContext("webgl"));
  } catch {
    return false;
  }
}

export async function iniciarCena(canvas) {
  const raiz = document.documentElement;

  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    raiz.classList.add("movimento-reduzido", "sem-cena");
    return trocar(fachadaInerte("movimento reduzido"));
  }
  if (!webglDisponivel()) {
    raiz.classList.add("sem-cena");
    return trocar(fachadaInerte("sem WebGL"));
  }

  try {
    const [THREE, { criarFundo }, { criarParticulas }, { criarRosto }, modelo] = await Promise.all([
      import("three"),
      import("./fundo.js"),
      import("./particulas.js"),
      import("./rosto.js"),
      import("./modelo.js").then((m) => m.carregarModelo()),
    ]);
    return trocar(montar(THREE, canvas, { criarFundo, criarParticulas, criarRosto, modelo }));
  } catch (erro) {
    console.warn("Cena 3D indisponível:", erro?.message || erro);
    raiz.classList.add("sem-cena");
    return trocar(fachadaInerte("falha ao iniciar"));
  }
}

function montar(THREE, canvas, { criarFundo, criarParticulas, criarRosto, modelo }) {
  const raiz = document.documentElement;
  const toque = window.matchMedia("(pointer: coarse)").matches;

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: "high-performance" });
  let pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
  renderer.setPixelRatio(pixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.setClearColor(0x000000, 1);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 100);
  camera.position.set(0, 0.2, 5.0);
  scene.add(camera);

  const cor = new THREE.Color(...corDoEstado("neutro"));
  const comuns = {
    uTime: { value: 0 },
    uCor: { value: cor },
    uPixelRatio: { value: pixelRatio },
    uIntensidadeRosto: { value: 0.4 },
    uIntensidadeParticulas: { value: 0.5 },
  };
  const uniformsFundo = {
    uTime: comuns.uTime,
    uCor: comuns.uCor,
    uResolution: { value: new THREE.Vector2(window.innerWidth * pixelRatio, window.innerHeight * pixelRatio) },
    uMouse: { value: new THREE.Vector2(0, 0) },
    uScroll: { value: 0 },
    uIntensidade: { value: 0.4 },
  };

  camera.add(criarFundo(THREE, uniformsFundo));
  const particulas = criarParticulas(THREE, 450, comuns);
  scene.add(particulas.objeto);
  const rosto = criarRosto(THREE, { pontos: toque ? 7000 : 24000, uniformsComuns: comuns, modelo });
  scene.add(rosto.grupo);

  // ── Estado ──
  let enquadramento = "neutro";
  let progresso = 0;
  let progressoAnterior = 0;
  let pulso = null; // { estado, ate }
  let pulsoPreso = 0; // pulsos 'wait' sem prazo (envio em andamento)
  const atual = { ...PARAMS.neutro, intensidade: 0.4 };
  const corAlvo = new THREE.Color();
  const alvoCamera = new THREE.Vector3();
  const mira = new THREE.Vector3();
  const miraAtual = new THREE.Vector3();
  const mouse = { x: 0, y: 0, alvoX: 0, alvoY: 0 };

  let quadros = 0;
  let fps = 60;
  let tempo = 0;
  let ultimo = performance.now();
  let raf = 0;
  let rodando = false;
  let destruida = false;
  let degradada = false;
  let janelaTempo = 0;
  let janelaQuadros = 0;
  let janelasLentas = 0;

  function estadoAtual(agora) {
    if (pulsoPreso > 0) return "validando";
    if (pulso) {
      if (agora < pulso.ate) return pulso.estado;
      pulso = null;
    }
    return enquadramento === "jornada" ? estadoDaJornada(progresso) : "neutro";
  }

  function quadroDaCamera() {
    if (enquadramento !== "jornada") return QUADROS[enquadramento] || QUADROS.neutro;
    const arco = Math.sin(progresso * Math.PI);
    return {
      angulo: anguloDaJornada(progresso),
      altura: 0.15 + arco * 0.4,
      raio: 4.5 - arco * 0.3,
      lateral: 0.95 + suave((progresso - 0.86) / 0.14) * 0.35,
      intensidade: 1,
    };
  }

  function aproximar(fator, dt) {
    return 1 - Math.pow(1 - fator, dt * 60);
  }

  function quadro(agoraMs) {
    if (!rodando) return;
    raf = requestAnimationFrame(quadro);

    const dt = Math.min(0.1, Math.max(0, (agoraMs - ultimo) / 1000));
    ultimo = agoraMs;
    tempo += dt;
    quadros += 1;

    // Guarda de desempenho: duas janelas seguidas de 2 s abaixo do limite reduzem a carga, uma única vez.
    janelaTempo += dt;
    janelaQuadros += 1;
    if (janelaTempo >= 2) {
      fps = janelaQuadros / janelaTempo;
      janelasLentas = fps < FPS_MINIMO ? janelasLentas + 1 : 0;
      if (!degradada && janelasLentas >= 2) degradar();
      janelaTempo = 0;
      janelaQuadros = 0;
    }

    const nome = estadoAtual(agoraMs);
    const alvo = PARAMS[nome];
    const q = quadroDaCamera();
    const k = aproximar(0.05, dt);
    for (const chave of Object.keys(alvo)) atual[chave] += (alvo[chave] - atual[chave]) * k;
    atual.intensidade += (q.intensidade - atual.intensidade) * k;

    // Cor: contínua ao longo da jornada; fixa por estado nos pulsos e nas outras telas.
    const emPulso = pulso !== null || pulsoPreso > 0;
    const rgb = enquadramento === "jornada" && !emPulso ? corDaJornada(progresso) : corDoEstado(nome);
    corAlvo.setRGB(rgb[0], rgb[1], rgb[2]);
    cor.lerp(corAlvo, aproximar(0.08, dt));

    // Câmera
    const compacta = window.innerWidth < LARGURA_COMPACTA;
    const ang = (q.angulo * Math.PI) / 180;
    const raio = q.raio + (compacta ? 1.1 : 0);
    alvoCamera.set(raio * Math.sin(ang), q.altura, raio * Math.cos(ang));
    camera.position.lerp(alvoCamera, k);
    // Desloca a mira para o lado oposto, deixando o rosto à direita do texto.
    const lateral = compacta ? 0 : q.lateral;
    mira.set(-Math.cos(ang) * lateral, compacta ? -0.75 : -0.05, Math.sin(ang) * lateral);
    miraAtual.lerp(mira, k);
    camera.lookAt(miraAtual);

    // Rosto acompanha o ponteiro.
    const km = aproximar(0.05, dt);
    mouse.x += (mouse.alvoX - mouse.x) * km;
    mouse.y += (mouse.alvoY - mouse.y) * km;
    rosto.grupo.rotation.y = mouse.x * 0.25;
    rosto.grupo.rotation.x = mouse.y * 0.15;

    const velocidadeScroll = Math.min(1, Math.abs(progresso - progressoAnterior) / Math.max(dt, 0.001));
    progressoAnterior = progresso;

    comuns.uTime.value = tempo;
    comuns.uIntensidadeRosto.value = atual.intensidade;
    comuns.uIntensidadeParticulas.value = 0.35 + atual.intensidade * 0.65;
    uniformsFundo.uIntensidade.value = atual.intensidade;
    uniformsFundo.uScroll.value = progresso;
    uniformsFundo.uMouse.value.set(mouse.x, -mouse.y);

    rosto.atualizar(dt, tempo, { ...atual, cor });
    particulas.atualizar(dt, tempo, atual.partVel * (1 + velocidadeScroll * 6), atual.partAgito + velocidadeScroll * 0.8);

    renderer.render(scene, camera);
  }

  function degradar() {
    degradada = true;
    pixelRatio = 1;
    renderer.setPixelRatio(1);
    comuns.uPixelRatio.value = 1;
    particulas.reduzir();
    redimensionar();
  }

  function iniciarLaco() {
    if (rodando || destruida || document.hidden) return;
    rodando = true;
    ultimo = performance.now();
    raf = requestAnimationFrame(quadro);
  }

  function pararLaco() {
    rodando = false;
    cancelAnimationFrame(raf);
  }

  function redimensionar() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    uniformsFundo.uResolution.value.set(w * pixelRatio, h * pixelRatio);
  }

  function aoMover(e) {
    mouse.alvoX = (e.clientX / window.innerWidth) * 2 - 1;
    mouse.alvoY = (e.clientY / window.innerHeight) * 2 - 1;
  }

  function aoVisibilidade() {
    if (document.hidden) pararLaco();
    else iniciarLaco();
  }

  function aoPerderContexto(e) {
    e.preventDefault();
    destruir();
    raiz.classList.remove("com-cena");
    raiz.classList.add("sem-cena");
    trocar(fachadaInerte("contexto perdido"));
  }

  function destruir() {
    if (destruida) return;
    destruida = true;
    pararLaco();
    window.removeEventListener("resize", redimensionar);
    window.removeEventListener("pointermove", aoMover);
    document.removeEventListener("visibilitychange", aoVisibilidade);
    canvas.removeEventListener("webglcontextlost", aoPerderContexto);
  }

  window.addEventListener("resize", redimensionar);
  if (!toque) window.addEventListener("pointermove", aoMover, { passive: true });
  document.addEventListener("visibilitychange", aoVisibilidade);
  canvas.addEventListener("webglcontextlost", aoPerderContexto);

  raiz.classList.add("com-cena");
  iniciarLaco();

  const api = {
    jornada(p) {
      progresso = Math.min(1, Math.max(0, Number.isFinite(p) ? p : 0));
    },
    enquadrar(nome) {
      enquadramento = nome === "jornada" || QUADROS[nome] ? nome : "neutro";
    },
    // pulsar('wait', 0) mantém o estado até a próxima chamada com 'ok' ou 'bad' (ou soltar()).
    pulsar(tom, duracaoMs = 1200) {
      const estado = TOM_PARA_ESTADO[tom];
      if (!estado) return;
      if (tom === "wait" && duracaoMs === 0) {
        pulsoPreso += 1;
        return;
      }
      pulso = { estado, ate: performance.now() + duracaoMs };
    },
    soltar() {
      pulsoPreso = Math.max(0, pulsoPreso - 1);
    },
    destruir,
    estado: () => ({
      ativa: !destruida,
      rodando,
      quadros,
      fps: Math.round(fps),
      estado: estadoAtual(performance.now()),
      enquadramento,
      pontos: rosto.pontos,
      particulas: particulas.quantidade(),
      pixelRatio,
      degradada,
      particulasFora: particulas.foraDosLimites(),
    }),
    // Usado só na verificação: força a guarda de desempenho.
    _degradar: () => {
      if (!degradada) degradar();
    },
  };
  return api;
}
