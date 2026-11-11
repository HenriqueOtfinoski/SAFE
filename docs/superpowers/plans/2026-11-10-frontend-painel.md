# SAFE — Painel de Administração: Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reescrever o painel web do SAFE (`/painel`) com o tema "sala de controle", integrado à API existente.

**Architecture:** JS puro em ES modules, sem build, servido pelo `StaticFiles` já montado em `/painel`. Router por hash; cada view exporta `render(container, params) → cleanup?`; `api.js` centraliza HTTP e normaliza erros em `ApiError`. Nenhum dado da API entra via `innerHTML`.

**Tech Stack:** HTML/CSS/JS (ES2022 modules), Google Fonts (Space Grotesk, JetBrains Mono), FastAPI/pytest para o teste de serviço.

**Spec:** `docs/superpowers/specs/2026-11-10-frontend-design.md`

## Global Constraints

- Branch `front`. **Não commitar** (pedido do usuário): onde haveria commit, há um checkpoint de verificação.
- Backend não muda: nenhum arquivo em `software/api/app/` fora de `assets/painel/` é alterado.
- Raiz: `software/api/app/assets/painel/`. Recursos em caminhos **relativos**; API em caminhos absolutos (`/pessoas`, `/health`).
- `safe_logo.png` preservado. `app.js` antigo da raiz do painel é removido.
- Sem dependências npm, sem node (não instalado na máquina).
- Tokens de cor exatamente como na spec §4 (`--bg #0b0d0e` … `--idle #64748b`).
- Textos da UI em português do Brasil.
- Timeouts: 10 000 ms (requisições), 30 000 ms (upload). Concorrência de imagens no Painel: 6. Recheck de saúde: 15 000 ms.
- Upload: JPEG/PNG, ≤ 5 242 880 bytes. Webcam: JPEG qualidade 0.92.

## Review Focus

1. Nome/e-mail com HTML (`<img onerror>`) — deve aparecer como texto literal em lista, detalhe, modal e toast. → teste no Task 6.
2. Sair da tela de detalhe com a webcam aberta — a câmera deve desligar (LED da câmera apaga). → teste no Task 8.
3. Mais de 100 pessoas — lista e métricas devem contar todas (paginação). → teste no Task 2.
4. API cai com a tela aberta — LED vermelho e blocos de erro com "Tentar novamente", sem tela branca. → teste no Task 5.
5. Edição limpando e-mail/data — envia `null` e a API persiste vazio; sem alteração, botão desabilitado. → teste no Task 7.

## Como verificar (vale para todos os tasks)

API local, a partir de `software/api`:

```bash
python -m alembic upgrade head
python -m uvicorn app.main:app --reload --port 8000
```

Abrir `http://localhost:8000/painel/` no navegador embutido. Verificações de lógica pura usam
`javascript_tool` com `await import('/painel/js/<modulo>.js')` e asserts; o resultado esperado é indicado
em cada passo. Console sem erros é condição de todo checkpoint.

---

### Task 1: Shell, estilos-base e teste de serviço

**Files:**
- Create: `software/api/tests/test_painel.py`
- Modify (reescrever): `software/api/app/assets/painel/index.html`, `software/api/app/assets/painel/style.css`
- Delete: `software/api/app/assets/painel/app.js`
- Create: `software/api/app/assets/painel/js/app.js` (stub que só escreve "ok" em `#view`)

**Interfaces:**
- Produces: DOM do shell — `header.topbar` com `.brand` (SVG do escudo), `nav` com links `a[data-route="painel"]` (`#/painel`) e `a[data-route="pessoas"]` (`#/pessoas`), `#health-api` e `#health-db` (contêineres de LED); `main#view`; `#toasts` (`aria-live="polite"`).
- Produces: classes CSS usadas pelos tasks seguintes: `.panel`, `.section-label`, `.btn`, `.btn--primary`, `.btn--ghost`, `.btn--danger`, `.field`, `.field__error`, `.input`, `.badge`, `.badge--warn`, `.skeleton`, `.empty`, `.error-block`, `.grid`, `.led`, `.led--on`, `.led--ok|--wait|--bad|--idle|--ui`.

- [ ] **Step 1: Escrever o teste que falha** — `test_painel.py` com:
  - `test_raiz_redireciona_para_painel`: `client.get("/", follow_redirects=False)` → `status_code in (307, 302)` e `headers["location"] == "/painel"`.
  - `test_painel_serve_index_modular`: `client.get("/painel/")` → 200 e `'type="module"'` e `'src="js/app.js"'` no texto.
  - `test_painel_recursos`: `/painel/js/app.js` e `/painel/style.css` → 200.
- [ ] **Step 2: Rodar e ver falhar** — `cd software/api && python -m pytest tests/test_painel.py -v` → FAIL em `index_modular` e `recursos` (js/app.js inexistente).
- [ ] **Step 3: Implementar** o shell (`index.html`), `style.css` com tokens da spec §4, grade pontilhada de fundo, tipografia, componentes listados acima, `prefers-reduced-motion`, breakpoint 840px; SVG inline do escudo com rosto em circuito em traço `--ui`; remover `app.js` antigo; criar o stub `js/app.js`.
- [ ] **Step 4: Rodar** — mesmo comando → 3 PASS; `python -m pytest` em `software/api` → todos PASS.
- [ ] **Step 5: Checkpoint** — abrir `/painel/` em 1440px e 375px: barra superior legível, sem rolagem horizontal, fontes carregadas.

### Task 2: Utilitários de DOM e cliente da API

**Files:**
- Create: `js/dom.js`, `js/api.js`

**Interfaces:**
- Produces (`dom.js`):
  - `h(tag: string, props?: object, ...filhos: (Node|string|null|false)[]) → HTMLElement` — `props` aceita `class`, `dataset`, `on<Evento>` (listener), atributos ARIA e booleanos; strings viram `Text`. Nunca usa `innerHTML`.
  - `limpar(el: Element) → void`
  - `formatarData(iso: string) → string` (`dd/mm/aaaa`), `formatarDataHora(iso) → string` (`dd/mm/aaaa hh:mm`). `formatarData('2000-05-20')` deve dar `20/05/2000` sem deslocamento de fuso.
  - `normalizar(texto: string) → string` — minúsculas, sem acentos.
  - `iniciais(nome: string) → string` — até 2 letras maiúsculas.
- Produces (`api.js`):
  - `class ApiError extends Error { status: number; mensagem: string; campos: Record<string,string> }`
  - `health() → Promise<{status}>`, `healthDatabase() → Promise<{status}>`
  - `listarTodasPessoas() → Promise<Pessoa[]>` (páginas de `limite=100` até vir < 100)
  - `buscarPessoa(id)`, `criarPessoa(dados)`, `atualizarPessoa(id, dados)`, `excluirPessoa(id) → Promise<void>`
  - `listarImagens(id) → Promise<Imagem[]>`
  - `enviarImagem(id, blob: Blob, nome: string) → Promise<Imagem>` (FormData campo `arquivo`, timeout 30 s)
  - `urlImagem(pessoaId, imagemId) → string` (`/pessoas/{p}/imagens/{i}/arquivo`)
  - `contarImagens(pessoas: Pessoa[]) → Promise<Map<number, {total: number, primeira: number|null}>>` — concorrência 6, usa cache; `invalidarImagens(id?)` limpa uma entrada ou tudo.
  - Erros: rede/timeout → `status 0`, mensagem "Não foi possível conectar à API."; 422 → `campos` a partir de `detail[].loc` (último elemento é o campo; `loc` só com `body` → `campos._form`); 409 → `campos.email` e `campos.identificador` = "E-mail ou identificador já cadastrado."; demais → `mensagem = detail` se string.

- [ ] **Step 1: Verificação que falha** — no navegador: `await import('/painel/js/dom.js')` → erro 404.
- [ ] **Step 2: Implementar** `dom.js` e `api.js` conforme as interfaces.
- [ ] **Step 3: Verificar `dom.js`** via `javascript_tool`:
  `h('p', {}, '<b>x</b>').textContent === '<b>x</b>'` e `.children.length === 0`; `normalizar('JOÃO Ávila') === 'joao avila'`; `formatarData('2000-05-20') === '20/05/2000'`; `iniciais('maria da silva') === 'MS'` → todos `true`.
- [ ] **Step 4: Verificar `api.js` contra a API real:** criar pessoa duplicada → `ApiError` com `status 409` e `campos.identificador` preenchido; `criarPessoa({nome:'', identificador:'x'})` → `status 422`, `campos.nome` definido; `buscarPessoa(999999)` → `status 404`.
- [ ] **Step 5: Verificar paginação (Review Focus 3)** — criar 105 pessoas via `fetch` em loop no console; `(await listarTodasPessoas()).length >= 105` → `true`. Remover as pessoas de teste ao final (`excluirPessoa`).
- [ ] **Step 6: Checkpoint** — console sem erros.

### Task 3: Router, toast, modal e LED

**Files:**
- Create: `js/router.js`, `js/ui/toast.js`, `js/ui/modal.js`, `js/ui/led.js`
- Create: `js/views/nao-encontrado.js`
- Modify: `js/app.js` (substitui o stub)

**Interfaces:**
- Produces (`router.js`): `iniciarRouter(container: HTMLElement, rotas: Array<{padrao: string, view: () => Promise<{render}>}>, aoNavegar?: (rota) => void)`. Padrões: `/painel`, `/pessoas`, `/pessoas/nova`, `/pessoas/:id`, `/pessoas/:id/editar`; `#/` e vazio → `/painel`. `params = { id?: string, query: URLSearchParams }`. Chama o `cleanup` anterior antes de renderizar; marca `aria-current="page"` no link cuja `data-route` é o primeiro segmento; move foco para `main` após render. Exporta também `navegar(hash: string)`.
- Produces (`toast.js`): `toast(mensagem: string, tipo?: 'ok'|'erro'|'info')` — some em 4 s, empilha em `#toasts`.
- Produces (`modal.js`): `abrirModal({titulo: string, conteudo: Node, acoes?: Node[]}) → {fechar(): void, elemento: HTMLElement}` e `confirmar({titulo, mensagem, rotuloConfirmar, perigo?: boolean}) → Promise<boolean>`. `role="dialog"`, `aria-modal`, foco preso, Esc fecha, devolve foco ao gatilho.
- Produces (`led.js`): `led(tom: 'ok'|'wait'|'bad'|'idle'|'ui', aceso: boolean, rotulo?: string) → HTMLElement`.
- `app.js`: registra rotas (views ainda inexistentes apontam para `nao-encontrado` até seus tasks).

- [ ] **Step 1: Implementar** os módulos.
- [ ] **Step 2: Verificar router** — navegar para `#/xyz` → tela "Página não encontrada" com link para o Painel; `#/pessoas/12/editar` em uma view de teste temporária via console recebe `params.id === '12'`; `#/pessoas?filtro=sem-foto` → `params.query.get('filtro') === 'sem-foto'`.
- [ ] **Step 3: Verificar modal** — `confirmar(...)` pelo console: Tab circula só dentro do modal; Esc resolve `false`; foco volta ao `body`/gatilho.
- [ ] **Step 4: Checkpoint** — `toast('<i>x</i>','erro')` mostra o texto literal.

### Task 4: Indicadores de saúde na barra superior

**Files:**
- Create: `js/saude.js`
- Modify: `js/app.js`

**Interfaces:**
- Consumes: `health`, `healthDatabase` (Task 2), `led` (Task 3).
- Produces: `iniciarSaude(alvoApi: HTMLElement, alvoDb: HTMLElement) → { estado(): {api: 'ok'|'bad'|'checking', db: ...,  verificadoEm: Date|null}, assinar(fn): () => void, verificarAgora(): Promise<void> }`. Recheca a cada 15 s apenas com `document.visibilityState === 'visible'`; rechecagem imediata ao voltar a ficar visível.

- [ ] **Step 1: Implementar** e ligar em `app.js`.
- [ ] **Step 2: Verificar** — com a API no ar: dois LEDs verdes "API" e "Banco". Parar o uvicorn: em ≤ 15 s ambos vermelhos, sem erro não tratado no console. Subir de novo: voltam a verde.
- [ ] **Step 3: Checkpoint** — idem em 375px (LEDs com rótulo visível ou `aria-label`).

### Task 5: Tela Painel

**Files:**
- Create: `js/views/painel.js`
- Modify: `js/app.js` (rota `/painel`)

**Interfaces:**
- Consumes: `iniciarSaude().assinar/estado` (Task 4), `listarTodasPessoas`, `contarImagens` (Task 2), `led`, `toast`.
- Produces: `render(container, params) → cleanup` (cancela assinatura de saúde).

Conteúdo exato (spec §6.1):
- `01 / SISTEMA` — blocos API e Banco com LED, texto ("Operacional"/"Indisponível"/"Verificando…") e "Última checagem hh:mm:ss".
- `02 / CADASTROS` — Pessoas, Fotos, Sem foto (âmbar se > 0, link `#/pessoas?filtro=sem-foto`).
- `03 / MÁQUINA DE ESTADOS` — cartões `Aguardando 00`, `Validando 10`, `Aceito 01`, `Negado 11` (tons idle/wait/ok/bad); interruptores S e V (`role="switch"`, `aria-checked`); legenda "Simulação — o estado real é controlado pelo Raspberry Pi."; tabela de pinos S=GPIO 17/pino 11, V=GPIO 27/pino 13, CLK=GPIO 22/pino 15.
- `04 / OPERAÇÃO` — passos: 1 Cadastrar pessoa (link `#/pessoas/nova`), 2 Enviar fotos, 3 Treinar o modelo no Pi com `python treinar.py` e botão "Copiar" (`navigator.clipboard`, fallback: selecionar o texto; toast "Comando copiado").

- [ ] **Step 1: Implementar.** Métricas com `.skeleton` enquanto carregam; erro local em `.error-block` com botão "Tentar novamente" que recarrega só o bloco.
- [ ] **Step 2: Verificar simulador** — S=0,V=0 acende Aguardando; S=1,V=0 Validando; S=0,V=1 Aceito; S=1,V=1 Negado; operável por teclado (Espaço).
- [ ] **Step 3: Verificar métricas** — com 2 pessoas (uma com foto, uma sem): Pessoas 2, Fotos ≥ 1, Sem foto 1 em âmbar; o link abre a lista filtrada.
- [ ] **Step 4: Verificar queda da API (Review Focus 4)** — com o Painel aberto, parar o uvicorn e clicar "Tentar novamente" → bloco de erro com a mensagem de conexão, restante da tela intacto.
- [ ] **Step 5: Checkpoint** — 1440px e 375px.

### Task 6: Lista de pessoas

**Files:**
- Create: `js/views/pessoas.js`
- Modify: `js/app.js` (rota `/pessoas`)

**Interfaces:**
- Consumes: `listarTodasPessoas`, `contarImagens`, `urlImagem` (Task 2); `h`, `normalizar`, `iniciais`, `formatarData`.
- Produces: `render(container, params)`; lê `params.query.get('filtro') === 'sem-foto'`.

- [ ] **Step 1: Implementar** cabeçalho ("Pessoas" + contagem em mono, busca, filtro segmentado `Todas`/`Sem foto` que atualiza o hash, botão "Nova pessoa" → `#/pessoas/nova`), linhas como `<a href="#/pessoas/{id}">` com avatar (`<img loading="lazy">` da primeira foto ou iniciais), nome, `#id · identificador` em mono, e-mail, selo "N fotos" (`.badge--warn` se 0), "Cadastro dd/mm/aaaa". Busca em `normalizar(nome+identificador+email)`, sem refazer requisição. Estados: skeleton, vazio ("Nenhuma pessoa cadastrada" + CTA), sem resultado ("Nada encontrado para “termo”"), erro com tentar novamente.
- [ ] **Step 2: Verificar busca** — pessoa "João Ávila" encontrada por `joao`, `AVILA` e pelo identificador.
- [ ] **Step 3: Verificar escape (Review Focus 1)** — criar via `fetch` pessoa com nome `<img src=x onerror=alert(1)>` e identificador `xss-1`: aparece como texto literal na lista, nenhum alerta, nenhum `<img src="x">` no DOM (`document.querySelector('img[src="x"]') === null`). Repetir a checagem no detalhe e no modal de exclusão após o Task 8. Excluir a pessoa de teste ao final.
- [ ] **Step 4: Checkpoint** — filtro "Sem foto" mostra apenas quem tem 0 fotos; 375px sem rolagem horizontal.

### Task 7: Formulário criar/editar

**Files:**
- Create: `js/views/pessoa-form.js`
- Modify: `js/app.js` (rotas `/pessoas/nova` e `/pessoas/:id/editar`)

**Interfaces:**
- Consumes: `criarPessoa`, `atualizarPessoa`, `buscarPessoa`, `invalidarImagens`, `ApiError` (Task 2); `navegar`, `toast`.
- Produces: `render(container, params)` — modo edição quando `params.id` existe.
- Produces (exportado para verificação): `validar(valores: {nome, identificador, email, data_nascimento}) → Record<string,string>` e `diferencas(original: Pessoa, valores) → object` (campos alterados; string vazia em `email`/`data_nascimento` vira `null`; `nome`/`identificador` vazios nunca entram como `null`).

Regras (spec §3): nome 1–100, identificador 1–80, e-mail opcional `^[^@\s]+@[^@\s]+\.[^@\s]+$` até 255, data ≤ hoje (`max` no input). Mensagens: "Informe o nome.", "Informe o identificador.", "E-mail inválido.", "A data não pode estar no futuro.".

- [ ] **Step 1: Implementar** com validação ao sair do campo e no envio; erros da API mapeados por `ApiError.campos` (`_form` vai para um aviso acima dos botões); botão "Salvando…" desabilitado durante envio; na edição, botão desabilitado enquanto `diferencas()` for vazio; "Cancelar" volta ao detalhe/lista. Após criar → `#/pessoas/{id}` com toast "Pessoa cadastrada. Agora envie as fotos.". Após editar → detalhe com toast "Alterações salvas.". Pessoa inexistente na edição → mensagem "Pessoa não encontrada" com link para a lista.
- [ ] **Step 2: Verificar funções puras** via `javascript_tool`: `validar({nome:'',identificador:'a',email:'x',data_nascimento:'2999-01-01'})` tem chaves `nome`, `email`, `data_nascimento`; `diferencas({nome:'A',identificador:'b',email:'a@b.c',data_nascimento:null},{nome:'A',identificador:'b',email:'',data_nascimento:''})` deep-equals `{email:null}`.
- [ ] **Step 3: Verificar fluxo** — criar pessoa → vai ao detalhe; criar outra com o mesmo identificador → erro sob Identificador e E-mail, sem toast genérico.
- [ ] **Step 4: Verificar limpar campos (Review Focus 5)** — editar a pessoa apagando o e-mail → salvar → `buscarPessoa(id).email === null`; reabrir edição sem mexer → botão "Salvar" desabilitado.
- [ ] **Step 5: Checkpoint** — duplo clique em "Salvar" gera uma só requisição (aba Rede).

### Task 8: Detalhe da pessoa, fotos e webcam

**Files:**
- Create: `js/views/pessoa.js`, `js/views/camera.js`
- Modify: `js/app.js` (rota `/pessoas/:id`)

**Interfaces:**
- Consumes: `buscarPessoa`, `listarImagens`, `enviarImagem`, `excluirPessoa`, `urlImagem`, `invalidarImagens` (Task 2); `abrirModal`, `confirmar`, `toast`, `navegar`.
- Produces (`camera.js`): `abrirCamera({aoCapturar: (blob: Blob) => Promise<void>}) → { fechar(): void }` — monta painel com `<video>` + guia oval; "Capturar" congela em `<canvas>` → prévia com "Enviar"/"Refazer"; `toBlob('image/jpeg', 0.92)`; `fechar()` para todas as tracks. `cameraDisponivel() → {ok: boolean, motivo?: string}` — motivo "A câmera só funciona em localhost ou HTTPS. Use o envio de arquivo." quando `!window.isSecureContext` ou sem `navigator.mediaDevices`; permissão negada → "Permissão da câmera negada.".
- Produces (`pessoa.js`): `render(container, params) → cleanup` (cleanup fecha a câmera).

Conteúdo: cabeçalho com nome, ID numérico em destaque mono com botão copiar ("Use este ID no webcam.py"), identificador, e-mail, nascimento, cadastro; ações Editar (`#/pessoas/{id}/editar`) e Excluir (`confirmar` com "As fotos desta pessoa também serão removidas.", perigo) → toast "Pessoa excluída." e `#/pessoas`. Seção `FOTOS (n)`: grade quadrada, metadados (`largura×altura · tipo · data`) no hover/foco, clique → modal ampliado; nota "Fotos não podem ser removidas pela interface."; dropzone + seletor múltiplo (pré-validação tipo/tamanho com mensagens "Formato não suportado. Use JPEG ou PNG." e "Arquivo maior que 5 MB."), envio sequencial com status por item em lista `aria-live`; botão "Usar webcam" (desabilitado com o motivo quando indisponível). Após ≥ 1 envio bem-sucedido: aviso "Retreine o modelo no Pi para aplicar (python treinar.py)."; `invalidarImagens(id)`. Pessoa inexistente → "Pessoa não encontrada" com link.

- [ ] **Step 1: Implementar** `camera.js` e `pessoa.js`.
- [ ] **Step 2: Verificar upload** — enviar uma foto com 1 rosto (gerar uma a partir de imagem pública de rosto ou da webcam) → aparece na grade e contador sobe; enviar PNG sem rosto → item mostra "Nenhum rosto foi detectado, envie outra foto"; arquivo `.txt` renomeado → bloqueado no cliente.
- [ ] **Step 3: Verificar webcam** — em `localhost`: abrir, capturar, enviar → foto na grade. Simular contexto indisponível chamando `cameraDisponivel()` com `navigator.mediaDevices` ausente (stub temporário no console) → motivo exibido.
- [ ] **Step 4: Verificar liberação da câmera (Review Focus 2)** — abrir webcam e navegar para `#/pessoas` → `document.querySelector('video') === null` e as tracks guardadas antes (`window.__t = video.srcObject.getTracks()`) têm `readyState === 'ended'`.
- [ ] **Step 5: Verificar exclusão** — excluir pessoa → volta à lista, pessoa some, métricas do Painel atualizadas.
- [ ] **Step 6: Checkpoint** — Review Focus 1 repetido no detalhe e no modal de exclusão.

### Task 9: Documentação e verificação final

**Files:**
- Modify: `software/README.md` (seção "Painel de Administração Web")

- [ ] **Step 1: Atualizar a seção** — tabela de funcionalidades: Painel (saúde, métricas, simulador da FSM, fluxo de operação), Pessoas (lista, busca, filtro sem foto), Cadastro/Edição, Detalhe (fotos, upload, webcam em localhost/HTTPS), Exclusão. Tabela de arquivos com `index.html`, `style.css`, `js/`. Remover a linha "Configuração da API" e a nota de CORS (painel é servido na mesma origem).
- [ ] **Step 2: Rodar testes** — `cd software/api && python -m pytest -v` → todos PASS.
- [ ] **Step 3: Roteiro completo da spec §10** no navegador embutido (1440px e 375px), console sem erros.
- [ ] **Step 4: Checkpoint final** — `git status` mostra apenas: `assets/painel/` (modificados/novos, `app.js` antigo removido), `tests/test_painel.py`, `software/README.md`, `docs/superpowers/`, além dos não rastreados que já existiam (`.vscode/`,
  `software/api/app/static/`). Nada commitado.
