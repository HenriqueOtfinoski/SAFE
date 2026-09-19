import sys
from pathlib import Path

# Adiciona pasta raiz ao sys.path
sys.path.append(str(Path(__file__).resolve().parent.parent))

from controle_gpio import ControladorGPIO


def test_transicoes_estado_gpio():
    controller = ControladorGPIO(pin_strobe=17, pin_validade=27)

    # Estado Inicial / Aguardando
    controller.estado_aguardando()
    assert controller.obter_estado() == "Aguardando"

    # Estado Validando
    controller.estado_validando()
    assert controller.obter_estado() == "Validando"

    # Estado Aceito
    controller.estado_aceito()
    assert controller.obter_estado() == "Aceito"

    # Estado Negado
    controller.estado_negado()
    assert controller.obter_estado() == "Negado"

    # Retorno a Aguardando
    controller.estado_aguardando()
    assert controller.obter_estado() == "Aguardando"

    controller.fechar()
    print("Testes de estado GPIO executados com sucesso!")


if __name__ == "__main__":
    test_transicoes_estado_gpio()
