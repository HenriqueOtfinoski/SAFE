# SAFE — Frontend de Administração (Design)

- **Data:** 2026-11-10
- **Status:** aguardando revisão
- **Escopo:** frontend web de administração, servido pelo FastAPI, consumindo apenas a API existente.

## 1. Objetivo

Oferecer uma interface elegante, com identidade própria, para o operador do SAFE:

1. ver rapidamente se a API e o banco estão saudáveis;
2. cadastrar, editar e excluir pessoas;
3. enviar fotos faciais (arquivo ou webcam) que alimentam o treino do modelo LBPH;
4. entender os estados da FSM (sinais S/V) de forma visual e didática.

**Sucesso:** um operador consegue, sem terminal, cadastrar uma pessoa, anexar fotos válidas e saber
quem ainda não tem foto (e portanto não será reconhecido), com todos os erros da API apresentados
de forma clara.

## 2. Decisões tomadas

| Tema | Decisão |
| --- | --- |
| Backend | **Nenhuma alteração.** Usa somente os endpoints existentes. |
| Contexto de uso | Painel de administração em navegador de PC (desktop-first, responsivo até ~360px). |
| Visual | Tema escuro "sala de controle" / instrumentação. |
| Stack | JavaScript puro (ES modules), sem build, sem dependências npm. |
| Hospedagem | **Substitui o painel existente** em `software/api/app/assets/painel/`, mantendo o `main.py` da branch `front` (mount em `/painel`, redirect de `/`). |
| Branch | `front`, atualizada com `origin/main`. |

### Relação com o que já existe

- O painel atual da branch `front` (`assets/painel/index.html`, `style.css`, `app.js`) é reescrito por
  completo. O arquivo `safe_logo.png` é preservado; a marca na interface é um SVG inline derivado dele.
- O `main.py` da `front` não muda. Como o painel é servido em `/painel/`, todos os caminhos de recursos
  no HTML/JS são **relativos** (`style.css`, `js/app.js`) e as chamadas à API usam caminhos absolutos
  da raiz (`/pessoas`, `/health`), na mesma origem.
- O esqueleto não versionado em `software/api/app/static/` e o stash do `main.py` local ficam sem uso;
  não são apagados pela implementação.
- A seção "Painel de Administração Web" do `software/README.md` é atualizada para refletir as novas
  funcionalidades (a tabela atual cita "Configuração da API", que não existe).

### Fora de escopo

- Estado ao vivo da FSM, histórico de acessos, disparo de treino pela UI (a API não expõe esses dados).
- Exclusão de fotos (a API não tem endpoint para isso).
- Autenticação/controle de acesso à interface.
- A aba "Histórico" do esqueleto atual será removida.

## 3. API consumida

| Método | Rota | Uso na UI |
| --- | --- | --- |
| GET | `/health` | indicador "API" |
| GET | `/health/database` | indicador "Banco" (503 = indisponível) |
| GET | `/pessoas?offset&limite` | lista paginada (máx. 100 por página) |
| POST | `/pessoas` | criar pessoa (201, 409 duplicado, 422 validação) |
| GET | `/pessoas/{id}` | detalhe (404) |
| PATCH | `/pessoas/{id}` | editar (envia só campos alterados; 409/422) |
| DELETE | `/pessoas/{id}` | excluir (204; remove fotos em cascata) |
| POST | `/pessoas/{id}/imagens` | upload `multipart/form-data`, campo `arquivo` (201, 400) |
| GET | `/pessoas/{id}/imagens` | metadados das fotos |
| GET | `/pessoas/{id}/imagens/{img}/arquivo` | binário da foto, usado direto em `<img src>` |

Regras de validação espelhadas no cliente (a API continua sendo a fonte da verdade):

- `nome`: 1–100 caracteres, obrigatório.
- `identificador`: 1–80 caracteres, obrigatório, único.
- `email`: opcional, formato `x@y.z`, até 255, único (normalizado para minúsculas pela API).
- `data_nascimento`: opcional, não pode ser futura.
- Foto: JPEG ou PNG, até 5 MB, **exatamente um rosto** (validado pela API via Haar Cascade).

Para limpar um campo opcional na edição, o cliente envia `null` (`email`, `data_nascimento`).
`nome` e `identificador` nunca são enviados como `null`.

## 4. Identidade visual

Conceito: **instrumento de bancada**. A interface lembra um painel de equipamento eletrônico, em
diálogo com o hardware do projeto (CIs 7408/7404/7432/7474, sinais S, V e CLK).

### Tokens (variáveis CSS em `:root`)

| Token | Valor | Uso |
| --- | --- | --- |
| `--bg` | `#0b0d0e` | fundo |
| `--panel` | `#111416` | superfícies |
| `--panel-2` | `#161a1d` | superfícies elevadas, inputs |
| `--line` | `#22282c` | bordas de 1px |
| `--line-strong` | `#2f373c` | bordas em hover/foco |
| `--text` | `#e6eaec` | texto principal |
| `--muted` | `#7d888e` | texto secundário |
| `--ui` | `#7fd4e6` | acento de interface (links, foco, ações primárias) |
| `--ok` | `#4ade80` | Aceito / saudável |
| `--wait` | `#fbbf24` | Validando / atenção |
| `--bad` | `#f87171` | Negado / erro / destrutivo |
| `--idle` | `#64748b` | Aguardando / neutro |

Os valores de contraste do texto sobre `--bg`/`--panel` devem atender WCAG AA. As cores de sinal
nunca são o único portador de significado: sempre há rótulo textual junto.

### Tipografia (Google Fonts)

- **Space Grotesk** (500/600): títulos e números grandes.
- **JetBrains Mono** (400/500): IDs, sinais S/V, rótulos técnicos, metadados (dimensões, MIME, datas).
- Corpo de texto: Space Grotesk 400.

### Elementos de assinatura

- **LED de sinal:** círculo de 10px com brilho (`box-shadow`) na cor do sinal quando aceso, apagado
  com borda quando em 0. Usado para S/V e para os indicadores de saúde.
- **Grade de fundo:** grade pontilhada muito sutil (`radial-gradient`), como placa de prototipagem.
- **Marca:** SVG inline do escudo com rosto em circuito (redesenho em linhas do `safe_logo.png`,
  contorno em `--ui`), ao lado de "SAFE" em mono espaçado e do subtítulo
  "Sistema de Acesso Facial Embarcado".
- **Rótulos de seção** em mono, caixa alta, com prefixo de coordenada (ex.: `01 / SISTEMA`).
- Movimento contido: transições de 120–180ms; LEDs com pulso lento apenas no estado ativo;
  respeitar `prefers-reduced-motion`.

## 5. Estrutura de navegação

Barra superior fixa: marca, navegação (`Painel`, `Pessoas`) e indicadores de saúde (LED API, LED Banco).

Rotas por hash:

| Rota | Tela |
| --- | --- |
| `#/` ou `#/painel` | Painel |
| `#/pessoas` | Lista de pessoas |
| `#/pessoas/nova` | Formulário de criação |
| `#/pessoas/{id}` | Detalhe da pessoa (dados + fotos) |
| `#/pessoas/{id}/editar` | Formulário de edição |
| qualquer outra | tela "não encontrado" com link para o Painel |

O router aceita query string no hash (ex.: `#/pessoas?filtro=sem-foto`) e a entrega à view como
`params.query`. O item de navegação ativo é marcado com `aria-current="page"`.

## 6. Telas

### 6.1 Painel

1. **Saúde do sistema:** dois blocos (API, Banco) com LED, status textual e horário da última
   checagem. Recheque a cada 15s enquanto a aba estiver visível (`visibilitychange`).
2. **Métricas:** total de pessoas, total de fotos, pessoas sem foto. "Pessoas sem foto" em âmbar
   quando > 0, com link para a lista filtrada (`#/pessoas?filtro=sem-foto`).
3. **Mapa da FSM (simulador didático):** os quatro estados em cartões
   (Aguardando 00, Validando 10, Aceito 01, Negado 11), cada um com LEDs S e V. Dois interruptores
   (S, V) permitem alternar os sinais; o cartão correspondente acende. Uma legenda clara informa:
   "Simulação — o estado real é controlado pelo Raspberry Pi". Inclui a tabela de pinos
   (S=GPIO17/pino 11, V=GPIO27/pino 13, CLK=GPIO22/pino 15).
4. **Fluxo de operação:** três passos numerados — Cadastrar pessoa → Enviar fotos → Treinar modelo
   no Pi (`python treinar.py`, com botão para copiar o comando).

Carregamento das métricas: lê todas as pessoas em páginas de 100 e, em seguida, as imagens de cada
pessoa com no máximo 6 requisições simultâneas. Cada bloco mostra um esqueleto enquanto carrega e um
erro local com "Tentar novamente" se falhar.

### 6.2 Pessoas (lista)

- Cabeçalho com contagem total, busca e botão "Nova pessoa".
- Busca local (sem nova requisição) por nome, identificador ou e-mail, sem diferenciar acentos nem
  maiúsculas.
- Filtro rápido: `Todas` / `Sem foto`.
- Cada linha: avatar (primeira foto; iniciais quando não há), nome, identificador em mono, e-mail,
  selo com nº de fotos (âmbar se 0), data de cadastro. Clicar abre o detalhe.
- Estados: carregando (esqueletos), vazio ("Nenhuma pessoa cadastrada" + CTA), sem resultado de
  busca, erro (com tentar novamente).

### 6.3 Formulário (criar / editar)

- Campos: Nome*, Identificador*, E-mail, Data de nascimento (`max` = hoje).
- Validação no cliente ao sair do campo e no envio; erros sob o campo.
- Erros da API:
  - 422: mapeia `detail[].loc` para o campo correspondente.
  - 409: mensagem "E-mail ou identificador já cadastrado" exibida sobre os dois campos únicos.
- Botão de envio com estado "Salvando…" e bloqueio de duplo envio.
- Na edição, envia apenas campos alterados; sem alterações, o botão fica desabilitado.
- Após criar, vai para o detalhe da pessoa com a área de fotos em destaque.

### 6.4 Detalhe da pessoa

- Cabeçalho: nome, identificador, e-mail, nascimento, data de cadastro; ações Editar e Excluir.
- Excluir: modal de confirmação informando que as fotos também serão removidas; após sucesso,
  volta à lista com toast.
- **Fotos:**
  - Galeria em grade (quadrada, `object-fit: cover`), com metadados em mono (dimensões, tipo, data)
    no hover/foco. Clique abre visualização ampliada (modal, fecha com Esc).
  - Nota fixa: "Fotos não podem ser removidas pela interface."
  - **Enviar arquivo:** zona de arrastar e soltar + seletor; aceita múltiplos arquivos, enviados em
    sequência, cada um com seu próprio status (enviando / enviado / erro com a mensagem da API).
    Pré-validação no cliente: tipo JPEG/PNG e tamanho ≤ 5 MB.
  - **Capturar pela webcam:** abre painel com `<video>` ao vivo e guia oval de enquadramento;
    "Capturar" congela o quadro, mostra prévia com "Enviar" / "Refazer". A captura vira JPEG
    (qualidade 0.92) via `<canvas>`. A câmera é desligada ao fechar o painel ou sair da rota.
    Se `getUserMedia` não estiver disponível (contexto não seguro, ex.: IP em HTTP) ou a
    permissão for negada, o botão mostra a razão e sugere o envio de arquivo.
  - Lembrete após envio bem-sucedido: "Retreine o modelo no Pi para aplicar."

## 7. Arquitetura do código

Diretório `software/api/app/assets/painel/`:

```
index.html             shell: barra superior, <main id="view">, região de toasts
style.css              tokens, base, layout e componentes
safe_logo.png          (existente, preservado)
js/app.js              bootstrap: router, indicadores de saúde
js/api.js              cliente HTTP da API
js/router.js           roteamento por hash com parâmetros e limpeza de view
js/dom.js              h() para criar elementos, formatação de datas, normalização para busca
js/ui/toast.js         notificações
js/ui/modal.js         modal acessível (foco preso, Esc, retorno de foco)
js/ui/led.js           componente LED
js/views/painel.js     tela Painel
js/views/pessoas.js    lista
js/views/pessoa-form.js criar/editar
js/views/pessoa.js     detalhe + fotos
js/views/camera.js     painel de captura por webcam
js/views/nao-encontrado.js
```

O `app.js` antigo (na raiz do painel) é removido e substituído por `js/app.js`, carregado com
`<script type="module" src="js/app.js">`.

### Contratos

- **`api.js`** expõe funções assíncronas (`health()`, `healthDatabase()`, `listarTodasPessoas()`,
  `buscarPessoa(id)`, `criarPessoa(dados)`, `atualizarPessoa(id, dados)`, `excluirPessoa(id)`,
  `listarImagens(id)`, `enviarImagem(id, blob, nome)`, `urlImagem(id, imgId)`).
  Toda falha vira `ApiError { status, mensagem, campos }`, onde `campos` mapeia nome do campo →
  mensagem (a partir de 422). Falha de rede vira `status: 0`. Timeout de 10s (30s para upload) via
  `AbortController`. Base URL = mesma origem.
- **Views** exportam `render(container, params) → cleanup?`. O router chama o `cleanup` anterior
  antes de renderizar a próxima view (para parar câmera, timers e listeners).
- **`dom.js` `h(tag, props, ...filhos)`** cria nós via `document.createElement` e `textContent`.
  Nenhum dado vindo da API é inserido com `innerHTML`.

### Fluxo de dados

Sem store global. Cada view busca o que precisa ao renderizar. Um cache em memória de curta duração
no `api.js` guarda a contagem de imagens por pessoa (invalidado após upload, criação ou exclusão)
para evitar repetir N requisições ao alternar entre Painel e Pessoas.

## 8. Tratamento de erros

| Situação | Comportamento |
| --- | --- |
| API inacessível | LED API vermelho; views mostram bloco de erro com "Tentar novamente". |
| Banco 503 | LED Banco vermelho; aviso no Painel. |
| 404 em pessoa | Tela "Pessoa não encontrada" com link para a lista. |
| 409 / 422 | Erros sob os campos do formulário. |
| 400 em upload | Mensagem da API no item do arquivo correspondente. |
| Câmera indisponível | Explicação no painel da câmera + sugestão de enviar arquivo. |
| Ação concluída | Toast curto (sucesso em verde, erro em vermelho). |

## 9. Acessibilidade e responsividade

- Navegação completa por teclado, foco visível no tom `--ui`, `aria-live` para toasts e status de
  upload, rótulos em todos os campos, modal com `role="dialog"` e foco preso.
- Layout desktop-first com grade de 12 colunas; abaixo de 840px vira coluna única, sem rolagem
  horizontal em 360px.

## 10. Verificação

Não há infraestrutura de testes JS no repositório; não será adicionada.

1. Subir a API localmente (`uvicorn app.main:app` em `software/api`) e abrir no navegador embutido.
2. Roteiro manual: Painel carrega saúde e métricas → criar pessoa → erro de duplicidade → enviar
   foto válida → enviar foto inválida (sem rosto / formato errado) → captura por webcam (quando
   disponível) → editar e limpar e-mail → excluir pessoa → derrubar a API e conferir estados de erro.
3. Conferir console sem erros e requisições de rede esperadas.
4. Conferir em 1440px e 375px.
5. Teste pytest em `software/api/tests/test_painel.py` garantindo que `GET /` redireciona para
   `/painel`, que `GET /painel/` retorna o `index.html` com o módulo `js/app.js` e que
   `GET /painel/js/app.js` e `GET /painel/style.css` respondem 200.

## 11. Observações sobre a API (não serão alteradas agora)

- Não há contagem total de pessoas nem de imagens; o Painel compensa com requisições paginadas.
- Não há endpoint para excluir imagens.
- `webcam.py` pede "ID ou Nome", mas a API só aceita o ID numérico (a documentação já orienta usar o ID).
  O detalhe da pessoa exibe o ID numérico em destaque, com botão de copiar, para facilitar o uso do script.
