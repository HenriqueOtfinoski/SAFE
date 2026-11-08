import os
from pathlib import Path

# Carrega variáveis do arquivo .env se a biblioteca python-dotenv estiver instalada
try:
    from dotenv import load_dotenv

    env_path = Path(__file__).resolve().parent / ".env"
    if env_path.exists():
        load_dotenv(dotenv_path=env_path)
except ImportError:
    pass

BASE_DIR = Path(__file__).resolve().parent

# Pinos GPIO (Raspberry Pi 5)
PIN_STROBE = int(os.getenv("PIN_STROBE", "17"))
PIN_VALIDADE = int(os.getenv("PIN_VALIDADE", "27"))
PIN_CLOCK = int(os.getenv("PIN_CLOCK", "22"))
DURACAO_STROBE = float(os.getenv("DURACAO_STROBE", "2.0"))

# Configurações da Câmera e Processamento
CAMERA_INDEX = int(os.getenv("CAMERA_INDEX", "0"))
FRAME_LARGURA = int(os.getenv("FRAME_LARGURA", "640"))
FRAME_ALTURA = int(os.getenv("FRAME_ALTURA", "480"))
TAMANHO_ROSTO = (200, 200)

# Limite de frames consecutivos e limiar do LBPH
FRAMES_CONFIRMACAO = int(os.getenv("FRAMES_CONFIRMACAO", "5"))
LBPH_THRESHOLD = float(os.getenv("LBPH_THRESHOLD", "70.0"))

# Caminhos de Arquivos e Diretório do Modelo
CAMINHO_HAAR = (
    BASE_DIR / "api" / "app" / "assets" / "haarcascade_frontalface_default.xml"
)

NOME_DIR_MODELO = os.getenv("DIRETORIO_MODELO", "model")
DIRETORIO_MODELO = BASE_DIR / NOME_DIR_MODELO
DIRETORIO_MODELO.mkdir(parents=True, exist_ok=True)

CAMINHO_MODELO_XML = DIRETORIO_MODELO / "modelo_lbph.xml"
CAMINHO_MODELO_NOMES = DIRETORIO_MODELO / "modelo_lbph_nomes.json"

NOME_DIR_DATASET = os.getenv("DIRETORIO_DATASET", "dataset")
DIRETORIO_DATASET = BASE_DIR / NOME_DIR_DATASET

# Servidor API
API_URL = os.getenv("API_URL", "http://127.0.0.1:8000")

# Modo Headless (sem janela GUI para servidores/Raspberry Pi headless)
HEADLESS = os.getenv("HEADLESS", "0").lower() in ("1", "true", "yes")
