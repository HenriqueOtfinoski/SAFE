// Cores dos estados da FSM e funções puras da jornada (sem dependência de Three.js).

export const ESTADOS = {
  aguardando: { nome: "Aguardando", cor: "#7aa7d9", s: 0, v: 0 },
  validando: { nome: "Validando", cor: "#f5b942", s: 1, v: 0 },
  aceito: { nome: "Aceito", cor: "#4ade80", s: 0, v: 1 },
  negado: { nome: "Negado", cor: "#f8615a", s: 1, v: 1 },
  neutro: { nome: "Neutro", cor: "#7fd4e6", s: null, v: null },
};

// Ponto central de cada momento da jornada e o estado correspondente.
export const CENTROS = [0, 0.2, 0.4, 0.6, 0.8, 1];
export const ESTADO_DO_MOMENTO = ["aguardando", "aguardando", "validando", "aceito", "negado", "neutro"];

// Faixa de progresso em que o texto de cada momento fica visível.
export const FAIXAS = [
  [-0.1, 0.08],
  [0.14, 0.26],
  [0.34, 0.46],
  [0.54, 0.66],
  [0.74, 0.86],
  [0.93, 1.05],
];

export function hexParaRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

export function corDoEstado(nome) {
  return hexParaRgb((ESTADOS[nome] || ESTADOS.neutro).cor);
}

function limitar(p) {
  return Math.min(1, Math.max(0, Number.isFinite(p) ? p : 0));
}

export function corDaJornada(p) {
  const x = limitar(p);
  for (let i = 0; i < CENTROS.length - 1; i++) {
    const a = CENTROS[i];
    const b = CENTROS[i + 1];
    if (x <= b) {
      const t = (x - a) / (b - a);
      const ca = corDoEstado(ESTADO_DO_MOMENTO[i]);
      const cb = corDoEstado(ESTADO_DO_MOMENTO[i + 1]);
      return [ca[0] + (cb[0] - ca[0]) * t, ca[1] + (cb[1] - ca[1]) * t, ca[2] + (cb[2] - ca[2]) * t];
    }
  }
  return corDoEstado("neutro");
}

export function momentoMaisProximo(p) {
  const x = limitar(p);
  let melhor = 0;
  for (let i = 1; i < CENTROS.length; i++) {
    if (Math.abs(CENTROS[i] - x) < Math.abs(CENTROS[melhor] - x)) melhor = i;
  }
  return melhor;
}

export function estadoDaJornada(p) {
  return ESTADO_DO_MOMENTO[momentoMaisProximo(p)];
}

export function momentoAtivo(p) {
  for (let i = 0; i < FAIXAS.length; i++) {
    if (p >= FAIXAS[i][0] && p <= FAIXAS[i][1]) return i;
  }
  return -1;
}

export function paraCss([r, g, b]) {
  return `rgb(${Math.round(r * 255)} ${Math.round(g * 255)} ${Math.round(b * 255)})`;
}
