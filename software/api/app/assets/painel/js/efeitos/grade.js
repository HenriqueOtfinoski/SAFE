// Pontos da grade decorativa: deslizam pelas linhas conforme o scroll, com inércia.

const FATOR = 0.06;

export function iniciarGrade() {
  const pontos = [...document.querySelectorAll(".grade__ponto")];
  if (pontos.length === 0 || document.documentElement.classList.contains("movimento-reduzido")) return;

  let atual = 0;

  function alvo() {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    return max > 0 ? window.scrollY / max : 0;
  }

  function posicionar(scroll) {
    pontos.forEach((ponto, i) => {
      const inicio = ((i * 17) % 80) + 10;
      let velocidade = 90 + ((i * 55) % 180);
      if (i % 2 === 0) velocidade = -velocidade;
      const y = (((inicio + scroll * velocidade) % 100) + 100) % 100;
      ponto.style.top = `${y.toFixed(2)}%`;
    });
  }

  function quadro() {
    requestAnimationFrame(quadro);
    const destino = alvo();
    if (Math.abs(destino - atual) < 0.00005) return;
    atual += (destino - atual) * FATOR;
    posicionar(atual);
  }

  posicionar(0);
  requestAnimationFrame(quadro);
}
