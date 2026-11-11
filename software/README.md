# SAFE — Software

Software de controle de acesso do projeto SAFE. O sistema usa uma câmera para
detectar e reconhecer rostos com OpenCV/LBPH, mantém os cadastros em uma API
FastAPI e envia o resultado para uma máquina de estados finitos (FSM) por GPIO.
O fluxo local foi pensado para Raspberry Pi 5; sem GPIO disponível, o controlador
funciona em modo de simulação.

## Como o projeto funciona

1. A API cadastra pessoas e armazena suas imagens faciais em SQLite.
2. O reconhecedor lê o modelo LBPH salvo em `model/`. Se ainda não houver modelo,
   treina com o `dataset/` local ou, se ele estiver vazio, consulta a API.
3. A câmera captura frames; o Haar Cascade localiza os rostos e o LBPH tenta
   identificar o maior rosto detectado.
4. A identificação é confirmada ao atingir `FRAMES_CONFIRMACAO` ocorrências no
   histórico recente. O resultado altera os sinais `S` e `V` da FSM.

O modelo salvo é carregado sem consultar novamente a API. Depois de cadastrar ou
alterar fotos, execute `python treinar.py` para gerar um modelo atualizado.

## Requisitos

- Python 3.12 (usado pela imagem Docker).
- Câmera compatível com OpenCV para reconhecimento ou captura por webcam.
- Raspberry Pi com GPIO para acionar a FSM; em outros ambientes o GPIO pode operar
  em modo simulado.
- Docker Compose é opcional e pode ser usado para executar a API.

## Instalação

Execute os comandos a partir desta pasta (`software/`):

```bash
python3 -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
pip install -r requirements.txt
cp .env.example .env
```

No Windows, ative o ambiente com `.venv\Scripts\activate`. Ajuste os valores de
`.env` conforme o hardware e o ambiente.

## Executar

### API

```bash
cd api
python -m alembic upgrade head
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

A documentação interativa do serviço fica em `http://localhost:8000/docs`.
Para executar a API em contêiner:

```bash
docker compose up --build
```

O Compose publica a API na porta `8000`, aplica as migrações ao iniciar e persiste
o banco no volume `safe_data`.

### Reconhecimento facial

Com janela de vídeo:

```bash
python reconhecimento_facial/reconhecimento_facial.py
```

Sem interface gráfica:

```bash
HEADLESS=1 python reconhecimento_facial/reconhecimento_facial.py
```

Para treinar/exportar o modelo e testar manualmente as saídas GPIO:

```bash
python treinar.py
python testar_gpio.py
```

Para capturar imagens com webcam, execute `python reconhecimento_facial/webcam.py`.
Informe o identificador numérico da pessoa cadastrada na API; pressione `C` para
capturar e `Q` para sair.

## Configuração

As variáveis abaixo podem ser definidas em `.env` ou no ambiente do processo:

| Variável | Padrão | Uso |
| --- | --- | --- |
| `PIN_STROBE` | `17` | GPIO do sinal `S` da FSM |
| `PIN_VALIDADE` | `27` | GPIO do sinal `V` da FSM |
| `PIN_CLOCK` | `22` | GPIO do clock da FSM |
| `DURACAO_STROBE` | `2.0` | Duração, em segundos, do intervalo de resultado |
| `CAMERA_INDEX` | `0` | Índice da câmera OpenCV |
| `FRAME_LARGURA` / `FRAME_ALTURA` | `640` / `480` | Resolução solicitada à câmera |
| `LBPH_THRESHOLD` | `70.0` | Limite de distância do reconhecedor LBPH |
| `FRAMES_CONFIRMACAO` | `5` | Ocorrências para confirmar a identificação |
| `DIRETORIO_MODELO` | `model` | Diretório dos arquivos LBPH |
| `DIRETORIO_DATASET` | `dataset` | Diretório opcional das imagens locais |
| `API_URL` | `http://127.0.0.1:8000` | Endereço consultado para carregar imagens |
| `HEADLESS` | `0` | Use `1`, `true` ou `yes` para desativar a janela |

## Documentação

- [Índice e diagramas](../docs/README.md)
- [Fluxo e arquitetura](../docs/funcionamento/README.md)
- [Reconhecimento facial e treinamento](../docs/reconhecimento-facial/README.md)
- [API e persistência](../docs/api/README.md)
- [GPIO e máquina de estados](../docs/hardware/README.md)

## Testes

Com as dependências instaladas, execute a partir de `software/`:

```bash
python -m pytest
```

- Pressione **`C`** para capturar a foto.
- Pressione **`Q`** para encerrar.

---

## 🖥️ Painel de Administração Web

O SAFE possui um painel web completo para gerenciar as pessoas autorizadas no sistema, sem precisar usar a linha de comando.

### Como acessar

1. **Inicie a API** (na pasta `software/api/`):
   ```bash
   cd software/api
   source venv/bin/activate
   uvicorn app.main:app --host 0.0.0.0 --port 8000
   ```
2. **Abra o navegador** e acesse:
   ```
   http://IP_DO_RASPY:8000
   ```
   → Você será redirecionado automaticamente para `http://IP_DO_RASPY:8000/painel`.

   > Se a API estiver rodando no mesmo computador, use `http://localhost:8000`.

### Funcionalidades do Painel

| Tela | Descrição |
| --- | --- |
| **Painel** | Jornada 3D guiada pelo scroll em seis momentos: visão geral (saúde da API e do banco, rechecada a cada 15 s, e totais de pessoas, fotos e pessoas sem foto), os quatro estados da FSM (Aguardando, Validando, Aceito, Negado) e a operação (passo a passo e mapa de pinos). Os interruptores S e V e os traços laterais levam direto a cada estado. |
| **Pessoas** | Lista com busca por nome, identificador ou e-mail (sem diferenciar acentos) e filtro "Sem foto". |
| **Nova / Editar pessoa** | Formulário com validação igual à da API; erros de duplicidade aparecem nos campos. Para limpar e-mail ou nascimento, apague o campo. |
| **Detalhe da pessoa** | Dados, ID numérico (para usar no `webcam.py`), galeria de fotos, envio por arrastar e soltar e captura pela webcam do navegador. Exclusão com confirmação (remove também as fotos). |

A cena 3D ao fundo (um rosto em nuvem de pontos sendo escaneado) reage ao uso: âmbar enquanto uma foto é enviada, verde quando é aceita ou um cadastro é salvo, vermelho em erro ou exclusão.

Observações:

- A webcam do navegador só funciona em `localhost` ou HTTPS. Acessando por `http://IP_DO_RASPY:8000`, use o envio de arquivo.
- A API não oferece exclusão de fotos individuais nem contagem agregada; o painel calcula os totais consultando as fotos de cada pessoa.
- Novas fotos só passam a valer após `python treinar.py`.
- O simulador da FSM é didático: o estado real é controlado pelo Raspberry Pi.

### Compatibilidade

| Condição | Comportamento |
| --- | --- |
| Navegador sem WebGL | A cena 3D é trocada por um fundo em gradiente; todo o resto funciona. |
| "Reduzir movimento" ativado no sistema | Sem cena, sem cursor customizado e sem jornada animada: o Painel vira seções em fluxo normal. |
| Tela de toque | Sem cursor customizado e sem inclinação 3D; a cena usa menos pontos. |
| Sem internet | O 3D funciona, pois o Three.js e o modelo do rosto são locais. Só as fontes vêm do Google Fonts; sem elas o navegador usa fontes do sistema. |

### Arquivos do Painel

Ficam em `api/app/assets/painel/` e são servidos pela própria API (mesma origem, sem build):

| Arquivo | Descrição |
| --- | --- |
| `index.html` | Camadas fixas: cena, grade, barra superior, área das telas e cursor |
| `style.css` | Tema escuro cinematográfico |
| `js/app.js` | Inicialização: cena, efeitos, indicadores de saúde e rotas |
| `js/api.js` | Cliente da API REST |
| `js/cena/` | Cena 3D: câmera e estados (`cena.js`), rosto, fundo de ondas, partículas e paleta |
| `js/efeitos/` | Títulos letra a letra, cursor, inclinação 3D e pontos da grade |
| `js/views/` | Telas: painel (jornada), lista, formulário, detalhe e câmera |
| `js/ui/` | Componentes: LED, modal, notificações e bloco de erro |
| `vendor/three.module.min.js` | Three.js 0.160.0 (licença MIT em `vendor/LICENSE-three.txt`) |
| `modelos/rosto-*` | Pontos, linhas de contorno e marcos faciais do rosto 3D |

O rosto foi amostrado de uma cabeça de referência gerada no Higgsfield (modelo Tripo). O arquivo
original não está no repositório; os scripts que o convertem estão em `docs/superpowers/ferramentas/`.
Se os arquivos de `modelos/` faltarem, o painel usa um rosto gerado por código.
