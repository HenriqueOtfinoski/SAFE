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
<<<<<<< HEAD
=======

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

| Funcionalidade | Descrição |
| --- | --- |
| **Configuração da API** | Informe o IP/porta da API e verifique a conexão em tempo real. |
| **Cadastrar Pessoa** | Formulário completo: nome, identificador, e-mail, data de nascimento e upload de fotos faciais (arrastar e soltar ou seleção de arquivo). |
| **Listar Pessoas** | Tabela completa com busca por nome/identificador/e-mail e atualização em tempo real. |
| **Editar Pessoa** | Altere os dados e adicione novas imagens faciais. Visualiza as fotos já salvas. |
| **Excluir Pessoa** | Remove a pessoa e todas as imagens com confirmação de segurança. |

### Arquivos do Painel

| Arquivo | Localização | Descrição |
| --- | --- | --- |
| `index.html` | `api/app/assets/painel/` | Estrutura HTML do painel |
| `style.css` | `api/app/assets/painel/` | Estilos visuais (tema escuro) |
| `app.js` | `api/app/assets/painel/` | Lógica JavaScript (chamadas à API REST) |

> **CORS:** Se acessar o painel de um computador diferente do Raspberry Pi, pode ser necessário configurar o middleware de CORS na API.

>>>>>>> front
