import sys
import time
from pathlib import Path

# Adiciona pasta raiz ao sys.path para importar config e controle_gpio
sys.path.append(str(Path(__file__).resolve().parent.parent))

from config import DURACAO_STROBE
from controle_gpio import gpio_controller


def liberar_acesso(nome: str = "") -> None:
    # Ativa o sinal de Acesso Aceito (S=0, V=1) na FSM via GPIO e mantém até a próxima alteração.
    print(f"\n==========================================")
    print(f"   ACESSO ACEITO PARA: {nome or 'Usuário'}")
    print(f"==========================================\n")

    gpio_controller.estado_aceito()


def recusar_acesso() -> None:
    # Ativa o sinal de Acesso Negado (S=1, V=1) na FSM via GPIO e mantém até a próxima alteração.
    print(f"\n------------------------------------------")
    print(f"   ACESSO NEGADO (Pessoa Desconhecida)")
    print(f"------------------------------------------\n")

    gpio_controller.estado_negado()
