// Partículas que sobem ao redor do rosto. 60% assumem a cor do estado, 40% branco-frio.

const VERTEX = /* glsl */ `
  attribute float aTinta;
  uniform float uPixelRatio;
  uniform float uTamanho;
  varying float vTinta;

  void main() {
    vTinta = aTinta;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = uTamanho * uPixelRatio / max(0.1, -mv.z);
    gl_Position = projectionMatrix * mv;
  }
`;

const FRAGMENT = /* glsl */ `
  precision highp float;
  uniform vec3 uCor;
  uniform float uIntensidade;
  varying float vTinta;

  void main() {
    float d = length(gl_PointCoord - 0.5) * 2.0;
    float a = smoothstep(1.0, 0.0, d);
    a *= a;
    vec3 fria = vec3(0.78, 0.9, 1.0);
    vec3 cor = mix(fria, uCor, vTinta);
    gl_FragColor = vec4(cor, a * 0.85 * uIntensidade);
  }
`;

const LIMITE_Y = 3.0;
const LIMITE_XZ = 3.5;

export function criarParticulas(THREE, quantidade, uniformsComuns) {
  const posicoes = new Float32Array(quantidade * 3);
  const tinta = new Float32Array(quantidade);
  const dados = [];

  for (let i = 0; i < quantidade; i++) {
    posicoes[i * 3] = (Math.random() - 0.5) * 6.5;
    posicoes[i * 3 + 1] = (Math.random() - 0.5) * 5.0 - 0.5;
    posicoes[i * 3 + 2] = (Math.random() - 0.5) * 6.5;
    tinta[i] = Math.random() < 0.6 ? 1 : 0;
    dados.push({
      vx: (Math.random() - 0.5) * 0.4,
      vy: 0.15 + Math.random() * 0.3,
      vz: (Math.random() - 0.5) * 0.4,
      balancoVel: 0.5 + Math.random() * 1.5,
      balancoRaio: 0.05 + Math.random() * 0.15,
      fase: Math.random() * Math.PI * 2,
    });
  }

  const geometria = new THREE.BufferGeometry();
  geometria.setAttribute("position", new THREE.BufferAttribute(posicoes, 3));
  geometria.setAttribute("aTinta", new THREE.BufferAttribute(tinta, 1));

  const material = new THREE.ShaderMaterial({
    vertexShader: VERTEX,
    fragmentShader: FRAGMENT,
    uniforms: {
      uCor: uniformsComuns.uCor,
      uIntensidade: uniformsComuns.uIntensidadeParticulas,
      uPixelRatio: uniformsComuns.uPixelRatio,
      uTamanho: { value: 30 },
    },
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });

  const objeto = new THREE.Points(geometria, material);
  objeto.frustumCulled = false;
  let ativas = quantidade;

  // velocidade: multiplicador geral (estado); agitacao: turbulência extra (scroll/estado).
  function atualizar(dt, tempo, velocidade, agitacao) {
    const mult = velocidade;
    for (let i = 0; i < ativas; i++) {
      const k = i * 3;
      const d = dados[i];
      const balanco = d.balancoRaio * (1 + agitacao * 4);
      posicoes[k] += (d.vx * mult + Math.sin(tempo * d.balancoVel + d.fase) * balanco) * dt;
      posicoes[k + 1] += d.vy * mult * dt;
      posicoes[k + 2] += (d.vz * mult + Math.cos(tempo * d.balancoVel + d.fase) * balanco) * dt;

      if (posicoes[k + 1] > LIMITE_Y || Math.abs(posicoes[k]) > LIMITE_XZ || Math.abs(posicoes[k + 2]) > LIMITE_XZ) {
        posicoes[k + 1] = -2.5;
        posicoes[k] = (Math.random() - 0.5) * 3.0;
        posicoes[k + 2] = (Math.random() - 0.5) * 3.0;
      }
    }
    geometria.attributes.position.needsUpdate = true;
  }

  function reduzir() {
    ativas = Math.max(1, Math.floor(ativas / 2));
    geometria.setDrawRange(0, ativas);
  }

  function foraDosLimites() {
    for (let i = 0; i < ativas; i++) {
      const k = i * 3;
      if (posicoes[k + 1] > LIMITE_Y + 0.5 || Math.abs(posicoes[k]) > LIMITE_XZ + 0.5 || Math.abs(posicoes[k + 2]) > LIMITE_XZ + 0.5) {
        return true;
      }
    }
    return false;
  }

  return { objeto, atualizar, reduzir, foraDosLimites, quantidade: () => ativas };
}
