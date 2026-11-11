// Rosto procedural: nuvem de pontos sombreada, malha de contorno, marcos faciais,
// linha de scanner e anel de confirmação.

function gauss(x, y, cx, cy, sx, sy) {
  const dx = (x - cx) / sx;
  const dy = (y - cy) / sy;
  return Math.exp(-(dx * dx + dy * dy));
}

function par(x, y, cx, cy, sx, sy) {
  return gauss(x, y, cx, cy, sx, sy) + gauss(x, y, -cx, cy, sx, sy);
}

// Leva um ponto da esfera unitária (x direita, y cima, z frente) ao ponto do rosto.
export function deformar(x, y, z) {
  // Proporção humana: largura ~0,74 da altura; a mandíbula é quase tão larga quanto as maçãs.
  let px = x * 0.74;
  let py = y * 1.04;
  let pz = z * (z < 0 ? 0.92 : 0.82);

  // Mandíbula: compensa o afinamento natural da esfera e só fecha perto do queixo.
  if (y < 0) {
    px *= 1 + 0.07 * gauss(y, 0, -0.5, 0, 0.3, 1);
    const t = Math.min(1, Math.max(0, (-0.62 - y) / 0.38));
    px *= 1 - 0.18 * t * t;
    if (z < 0) pz *= 1 - 0.3 * Math.min(1, -y);
  }
  // Topo da cabeça um pouco mais achatado.
  if (y > 0.6) py -= 0.05 * Math.pow((y - 0.6) / 0.4, 2);

  // Orelhas.
  if (Math.abs(x) > 0.7) {
    px += Math.sign(x) * 0.08 * gauss(y, z, 0.02, -0.08, 0.16, 0.12);
  }

  // Traços: só na metade frontal, sumindo suavemente nas laterais.
  if (z > 0) {
    const frente = Math.min(1, z * 2.0);
    let d = 0;
    d += 0.27 * gauss(x, y, 0, -0.13, 0.1, 0.12); // ponta do nariz
    d += 0.11 * gauss(x, y, 0, 0.07, 0.06, 0.2); // dorso do nariz
    d += 0.07 * par(x, y, 0.085, -0.17, 0.05, 0.05); // asas do nariz
    d += 0.07 * par(x, y, 0.3, 0.31, 0.2, 0.055); // sobrancelhas
    d -= 0.13 * par(x, y, 0.3, 0.17, 0.13, 0.08); // órbitas
    d += 0.045 * par(x, y, 0.3, 0.165, 0.07, 0.04); // globos oculares
    d += 0.05 * par(x, y, 0.45, -0.06, 0.16, 0.14); // maçãs do rosto
    d -= 0.035 * par(x, y, 0.3, -0.4, 0.14, 0.2); // bochechas
    d += 0.075 * gauss(x, y, 0, -0.355, 0.16, 0.04); // lábio superior
    d += 0.07 * gauss(x, y, 0, -0.455, 0.14, 0.045); // lábio inferior
    d -= 0.05 * gauss(x, y, 0, -0.405, 0.2, 0.016); // linha da boca
    d -= 0.03 * gauss(x, y, 0, -0.27, 0.035, 0.05); // filtro
    d -= 0.035 * gauss(x, y, 0, -0.56, 0.18, 0.04); // sulco do queixo
    d += 0.1 * gauss(x, y, 0, -0.7, 0.17, 0.1); // queixo
    d += 0.02 * gauss(x, y, 0, 0.6, 0.5, 0.25); // testa
    pz += d * frente;
  }

  return [px, py, pz];
}

function normalizar(v) {
  const n = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / n, v[1] / n, v[2] / n];
}

// Normal da superfície deformada, por diferenças finitas sobre a esfera.
export function normalEm(x, y, z) {
  const e = 0.012;
  const ref = Math.abs(y) < 0.9 ? [0, 1, 0] : [1, 0, 0];
  const t1 = normalizar([ref[1] * z - ref[2] * y, ref[2] * x - ref[0] * z, ref[0] * y - ref[1] * x]);
  const t2 = [y * t1[2] - z * t1[1], z * t1[0] - x * t1[2], x * t1[1] - y * t1[0]];
  const p0 = deformar(x, y, z);
  const a = normalizar([x + t1[0] * e, y + t1[1] * e, z + t1[2] * e]);
  const b = normalizar([x + t2[0] * e, y + t2[1] * e, z + t2[2] * e]);
  const pa = deformar(a[0], a[1], a[2]);
  const pb = deformar(b[0], b[1], b[2]);
  const u = [pa[0] - p0[0], pa[1] - p0[1], pa[2] - p0[2]];
  const v = [pb[0] - p0[0], pb[1] - p0[1], pb[2] - p0[2]];
  let n = normalizar([u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]]);
  if (n[0] * x + n[1] * y + n[2] * z < 0) n = [-n[0], -n[1], -n[2]];
  return n;
}

// Gerador determinístico: o rosto é sempre o mesmo entre recarregamentos.
function aleatorio(semente) {
  let s = semente >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function novoBuffer() {
  return { posicoes: [], normais: [], sementes: [] };
}

function empurrar(buffer, x, y, z, semente, afastar = 1) {
  const p = deformar(x, y, z);
  const n = normalEm(x, y, z);
  buffer.posicoes.push(p[0] * afastar, p[1] * afastar, p[2] * afastar);
  buffer.normais.push(n[0], n[1], n[2]);
  buffer.sementes.push(semente);
}

function gerarPontos(total) {
  const rnd = aleatorio(20261111);
  const b = novoBuffer();
  const nPescoco = Math.floor(total * 0.13);
  const nCabeca = total - nPescoco;
  const aureo = Math.PI * (3 - Math.sqrt(5));
  const candidatos = Math.floor(nCabeca * 1.75);

  for (let i = 0; i < candidatos && b.sementes.length < nCabeca; i++) {
    const y = 1 - (2 * (i + 0.5)) / candidatos;
    const r = Math.sqrt(1 - y * y);
    const ang = i * aureo;
    const x = Math.cos(ang) * r;
    const z = Math.sin(ang) * r;
    if (z < 0.05 && rnd() > 0.3) continue; // mais densidade no rosto do que na nuca
    if (y < -0.93) continue; // base coberta pelo pescoço
    empurrar(b, x, y, z, rnd());
  }

  // Pescoço e ombros.
  while (b.sementes.length < total) {
    const y = -0.82 - rnd() * 0.98;
    const ang = rnd() * Math.PI * 2;
    const abre = y < -1.32 ? Math.pow((-1.32 - y) / 0.48, 2) : 0;
    const rx = 0.33 + abre * 1.05;
    const rz = 0.36 + abre * 0.2;
    b.posicoes.push(Math.cos(ang) * rx, y, Math.sin(ang) * rz - 0.12);
    const n = normalizar([Math.cos(ang) * rz, abre * 0.9, Math.sin(ang) * rx]);
    b.normais.push(n[0], n[1], n[2]);
    b.sementes.push(rnd());
  }
  return b;
}

// Malha de contorno: paralelos e meridianos da esfera deformada.
function gerarMalha(paralelos, meridianos, segmentos) {
  const b = novoBuffer();
  for (let n = 0; n < paralelos; n++) {
    const y = -0.9 + (1.86 * n) / (paralelos - 1);
    const r = Math.sqrt(Math.max(0, 1 - y * y));
    for (let s = 0; s < segmentos; s++) {
      for (const k of [s, s + 1]) {
        const ang = (k / segmentos) * Math.PI * 2;
        empurrar(b, Math.sin(ang) * r, y, Math.cos(ang) * r, 0.5);
      }
    }
  }
  for (let m = 0; m < meridianos; m++) {
    const ang = (m / meridianos) * Math.PI * 2;
    for (let s = 0; s < segmentos; s++) {
      for (const k of [s, s + 1]) {
        const lat = -1.12 + (2.55 * k) / segmentos; // de perto do queixo ao topo
        const y = Math.sin(lat);
        const r = Math.cos(lat);
        empurrar(b, Math.sin(ang) * r, y, Math.cos(ang) * r, 0.5);
      }
    }
  }
  return b;
}

// Marcos faciais (coordenadas x, y sobre a esfera; z é derivado).
const MARCOS = [
  { fechado: false, pontos: [[-0.8, 0.05], [-0.77, -0.2], [-0.68, -0.44], [-0.52, -0.65], [-0.29, -0.81], [0, -0.87], [0.29, -0.81], [0.52, -0.65], [0.68, -0.44], [0.77, -0.2], [0.8, 0.05]] },
  { fechado: false, pontos: [[0.13, 0.3], [0.3, 0.36], [0.48, 0.3]] },
  { fechado: false, pontos: [[-0.13, 0.3], [-0.3, 0.36], [-0.48, 0.3]] },
  { fechado: true, pontos: [[0.19, 0.17], [0.3, 0.215], [0.41, 0.17], [0.3, 0.13]] },
  { fechado: true, pontos: [[-0.19, 0.17], [-0.3, 0.215], [-0.41, 0.17], [-0.3, 0.13]] },
  { fechado: false, pontos: [[0, 0.22], [0, 0.07], [0, -0.13]] },
  { fechado: false, pontos: [[-0.11, -0.2], [0, -0.225], [0.11, -0.2]] },
  { fechado: true, pontos: [[-0.2, -0.405], [-0.08, -0.35], [0, -0.365], [0.08, -0.35], [0.2, -0.405], [0.08, -0.47], [0, -0.485], [-0.08, -0.47]] },
];

function gerarMarcos() {
  const pontos = novoBuffer();
  const linhas = novoBuffer();
  const naEsfera = ([x, y]) => [x, y, Math.sqrt(Math.max(0, 1 - x * x - y * y))];
  let indice = 0;
  for (const grupo of MARCOS) {
    const lista = grupo.pontos.map(naEsfera);
    lista.forEach((p) => empurrar(pontos, p[0], p[1], p[2], (indice++ * 0.137) % 1, 1.015));
    const fim = grupo.fechado ? lista.length : lista.length - 1;
    for (let i = 0; i < fim; i++) {
      const a = lista[i];
      const c = lista[(i + 1) % lista.length];
      // Subdivide para a linha acompanhar o relevo.
      const passos = 6;
      for (let s = 0; s < passos; s++) {
        for (const t of [s / passos, (s + 1) / passos]) {
          const q = normalizar([a[0] + (c[0] - a[0]) * t, a[1] + (c[1] - a[1]) * t, a[2] + (c[2] - a[2]) * t]);
          empurrar(linhas, q[0], q[1], q[2], 0.5, 1.015);
        }
      }
    }
  }
  return { pontos, linhas };
}

function geometria(THREE, b) {
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(b.posicoes), 3));
  g.setAttribute("aNormal", new THREE.BufferAttribute(new Float32Array(b.normais), 3));
  g.setAttribute("aSeed", new THREE.BufferAttribute(new Float32Array(b.sementes), 1));
  return g;
}

const VIVO = /* glsl */ `
  uniform float uTime;
  uniform float uScanY;
  uniform float uScanForca;
  uniform float uFalha;
  uniform float uEstab;
  uniform float uBrilho;
  attribute vec3 aNormal;
  attribute float aSeed;

  vec3 deformarVivo(vec3 p, out float scan) {
    float respira = sin(uTime * 0.9 + aSeed * 6.2831) * 0.006 * (1.0 - uEstab);
    p += aNormal * respira;

    float d = p.y - uScanY;
    scan = exp(-d * d * 140.0) * uScanForca;
    p += aNormal * scan * 0.04;

    // Falha: faixas horizontais deslocadas, trocando algumas vezes por segundo.
    float linha = floor(p.y * 11.0) + floor(uTime * 7.0) * 3.0;
    float h = fract(sin(linha * 91.7) * 43758.5453);
    p.x += step(0.78, h) * (h - 0.89) * 0.77 * uFalha;
    return p;
  }

  // Luz fixa em relação ao rosto: principal de cima à direita, preenchimento à esquerda.
  // Soma uma luz presa à câmera, para o lado visível nunca ficar apagado.
  float iluminar(vec3 n, float nd) {
    float principal = max(0.0, dot(n, normalize(vec3(0.5, 0.55, 0.67))));
    float preenchimento = max(0.0, dot(n, normalize(vec3(-0.7, -0.15, 0.55))));
    float frontal = pow(max(0.0, nd), 3.0);
    return max(pow(principal, 1.9) * 1.05 + preenchimento * 0.1, frontal * 0.3);
  }

  // x: visibilidade (some na parte de trás); y: borda (silhueta); z: alinhamento com a câmera.
  vec3 exposicao(vec3 normalVista, vec3 direcaoVista) {
    float nd = dot(normalVista, direcaoVista);
    return vec3(smoothstep(-0.3, 0.0, nd), pow(1.0 - max(0.0, nd), 3.0), nd);
  }
`;

const PONTOS_VERTEX = /* glsl */ `
  ${VIVO}
  uniform float uPixelRatio;
  uniform float uTamanho;
  uniform float uGanho;
  uniform float uPiso;
  varying float vAlpha;
  varying float vBranco;

  void main() {
    float scan;
    vec3 p = deformarVivo(position, scan);
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    vec3 e = exposicao(normalize(normalMatrix * aNormal), normalize(-mv.xyz));
    float luz = iluminar(aNormal, e.z);

    float cintila = (sin(uTime * 2.0 + aSeed * 40.0) * 0.5 + 0.5) * (1.0 - uEstab);
    float base = uPiso + (1.0 - uPiso) * (0.03 + 1.15 * luz + 0.5 * e.y);
    vAlpha = e.x * (base * (0.35 + 0.65 * uBrilho) * 1.15 + scan * 0.7) * uGanho;
    vBranco = clamp(scan * 0.75 + cintila * 0.1, 0.0, 1.0);

    gl_PointSize = uTamanho * uPixelRatio * (1.0 + scan * 1.6) / max(0.1, -mv.z);
    gl_Position = projectionMatrix * mv;
  }
`;

const PONTOS_FRAGMENT = /* glsl */ `
  precision highp float;
  uniform vec3 uCor;
  uniform float uIntensidade;
  varying float vAlpha;
  varying float vBranco;

  vec3 tingir(vec3 cor, float branco) {
    return mix(pow(cor, vec3(1.7)) * 1.35, vec3(1.0), branco * 0.55);
  }

  void main() {
    float d = length(gl_PointCoord - 0.5) * 2.0;
    float a = smoothstep(1.0, 0.0, d);
    a = pow(a, 1.5);
    gl_FragColor = vec4(tingir(uCor, vBranco), a * vAlpha * uIntensidade);
  }
`;

const LINHAS_VERTEX = /* glsl */ `
  ${VIVO}
  uniform float uGanho;
  uniform float uPiso;
  varying float vAlpha;
  varying float vBranco;

  void main() {
    float scan;
    vec3 p = deformarVivo(position, scan);
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    vec3 e = exposicao(normalize(normalMatrix * aNormal), normalize(-mv.xyz));
    float luz = iluminar(aNormal, e.z);
    float base = uPiso + (1.0 - uPiso) * (0.01 + 0.09 * luz + 0.16 * e.y);
    vAlpha = e.x * (base * (0.4 + 0.6 * uBrilho) * 1.3 + scan * 0.45) * uGanho;
    vBranco = scan * 0.6;
    gl_Position = projectionMatrix * mv;
  }
`;

const LINHAS_FRAGMENT = /* glsl */ `
  precision highp float;
  uniform vec3 uCor;
  uniform float uIntensidade;
  varying float vAlpha;
  varying float vBranco;

  vec3 tingir(vec3 cor, float branco) {
    return mix(pow(cor, vec3(1.7)) * 1.35, vec3(1.0), branco * 0.55);
  }

  void main() {
    gl_FragColor = vec4(tingir(uCor, vBranco), vAlpha * uIntensidade);
  }
`;

function circulo(THREE, segmentos, plano) {
  const pontos = [];
  for (let i = 0; i < segmentos; i++) {
    const a = (i / segmentos) * Math.PI * 2;
    if (plano === "xz") pontos.push(Math.cos(a), 0, Math.sin(a));
    else pontos.push(Math.cos(a), Math.sin(a), 0);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(pontos), 3));
  return g;
}

// ── Cabeça de referência (dados amostrados de um modelo 3D) ──

const ESCALA_POSICAO = 8192;
const ESCALA_NORMAL = 32767;

// Int16 intercalado [x, y, z, nx, ny, nz] → buffers; limite corta a quantidade de itens.
function deInt16(dados, limite = Infinity) {
  const n = Math.min(Math.floor(dados.length / 6), limite);
  const rnd = aleatorio(771);
  const b = { posicoes: new Float32Array(n * 3), normais: new Float32Array(n * 3), sementes: new Float32Array(n) };
  for (let i = 0; i < n; i++) {
    for (let k = 0; k < 3; k++) {
      b.posicoes[i * 3 + k] = dados[i * 6 + k] / ESCALA_POSICAO;
      b.normais[i * 3 + k] = dados[i * 6 + 3 + k] / ESCALA_NORMAL;
    }
    b.sementes[i] = rnd();
  }
  return b;
}

function deListas(itens, semente = 0.5) {
  const b = novoBuffer();
  itens.forEach((p, i) => {
    b.posicoes.push(p[0], p[1], p[2]);
    b.normais.push(p[3], p[4], p[5]);
    b.sementes.push(semente === null ? (i * 0.137) % 1 : semente);
  });
  return b;
}

// Largura e profundidade da cabeça por faixa de altura, para a linha do scanner.
function perfilDosPontos(posicoes) {
  const passo = 0.05;
  const yMin = -1.1;
  const faixas = Math.ceil(2.25 / passo);
  const xMax = new Float32Array(faixas);
  const zMin = new Float32Array(faixas).fill(Infinity);
  const zMax = new Float32Array(faixas).fill(-Infinity);
  for (let i = 0; i < posicoes.length; i += 3) {
    const f = Math.floor((posicoes[i + 1] - yMin) / passo);
    if (f < 0 || f >= faixas) continue;
    xMax[f] = Math.max(xMax[f], Math.abs(posicoes[i]));
    zMin[f] = Math.min(zMin[f], posicoes[i + 2]);
    zMax[f] = Math.max(zMax[f], posicoes[i + 2]);
  }
  return (y) => {
    const f = Math.min(faixas - 1, Math.max(0, Math.floor((y - yMin) / passo)));
    if (!Number.isFinite(zMin[f])) return { x: 0.3, zCentro: 0, zRaio: 0.3 };
    return { x: xMax[f], zCentro: (zMax[f] + zMin[f]) / 2, zRaio: (zMax[f] - zMin[f]) / 2 };
  };
}

export function criarRosto(THREE, { pontos, uniformsComuns, modelo = null }) {
  const base = {
    uTime: uniformsComuns.uTime,
    uCor: uniformsComuns.uCor,
    uPixelRatio: uniformsComuns.uPixelRatio,
    uIntensidade: uniformsComuns.uIntensidadeRosto,
    uScanY: { value: 0 },
    uScanForca: { value: 0 },
    uFalha: { value: 0 },
    uEstab: { value: 0 },
    uBrilho: { value: 0.5 },
  };
  const uniformsNuvem = { ...base, uTamanho: { value: 10 }, uGanho: { value: 1 }, uPiso: { value: 0 } };
  const uniformsMalha = { ...base, uGanho: { value: 1 }, uPiso: { value: 0 } };
  const uniformsMarcos = { ...base, uTamanho: { value: 34 }, uGanho: { value: 0 }, uPiso: { value: 0.75 } };
  const uniformsElos = { ...base, uGanho: { value: 0 }, uPiso: { value: 0.75 } };

  const material = (vertexShader, fragmentShader, uniforms) =>
    new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

  const grupo = new THREE.Group();
  const adicionar = (objeto) => {
    objeto.frustumCulled = false;
    grupo.add(objeto);
    return objeto;
  };

  // Com a cabeça de referência usa os dados dela; sem ela, o rosto procedural.
  const dadosPontos = modelo ? deInt16(modelo.pontos, pontos) : gerarPontos(pontos);
  const dadosMalha = modelo ? (modelo.linhas ? deInt16(modelo.linhas) : null) : gerarMalha(26, 28, 64);
  const medidas = modelo ? perfilDosPontos(dadosPontos.posicoes) : null;

  adicionar(new THREE.Points(geometria(THREE, dadosPontos), material(PONTOS_VERTEX, PONTOS_FRAGMENT, uniformsNuvem)));
  if (dadosMalha) {
    adicionar(new THREE.LineSegments(geometria(THREE, dadosMalha), material(LINHAS_VERTEX, LINHAS_FRAGMENT, uniformsMalha)));
  }

  const marcos = modelo
    ? { pontos: deListas(modelo.marcos?.pontos ?? [], null), linhas: deListas(modelo.marcos?.linhas ?? []) }
    : gerarMarcos();
  adicionar(new THREE.Points(geometria(THREE, marcos.pontos), material(PONTOS_VERTEX, PONTOS_FRAGMENT, uniformsMarcos)));
  adicionar(new THREE.LineSegments(geometria(THREE, marcos.linhas), material(LINHAS_VERTEX, LINHAS_FRAGMENT, uniformsElos)));

  const materialLinha = () =>
    new THREE.LineBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

  // Linha do scanner: elipse que acompanha a largura da cabeça na altura atual.
  const materialScan = materialLinha();
  const linhaScan = adicionar(new THREE.LineLoop(circulo(THREE, 96, "xz"), materialScan));

  // Anel de confirmação (Aceito).
  const materialAnel = materialLinha();
  const anel = new THREE.Group();
  const anelInterno = new THREE.LineLoop(circulo(THREE, 128, "xy"), materialAnel);
  anelInterno.scale.setScalar(1.36);
  const anelExterno = new THREE.LineLoop(circulo(THREE, 128, "xy"), materialAnel);
  anelExterno.scale.setScalar(1.44);
  anel.add(anelInterno, anelExterno);
  anel.position.set(0, -0.05, 0.3);
  adicionar(anel);

  grupo.scale.setScalar(1.08);
  grupo.position.y = 0.25;

  const branco = new THREE.Color(1, 1, 1);
  let faseScan = 0;

  // alvo: { cor: THREE.Color, brilho, scanVel, scanForca, falha, estab, anel, marcos, intensidade }
  function atualizar(dt, tempo, alvo) {
    faseScan += dt * alvo.scanVel;
    const ys = Math.sin(faseScan) * 0.96; // altura na esfera
    const pisca = alvo.falha > 0.5 ? (Math.sin(tempo * 38) > 0 ? 1 : 0.25) : 1;
    const forca = alvo.scanForca * pisca;

    // Altura, largura e profundidade da cabeça onde o scanner está.
    let y;
    let m;
    if (medidas) {
      y = ys * 1.06;
      m = medidas(y);
    } else {
      const r = Math.sqrt(Math.max(0.02, 1 - ys * ys));
      const lado = deformar(r, ys, 0);
      const frente = deformar(0, ys, r);
      const tras = deformar(0, ys, -r);
      y = lado[1];
      m = { x: lado[0], zCentro: (frente[2] + tras[2]) / 2, zRaio: (frente[2] - tras[2]) / 2 };
    }

    base.uScanY.value = y;
    base.uScanForca.value = forca;
    base.uFalha.value = alvo.falha;
    base.uEstab.value = alvo.estab;
    base.uBrilho.value = alvo.brilho;

    linhaScan.position.set(0, y, m.zCentro);
    linhaScan.scale.set(m.x * 1.14 + 0.04, 1, m.zRaio * 1.14 + 0.04);
    materialScan.color.copy(alvo.cor).lerp(branco, 0.5);
    materialScan.opacity = forca * 0.6 * alvo.intensidade;

    // Marcos: tremem levemente enquanto a identidade não está confirmada.
    const tremor = alvo.falha > 0.5 ? (Math.sin(tempo * 23) > 0.2 ? 1 : 0.2) : 1;
    uniformsMarcos.uGanho.value = alvo.marcos * tremor;
    uniformsElos.uGanho.value = alvo.marcos * tremor * 0.75;

    materialAnel.color.copy(alvo.cor).lerp(branco, 0.25);
    materialAnel.opacity = alvo.anel * 0.75 * alvo.intensidade;
    anel.scale.setScalar(0.82 + alvo.anel * 0.18);
    anel.rotation.z = tempo * 0.15;
  }

  return { grupo, atualizar, pontos: dadosPontos.sementes.length };
}
