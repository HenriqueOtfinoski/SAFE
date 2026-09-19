"""
Módulo de Controle GPIO para o projeto SAFE.

Controla os sinais de saída:
  - S (Strobe): Sinal de processamento / ativação da FSM
  - V (Validade): Sinal de resultado (1 = Aceito, 0 = Negado/Validando)

Estados da FSM (CIs 7408, 7404, 7432):
  - Aguardando: S = 0, V = 0
  - Validando:  S = 1, V = 0
  - Aceito:     S = 1, V = 1
  - Negado:     S = 1, V = 0
"""

import logging
import sys
from typing import Optional

from config import PIN_STROBE, PIN_VALIDADE

logging.basicConfig(
    level=logging.INFO, format="[%(asctime)s] %(levelname)s: %(message)s"
)
logger = logging.getLogger("SAFE.GPIO")

try:
    # Tenta utilizar gpiozero, padrão moderno compatível com Raspberry Pi 5 (via lgpio/gpiod)
    from gpiozero import OutputDevice

    GPIOPresente = True
except ImportError:
    GPIOPresente = False


class ControladorGPIO:
    # Gerenciador dos sinais GPIO S e V do SAFE.

    def __init__(self, pin_strobe: int = PIN_STROBE, pin_validade: int = PIN_VALIDADE):
        self.pin_strobe_num = pin_strobe
        self.pin_validade_num = pin_validade
        self._strobe: Optional[object] = None
        self._validade: Optional[object] = None
        self._estado_atual = "Aguardando"
        self._is_hardware = False

        self._inicializar()

    def _inicializar(self) -> None:
        if GPIOPresente:
            try:
                self._strobe = OutputDevice(self.pin_strobe_num, initial_value=False)
                self._validade = OutputDevice(
                    self.pin_validade_num, initial_value=False
                )
                self._is_hardware = True
                logger.info(
                    f"GPIO Hardware inicializado (RPi 5): S=GPIO{self.pin_strobe_num}, V=GPIO{self.pin_validade_num}"
                )
            except Exception as e:
                logger.warning(
                    f"Falha ao acessar hardware GPIO ({e}). Alternando para modo Simulação/Mock."
                )
                self._is_hardware = False
        else:
            logger.info(
                "Biblioteca GPIO (gpiozero/lgpio) não encontrada. Modo Simulação/Mock ativo."
            )
            self._is_hardware = False

        self.estado_aguardando()

    def _set_pins(self, s: bool, v: bool) -> None:
        if self._is_hardware and self._strobe and self._validade:
            if s:
                self._strobe.on()
            else:
                self._strobe.off()

            if v:
                self._validade.on()
            else:
                self._validade.off()

    def estado_aguardando(self) -> None:
        # Estado Aguardando: S = 0, V = 0"""
        self._set_pins(s=False, v=False)
        if self._estado_atual != "Aguardando":
            self._estado_atual = "Aguardando"
            logger.info("[FSM State] AGUARDANDO -> S=0, V=0")

    def estado_validando(self) -> None:
        # Estado Validando: S = 1, V = 0
        self._set_pins(s=True, v=False)
        if self._estado_atual != "Validando":
            self._estado_atual = "Validando"
            logger.info("[FSM State] VALIDANDO -> S=1, V=0")

    def estado_aceito(self) -> None:
        # Estado Aceito: S = 1, V = 1
        self._set_pins(s=True, v=True)
        if self._estado_atual != "Aceito":
            self._estado_atual = "Aceito"
            logger.info("[FSM State] ACEITO -> S=1, V=1 (Acesso Liberado)")

    def estado_negado(self) -> None:
        # Estado Negado: S = 1, V = 0
        self._set_pins(s=True, v=False)
        if self._estado_atual != "Negado":
            self._estado_atual = "Negado"
            logger.info("[FSM State] NEGADO -> S=1, V=0 (Acesso Recusado)")

    def obter_estado(self) -> str:
        return self._estado_atual

    def fechar(self) -> None:
        self.estado_aguardando()
        if self._is_hardware and self._strobe and self._validade:
            try:
                self._strobe.close()
                self._validade.close()
            except Exception:
                pass
        logger.info("GPIO finalizado.")


# Instância global para reuso
gpio_controller = ControladorGPIO()
