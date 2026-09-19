"""
Módulo ReconhecedorLBPH: Encapsula o treinamento, persistência (em model/) e predição LBPH.
"""

import json
from typing import Dict, List, Tuple
import cv2
import numpy as np

from config import (
    CAMINHO_MODELO_NOMES,
    CAMINHO_MODELO_XML,
    LBPH_THRESHOLD,
)


class ReconhecedorLBPH:
    # Classe responsável pelo treinamento, predição e salvamento/carregamento do modelo LBPH.

    def __init__(self, threshold: float = LBPH_THRESHOLD):
        self.threshold = threshold
        self.nomes: Dict[int, str] = {}
        self._recognizer = cv2.face.LBPHFaceRecognizer_create(
            radius=1, neighbors=8, grid_x=8, grid_y=8, threshold=self.threshold
        )

    def treinar(
        self,
        rostos: List[np.ndarray],
        identificadores: List[int],
        mapa_nomes: Dict[int, str],
    ) -> None:
        # Treina o modelo LBPH e atualiza a tabela de nomes.
        if not rostos or not identificadores:
            raise ValueError("Não há dados suficientes para treinamento.")

        self._recognizer.train(rostos, np.array(identificadores, dtype=np.int32))
        self.nomes = mapa_nomes
        self.salvar_modelo()

    def salvar_modelo(self) -> None:
        # Salva o modelo XML e o mapeamento de nomes JSON na pasta model/.
        self._recognizer.write(str(CAMINHO_MODELO_XML))
        with open(CAMINHO_MODELO_NOMES, "w", encoding="utf-8") as f:
            json.dump(
                {str(k): v for k, v in self.nomes.items()},
                f,
                ensure_ascii=False,
                indent=2,
            )
        print(f"[Model] Modelo salvo com sucesso em: {CAMINHO_MODELO_XML}")

    def carregar_modelo(self) -> bool:
        # Carrega o modelo pré-treinado da pasta model/, se existente.
        if CAMINHO_MODELO_XML.exists() and CAMINHO_MODELO_NOMES.exists():
            try:
                self._recognizer.read(str(CAMINHO_MODELO_XML))
                with open(CAMINHO_MODELO_NOMES, "r", encoding="utf-8") as f:
                    nomes_raw = json.load(f)
                    self.nomes = {int(k): v for k, v in nomes_raw.items()}
                print(
                    f"[Model] Modelo LBPH pré-treinado carregado de: {CAMINHO_MODELO_XML.name}"
                )
                return True
            except Exception as e:
                print(f"[Model] Erro ao carregar modelo salvo ({e}).")
        return False

    def predizer(self, rosto_imagem: np.ndarray) -> Tuple[int, float]:
        """
        Retorna (pessoa_id, distancia).
        Se a distância for maior que threshold ou não reconhecido, pessoa_id retorna -1.
        """
        pessoa_id, distancia = self._recognizer.predict(rosto_imagem)
        return pessoa_id, distancia
