# SAFE - Software (Raspberry Pi 5)

Módulo de processamento leve e reconhecimento facial para **Raspberry Pi 5 (4 GB RAM)** com acionamento dos sinais **S (Strobe)** e **V (Validade)** da Máquina de Estados Finitos (FSM) via hardware GPIO.

---

## 🔌 Mapeamento de Pinos GPIO

Os sinais lógicos de controle da FSM (CIs 7408, 7404, 7432, 7474) são acionados pelos pinos GPIO do Raspberry Pi 5:

| Sinal   | Função                             | Pino GPIO | Pino Físico (Header) |
| ------- | ---------------------------------- | --------- | -------------------- |
| **S**   | Strobe / Processamento ativo       | `GPIO 17` | Pino 11              |
| **V**   | Validade (1 = Aceito/Negado)       | `GPIO 27` | Pino 13              |
| **CLK** | Clock (Pulso de amostragem/latch)  | `GPIO 22` | Pino 15              |
| **GND** | Terra Comum do Circuito            | `GND`     | Pino 6 ou 9/14       |

_Nota: Os pinos podem ser alterados definindo as variáveis de ambiente `PIN_STROBE` e `PIN_VALIDADE`._

---

## ⚙️ Tabela de Estados da FSM

| Estado FSM     | Sinal S | Sinal V | Descrição                                              |
| -------------- | :-----: | :-----: | ------------------------------------------------------ |
| **Aguardando** |   `0`   |   `0`   | Câmera ativa, nenhum rosto em processamento.           |
| **Validando**  |   `1`   |   `0`   | Rosto detectado, acumulando confirmação de identidade. |
| **Aceito**     |   `0`   |   `1`   | Rosto reconhecido. Acesso Liberado.                    |
| **Negado**     |   `1`   |   `1`   | Rosto não reconhecido ou abaixo do threshold.          |

---

## 🚀 Como Executar no Raspberry Pi 5

### 1. Instalação das Dependências

No Raspberry Pi OS (Debian 12 Bookworm / 64-bit):

```bash
cd software
python3 -m venv .venv
source .venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
```

> **Nota para Pi 5**: A biblioteca `gpiozero` inclusa no `requirements.txt` utiliza o backend `gpiod`/`lgpio` nativo do chip RP1 do Raspberry Pi 5. Em PCs/Macs sem GPIO, o sistema ativa automaticamente o modo de **Simulação Mock** sem erros.

---

### 2. Executando o Reconhecimento Facial

#### Modo Direto (Com tela/Monitor conectado):

```bash
python reconhecimento_facial/reconhecimento_facial.py
```

#### Modo Headless (Em segundo plano / Servidor sem tela):

```bash
HEADLESS=1 python reconhecimento_facial/reconhecimento_facial.py
```

---

### 3. Treinamento Offline Rápido

Para acelerar a inicialização no Raspberry Pi, você pode gerar o modelo LBPH pré-treinado (`modelo_lbph.xml`):

```bash
python treinar.py
```

O modelo gerado será recarregado instantaneamente em **milissegundos** no boot sem precisar consultar a API HTTP.

---

### 4. Captura de Fotos para Cadastro (Webcam)

Para cadastrar novas fotos diretamente no dataset local ou API:

```bash
python reconhecimento_facial/webcam.py
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

