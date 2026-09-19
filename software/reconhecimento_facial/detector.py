"""
Módulo DetectorFacial: Encapsula a detecção e pré-processamento de rostos via Haar Cascade.
"""

from typing import List, Tuple
import cv2
import numpy as np

from config import CAMINHO_HAAR, TAMANHO_ROSTO


class DetectorFacial:
    # Classe responsável por detectar e pré-processar rostos em imagens.

    def __init__(self, caminho_haar=CAMINHO_HAAR):
        self.caminho_haar = caminho_haar
        self._classifier = self._carregar_classificador()

    def _carregar_classificador(self) -> cv2.CascadeClassifier:
        if not self.caminho_haar.exists():
            raise RuntimeError(
                f"Arquivo Haar Cascade não encontrado em: {self.caminho_haar}"
            )

        classifier = cv2.CascadeClassifier(str(self.caminho_haar))
        if classifier.empty():
            raise RuntimeError(
                "Não foi possível carregar o classificador Haar Cascade."
            )
        return classifier

    def detectar_rostos(
        self,
        imagem_cinza: np.ndarray,
        scale_factor: float = 1.1,
        min_neighbors: int = 5,
    ) -> List[Tuple[int, int, int, int]]:
        # Detecta retângulos contendo rostos na imagem em tons de cinza.
        rostos = self._classifier.detectMultiScale(
            imagem_cinza,
            scaleFactor=scale_factor,
            minNeighbors=min_neighbors,
            minSize=(30, 30),
        )
        return list(rostos)

    def extrair_e_preprocessar_rosto(
        self, imagem_cinza: np.ndarray, caixa: Tuple[int, int, int, int]
    ) -> np.ndarray:
        # Recorta, redimensiona para 200x200 e equaliza o histograma do rosto.
        x, y, w, h = caixa
        rosto = imagem_cinza[y : y + h, x : x + w]
        rosto = cv2.resize(rosto, TAMANHO_ROSTO)
        rosto = cv2.equalizeHist(rosto)
        return rosto
