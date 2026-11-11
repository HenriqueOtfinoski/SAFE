# SAFE — Painel 3D "O Olhar" (Design)

- **Data:** 2026-11-11
- **Status:** aguardando revisão
- **Substitui:** as seções 4 (identidade visual), 5 (navegação, parte visual) e 6.1 (Painel) de
  `2026-11-10-frontend-design.md`. Continuam valendo daquela spec: §3 (API consumida e validação),
  §6.2–6.4 (comportamento funcional de lista, formulário e detalhe), §7 (contratos de `api.js`,
  views e `dom.js`) e §8 (tratamento de erros).

## 1. Objetivo

Transformar o painel em uma experiência cinematográfica, fluida e tridimensional, inspirada no
site "Bronze and Time" enviado como referência, sem perder nenhuma função de gestão já entregue.

**Sucesso:** ao abrir o painel, a pessoa vê uma cena 3D viva que conta o funcionamento do SAFE
conforme rola a página; e continua conseguindo cadastrar pessoas, enviar fotos e ver a saúde do
sistema com a mesma confiabilidade de antes.

## 2. Decisões tomadas

| Tema | Decisão |
| --- | --- |
| Peça 3D | Rosto em nuvem de pontos, gerado por código, varrido por uma linha de scanner. |
| Estrutura | Híbrida: o Painel é uma jornada por scroll; Pessoas, formulário e detalhe são telas funcionais em painéis de vidro sobre a mesma cena. |
| Estética | Cinematográfica editorial: preto profundo, títulos serifados enormes, paleta que migra pelas cores dos estados da FSM. |
| Three.js | Cópia local em `assets/painel/vendor/` (pacote oficial `three@0.160.0`), sem CDN. |
| Backend | Continua sem alteração. |
| Lógica existente | `api.js`, `saude.js`, validação, envio de fotos e webcam são mantidos. |

### O que vem da inspiração e o que não vem

- **Vem:** canvas WebGL fixo atrás de tudo; órbita da câmera guiada pelo scroll com suavização por
  interpolação; fundo de ondas líquidas em shader com paleta que muda ao rolar; partículas subindo;
  títulos revelados letra a letra (subida + desfoque); grade de linhas verticais com pontos que
  deslizam; barra de progresso em traços; cursor de dois anéis.
- **Não vem:** o modelo do cavalo, a imagem editorial e qualquer arquivo hospedado pelo site de
  referência; `user-select: none` global e cursor oculto em campos de texto (aqui é uma ferramenta
  de trabalho: copiar um ID e digitar precisam ser naturais).

## 3. Identidade visual

### Tokens

| Token | Valor | Uso |
| --- | --- | --- |
| `--bg` | `#000000` | fundo |
| `--titulo` | `#f4f1ea` | títulos |
| `--text` | `#d6dae0` | texto |
| `--muted` | `#8a9099` | texto secundário |
| `--vidro` | `rgba(12, 14, 16, 0.62)` + `backdrop-filter: blur(18px)` | painéis de vidro |
| `--line` | `rgba(255, 255, 255, 0.12)` | linhas e bordas |
| `--acento` | dinâmico (ver estados) | LEDs, sublinhados, progresso, foco |

Cores dos estados (também usadas pela cena 3D):

| Estado | Cor | S | V |
| --- | --- | :-: | :-: |
| Aguardando | `#7aa7d9` (azul-aço) | 0 | 0 |
| Validando | `#f5b942` (âmbar) | 1 | 0 |
| Aceito | `#4ade80` (verde) | 0 | 1 |
| Negado | `#f8615a` (vermelho) | 1 | 1 |
| Neutro (operação e telas de gestão) | `#7fd4e6` (ciano) | — | — |

A cor nunca é o único portador de significado: todo estado tem rótulo textual.

### Tipografia

- **Italiana** — títulos (jornada: `clamp(56px, 8vw, 116px)`; páginas: `clamp(40px, 5vw, 72px)`).
  Se algum caractere do português não renderizar bem, troca-se por **Cormorant Garamond**.
- **Outfit** (300/400/600) — texto e interface.
- **JetBrains Mono** (400/500) — IDs, sinais S/V, pinos, metadados.

### Camadas fixas (em `index.html`)

1. `canvas#cena` — cena 3D (fundo).
2. Grade decorativa (`aria-hidden`): linha horizontal sob a barra superior e 5 linhas verticais com
   pontos que deslizam com o scroll; a última linha abriga o progresso da jornada.
3. `main#view` — conteúdo da rota.
4. Barra superior: marca, navegação (Painel, Pessoas), LEDs de saúde, botão "Nova pessoa".
5. Cursor de dois anéis.

## 4. A cena 3D

### Composição

- **Rosto:** cerca de 14 000 pontos distribuídos numa esfera e deformados por funções analíticas
  (formato do crânio, mandíbula, nariz, órbitas, arco das sobrancelhas, lábios, queixo, pescoço),
  mais anéis de contorno horizontais em linha fina. Material em shader com brilho aditivo.
- **Scanner:** plano horizontal que sobe e desce; pontos próximos brilham mais e se deslocam
  levemente para fora.
- **Fundo:** plano com shader de ondas em camadas, preso à câmera; sombras quase pretas, corpo das
  ondas em ~6% da cor do estado e cristas em ~45%.
- **Partículas:** 450 pontos aditivos subindo, 60% na cor do estado e 40% branco-frio; aceleram
  com a velocidade do scroll.
- **Interação:** o rosto inclina até 0,25 rad (horizontal) e 0,15 rad (vertical) seguindo o mouse.

### Comportamento por estado

| Estado | Rosto | Scanner | Partículas |
| --- | --- | --- | --- |
| Aguardando | respiração lenta, brilho baixo | varredura lenta e tênue | lentas |
| Validando | brilho médio | varredura rápida e intensa | médias |
| Aceito | pontos estabilizam, brilho alto, anel de confirmação | para no centro e some | sobem em rajada suave |
| Negado | faixas horizontais com deslocamento (falha) | pisca | turbulentas |

### Interface da cena (`js/cena/cena.js`)

- `iniciarCena(canvas) → cena` — devolve uma fachada inerte (mesmos métodos, sem efeito) quando o
  WebGL não está disponível ou o sistema pede movimento reduzido. As telas nunca verificam nulo.
- `obterCena() → cena`
- `cena.jornada(p)` — progresso da jornada, `p` em [0, 1].
- `cena.enquadrar(nome)` — `'jornada' | 'pessoas' | 'form' | 'detalhe' | 'neutro'`.
- `cena.pulsar(tom, duracaoMs = 1200)` — `tom` em `'ok' | 'wait' | 'bad'`; a cena assume
  temporariamente o estado correspondente e volta.
- `cena.estado()` — retrato para inspeção (quadros renderizados, fps, estado, enquadramento, ativa).

### Reações a eventos da aplicação

| Evento | Chamada |
| --- | --- |
| Envio de foto em andamento | `pulsar('wait')` enquanto durar |
| Foto aceita / pessoa salva | `pulsar('ok')` |
| Foto rejeitada, erro de validação da API, exclusão | `pulsar('bad')` |

### Desempenho e robustez

- `pixelRatio = min(devicePixelRatio, 2)`; se a média ficar abaixo de 30 fps por 2 s, cai para 1 e
  reduz as partículas à metade (uma única vez).
- A renderização pausa com a aba oculta e retoma sem salto de tempo (delta limitado a 0,1 s).
- Perda de contexto WebGL: a cena troca para a fachada inerte e a página segue funcionando.

## 5. Painel — jornada por scroll

Seis momentos. A view cria uma área alta (`700vh`) e mantém os textos fixos; o progresso `p` é o
scroll normalizado e suavizado (fator 0,06 por quadro).

| # | Faixa ativa de `p` | Título | Conteúdo | Estado da cena |
| --- | --- | --- | --- | --- |
| 0 | −0,10 a 0,08 | "Acesso pelo olhar" | resumo do SAFE; saúde da API e do banco; totais de pessoas, fotos e pessoas sem foto (link para a lista filtrada) | Aguardando |
| 1 | 0,14 a 0,26 | "Aguardando" | S=0, V=0; câmera ativa, nenhum rosto em processamento | Aguardando |
| 2 | 0,34 a 0,46 | "Validando" | S=1, V=0; rosto detectado, confirmação em 5 quadros | Validando |
| 3 | 0,54 a 0,66 | "Aceito" | S=0, V=1; pessoa reconhecida, acesso liberado | Aceito |
| 4 | 0,74 a 0,86 | "Negado" | S=1, V=1; pessoa desconhecida ou não confirmada | Negado |
| 5 | 0,93 a 1,05 | "Operação" | cadastrar → enviar fotos → `python treinar.py` (com copiar); tabela de pinos | Neutro |

- **Paleta:** `--acento` e a cena interpolam entre as cores nos pontos 0; 0,2; 0,4; 0,6; 0,8; 1.
- **Câmera:** ângulo `p·2π`; altura `0,2 + sen(p·π)·0,6`; raio `4,4 − sen(p·π)·0,5`; o ponto de
  mira desloca-se lateralmente para abrir espaço ao texto de cada momento.
- **Console S/V:** dois interruptores fixos mostram os sinais do momento atual; acioná-los rola
  suavemente até o estado correspondente (00, 10, 01, 11).
- **Progresso:** seis traços verticais que enchem conforme `p`; clicar num traço rola até o momento.
- **Teclado:** traços e interruptores são botões focáveis; a rolagem nativa (setas, PgUp/PgDn,
  Espaço) continua funcionando porque o scroll é o da própria página.
- **Leitores de tela:** todos os momentos estão no DOM em ordem; o momento inativo fica com
  `aria-hidden` apenas no modo animado.

## 6. Telas de gestão

Mesmas funções e contratos de antes; muda a apresentação.

- Conteúdo em painéis de vidro sobre a cena; a cena fica esmaecida e enquadrada de lado
  (`pessoas`, `form`, `detalhe`) para não competir com o texto. Contraste de texto AA sobre o vidro.
- Título de cada página em Italiana, revelado letra a letra.
- Transição entre rotas: a tela atual some em 180 ms (desfoque + opacidade) e a nova entra com
  elementos em sequência.
- Inclinação 3D com o ponteiro (até 6°) nas linhas da lista e nas fotos da galeria.
- Campos de formulário mantêm cursor de texto e seleção nativos.

## 7. Efeitos de interface (`js/efeitos/`)

- `letras.js` — `dividirLetras(el)`: envolve cada caractere em `<span class="char">` com atraso de
  0,035 s por letra, criado via DOM (sem `innerHTML`); preserva o texto original em `aria-label`.
- `cursor.js` — `iniciarCursor()`: só com `(pointer: fine)` e sem movimento reduzido; anel externo
  segue com fator 0,2 e cresce sobre elementos interativos; some sobre campos de texto.
- `tilt.js` — `aplicarTilt(el, { max = 6 }) → limpar`.
- `grade.js` — pontos da grade deslizando com o scroll.
- `router.js` ganha a etapa de saída (classe `saindo` por 180 ms) antes de trocar a view.

## 8. Modos de compatibilidade

| Condição | Comportamento |
| --- | --- |
| Sem WebGL ou contexto perdido | classe `sem-cena`: fundo em gradiente CSS tingido por `--acento`; jornada e animações de texto continuam. |
| `prefers-reduced-motion: reduce` | classe `movimento-reduzido`: sem cena, sem cursor customizado, sem inclinação; o Painel vira seções em fluxo normal (sem área de 700vh) com todo o conteúdo visível. |
| Ponteiro grosso (toque) | sem cursor customizado e sem inclinação; cena com 7 000 pontos. |
| Largura menor que 840px | textos da jornada em coluna única na base da tela; console S/V e progresso compactos. |

## 9. Arquivos

```
assets/painel/
  index.html                 camadas fixas, importmap local de "three"
  style.css                  reescrito (tema editorial)
  vendor/three.module.min.js cópia de three@0.160.0 (MIT) + vendor/LICENSE-three.txt
  js/app.js                  inicia cena, cursor, grade, saúde e rotas
  js/router.js               + transição de saída
  js/cena/cena.js            renderer, câmera, laço, enquadramentos, fachada inerte
  js/cena/rosto.js           geometria procedural e shader do rosto/scanner
  js/cena/fundo.js           shader de ondas
  js/cena/particulas.js      partículas
  js/cena/paleta.js          cores dos estados e interpolação (funções puras)
  js/efeitos/{letras,cursor,tilt,grade}.js
  js/views/painel.js         reescrito (jornada)
  js/views/{pessoas,pessoa-form,pessoa,camera,nao-encontrado}.js   ajustes de apresentação e chamadas à cena
```

`blocoErro` sai de `views/painel.js` para `js/ui/erro.js`, pois é usado por todas as telas.

## 10. Verificação

1. `pytest` em `software/api`: os testes do painel passam, incluindo o novo que garante
   `GET /painel/vendor/three.module.min.js` = 200 e `canvas id="cena"` no index.
2. Funções puras no navegador (`paleta.js`: interpolação e momento ativo; `letras.js`).
3. Cena: `obterCena().estado()` mostra quadros avançando, estado mudando com o scroll e
   enquadramento mudando com a rota; capturas de tela dos seis momentos e das telas de gestão.
4. Regressão funcional completa do roteiro anterior (criar, duplicidade, fotos válidas e inválidas,
   webcam, editar limpando e-mail, excluir, API fora do ar, texto com HTML exibido literalmente).
5. Modos de compatibilidade: WebGL bloqueado e movimento reduzido emulados.
6. 1440px e 375px sem rolagem horizontal.

Limitação conhecida de verificação: o navegador embutido não libera a câmera real e só renderiza
com a janela visível; a webcam é testada com um fluxo de vídeo sintético.
