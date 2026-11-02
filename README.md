# SAFE — Sistema de Acesso por Reconhecimento Facial

Projeto de reconhecimento facial com controle de acesso físico via GPIO, desenvolvido para **Raspberry Pi 5**.

---

## 📁 Estrutura do Projeto

```
SAFE/
├── software/          # Software do Raspberry Pi (Python + FastAPI)
│   ├── api/           # API REST (FastAPI) + Painel Web
│   ├── reconhecimento_facial/   # Módulo de reconhecimento (OpenCV / LBPH)
│   ├── config.py      # Configurações e variáveis de ambiente
│   ├── controle_gpio.py  # Controle dos sinais GPIO (S, V)
│   └── README.md      # Documentação do software
├── hardware/          # Esquemas e diagramas do circuito
├── simulacao/         # Simulação da FSM
└── docs/              # Documentação geral
```

---

## 🚀 Início Rápido

### 1. Instalar dependências

```bash
cd software
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

### 2. Iniciar a API e o Painel Web

```bash
cd software/api
source venv/bin/activate
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

Acesse no navegador: **`http://IP_DO_RASPY:8000`**

### 3. Iniciar o Reconhecimento Facial

```bash
cd software
source .venv/bin/activate
HEADLESS=1 python reconhecimento_facial/reconhecimento_facial.py
```

---

## 🖥️ Painel de Administração

O painel web permite cadastrar, editar e remover pessoas autorizadas sem usar a linha de comando.

Após iniciar a API, acesse: `http://IP_DO_RASPY:8000/painel`

Para mais detalhes, veja o [README do Software](software/README.md).
