#!/usr/bin/env python3
"""
Script utilitário para testar manualmente os estados da FSM via GPIO.
Digite a inicial do estado para alterar as saídas S (Strobe) e V (Validade):
  a -> Aguardando (S=0, V=0)
  v -> Validando  (S=1, V=0)
  c -> Aceito     (S=0, V=1)
  n -> Negado     (S=1, V=1)
  q -> Sair
"""

import sys
from pathlib import Path

BASE_PATH = Path(__file__).resolve().parent
sys.path.append(str(BASE_PATH))

from controle_gpio import gpio_controller


def exibir_menu():
    print("\n===========================================")
    print("   SAFE - Testador Manual de Estados GPIO  ")
    print("===========================================")
    print(" [A] -> Aguardando  (S=0, V=0)")
    print(" [V] -> Validando   (S=1, V=0)")
    print(" [C] -> Aceito      (S=0, V=1)")
    print(" [N] -> Negado      (S=1, V=1)")
    print(" [K] -> Pulso CLK   (0 -> 1 -> 0)")
    print(" [Q] -> Sair")
    print("===========================================")


def main():
    exibir_menu()

    try:
        while True:
            opcao = input("\nDigite a opção (A, V, C, N, K ou Q): ").strip().lower()

            if not opcao:
                continue

            if opcao == "a":
                gpio_controller.estado_aguardando()
                print(">> Estado alterado para: AGUARDANDO (S=0, V=0)")
            elif opcao == "v":
                gpio_controller.estado_validando()
                print(">> Estado alterado para: VALIDANDO (S=1, V=0)")
            elif opcao in ("c", "e"):
                gpio_controller.estado_aceito()
                print(">> Estado alterado para: ACEITO (S=0, V=1)")
            elif opcao == "n":
                gpio_controller.estado_negado()
                print(">> Estado alterado para: NEGADO (S=1, V=1)")
            elif opcao == "k":
                gpio_controller.pulsar_clock()
                print(">> Pulso manual enviado no pino CLK!")
            elif opcao == "q":
                print("Encerrando testador de GPIO...")
                break
            else:
                print("[Erro] Opção inválida! Digite A, V, C, N, K ou Q.")

    except KeyboardInterrupt:
        print("\nInterrompido pelo usuário.")
    finally:
        gpio_controller.fechar()
        print("GPIO finalizado com sucesso.")


if __name__ == "__main__":
    main()
