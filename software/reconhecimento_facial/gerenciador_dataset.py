"""
Módulo GerenciadorDataset: Carrega imagens de treino locais (dataset/) ou via API HTTP.
"""

from typing import Dict, List, Tuple
import cv2
import numpy as np
import requests

from config import API_URL, DIRETORIO_DATASET
from detector import DetectorFacial


class GerenciadorDataset:
    # Classe responsável por carregar e processar o conjunto de imagens para treinamento.

    def __init__(self, detector: DetectorFacial):
        self.detector = detector

    def carregar_dados_treinamento(
        self,
    ) -> Tuple[List[np.ndarray], List[int], Dict[int, str]]:
        # Carrega amostras locais em dataset/ ou via API caso dataset/ esteja vazio.
        rostos = []
        labels = []
        nomes = {}

        if DIRETORIO_DATASET.exists() and any(DIRETORIO_DATASET.iterdir()):
            print(
                f"[Dataset] Carregando imagens do diretório local: {DIRETORIO_DATASET}"
            )
            id_atual = 1
            for pasta in sorted(DIRETORIO_DATASET.iterdir()):
                if pasta.is_dir():
                    nome_pessoa = pasta.name
                    nomes[id_atual] = nome_pessoa
                    for img_path in pasta.glob("*.[jJ][pP][gG]"):
                        img = cv2.imread(str(img_path), cv2.IMREAD_GRAYSCALE)
                        if img is None:
                            continue
                        caixas = self.detector.detectar_rostos(img)
                        for caixa in caixas:
                            rosto = self.detector.extrair_e_preprocessar_rosto(
                                img, caixa
                            )
                            rostos.append(rosto)
                            labels.append(id_atual)
                    id_atual += 1
        else:
            print(f"[Dataset] Consultando API ({API_URL}) para carregar referências...")
            try:
                res = requests.get(f"{API_URL}/pessoas", timeout=5)
                res.raise_for_status()
                pessoas = res.json()

                for pessoa in pessoas:
                    p_id = pessoa["id"]
                    nomes[p_id] = pessoa["nome"]

                    r_imgs = requests.get(
                        f"{API_URL}/pessoas/{p_id}/imagens", timeout=5
                    )
                    r_imgs.raise_for_status()

                    for meta in r_imgs.json():
                        img_id = meta["id"]
                        r_arq = requests.get(
                            f"{API_URL}/pessoas/{p_id}/imagens/{img_id}/arquivo",
                            timeout=5,
                        )
                        r_arq.raise_for_status()

                        buffer = np.frombuffer(r_arq.content, dtype=np.uint8)
                        img = cv2.imdecode(buffer, cv2.IMREAD_GRAYSCALE)
                        if img is None:
                            continue

                        caixas = self.detector.detectar_rostos(img)
                        for caixa in caixas:
                            rosto = self.detector.extrair_e_preprocessar_rosto(
                                img, caixa
                            )
                            rostos.append(rosto)
                            labels.append(p_id)
            except Exception as e:
                print(f"[Dataset] Aviso: Não foi possível obter dados da API ({e}).")

        return rostos, labels, nomes
