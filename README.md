# SAFE

Projeto de controle de acesso com reconhecimento facial. Uma câmera fornece
imagens ao software rodando em um Raspberry Pi, que detecta e reconhece rostos; o resultado é enviado como
sinais para uma máquina de estados finitos (FSM). O repositório reúne o software,
a documentação do circuito e arquivos de simulação.

## Visão geral

O projeto é composto por três partes:

- **Reconhecimento e controle** — aplicação Python que captura vídeo, detecta
  rostos com OpenCV/Haar Cascade, reconhece pessoas com LBPH e controla as saídas
  GPIO. Foi preparada para Raspberry Pi 5 e pode operar com GPIO simulado em
  ambientes sem hardware.
- **API e cadastro** — serviço FastAPI para cadastrar pessoas e armazenar imagens
  faciais em SQLite. O reconhecedor pode consultar esse serviço para treinar o
  modelo.
- **Circuito e FSM** — lógica de estados que recebe os sinais de controle e
  representa as condições Aguardando, Validando, Aceito e Negado.

### Fluxo resumido

1. O cadastro de pessoas e fotos é feito pela API ou por captura com webcam.
2. O reconhecedor carrega um modelo LBPH existente; se necessário, treina usando
   imagens locais ou imagens consultadas na API.
3. A câmera é analisada continuamente. Uma identificação é confirmada após
   ocorrências consecutivas suficientes no histórico de detecções.
4. O software seleciona o estado correspondente e envia os sinais `S` e `V` à
   FSM por GPIO.

| Estado     | `S` | `V` | Resultado                                   |
| ---------- | :-: | :-: | ------------------------------------------- |
| Aguardando | `0` | `0` | Nenhum rosto em processamento               |
| Validando  | `1` | `0` | Rosto detectado, identificação em andamento |
| Aceito     | `0` | `1` | Pessoa reconhecida                          |
| Negado     | `1` | `1` | Pessoa desconhecida ou não confirmada       |

## Estrutura do repositório

```text
.
├── docs/       Guias, diagramas, imagens e material do projeto
├── hardware/   Documentação relacionada ao hardware
├── simulacao/  Arquivos de simulação do circuito e do clock
└── software/   API, reconhecimento facial, GPIO, testes e execução
```

## Começar pelo software

O guia de instalação, configuração e execução está em
[software/README.md](./software/README.md). Em resumo, com Python 3 instalado:

```bash
cd software
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
```

Para iniciar a API em Docker Compose:

```bash
cd software
docker compose up --build
```

Para iniciar o reconhecimento facial localmente, com uma câmera disponível:

```bash
cd software
python reconhecimento_facial/reconhecimento_facial.py
```

Esses comandos são pontos de partida; detalhes de configuração, migrações do
banco, treinamento do modelo, captura de imagens e execução headless estão no
[guia do software](./software/README.md).

## Documentação e diagramas

- [Índice da documentação](./docs/README.md)
- [Arquitetura e fluxo do sistema](./docs/funcionamento/README.md)
- [Reconhecimento facial e treinamento](./docs/reconhecimento-facial/README.md)
- [API e persistência](./docs/api/README.md)
- [GPIO e estados da FSM](./docs/hardware/README.md)
- [Diagrama de arquitetura](./docs/diagramas/arquitetura.drawio)
- [Diagrama da máquina de estados](./docs/diagramas/maquina_de_estados.drawio)
- [Simulação da FSM no Logisim](./simulacao/logsim/FMS.circ)
- [Esquemático do clock no Tinkercad](./simulacao/tinkercad/esquematico_clock.png)

## Testes

Os testes do software podem ser executados dentro da pasta `software/`:

```bash
python -m pytest
```

## Observações de segurança

As imagens faciais são dados pessoais sensíveis. Restrinja o acesso ao banco e às
capturas, e não exponha a API diretamente à internet sem adicionar controles
adequados de autenticação, transporte seguro e proteção da infraestrutura.

Antes de conectar o Raspberry Pi ao circuito, confira os níveis elétricos: os
GPIO do Raspberry Pi operam em 3,3 V e não toleram 5 V diretamente. Consulte o
[guia de hardware](./docs/hardware/README.md).
