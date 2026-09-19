import sys
import numpy as np
from pathlib import Path

# Adiciona pasta raiz e diretório de reconhecimento ao sys.path
BASE_PATH = Path(__file__).resolve().parent.parent
REC_DIR = BASE_PATH / "reconhecimento_facial"
sys.path.append(str(BASE_PATH))
sys.path.append(str(REC_DIR))

from config import CAMINHO_MODELO_NOMES, CAMINHO_MODELO_XML, DIRETORIO_MODELO
from detector import DetectorFacial
from reconhecedor import ReconhecedorLBPH


def test_detector_e_reconhecedor_modelos():
    print("Testando DetectorFacial e ReconhecedorLBPH...")

    detector = DetectorFacial()
    assert detector is not None

    reconhecedor = ReconhecedorLBPH(threshold=75.0)

    # Imagens sintéticas de teste (200x200 grayscale)
    rosto1 = np.ones((200, 200), dtype=np.uint8) * 100
    rosto2 = np.ones((200, 200), dtype=np.uint8) * 150

    rostos = [rosto1, rosto2]
    labels = [1, 2]
    mapa_nomes = {1: "Alice", 2: "Bob"}

    reconhecedor.treinar(rostos, labels, mapa_nomes)

    # Verifica se os arquivos foram salvos na pasta model/
    assert CAMINHO_MODELO_XML.exists()
    assert CAMINHO_MODELO_NOMES.exists()
    assert CAMINHO_MODELO_XML.parent == DIRETORIO_MODELO

    # Testa recarregamento
    novo_reconhecedor = ReconhecedorLBPH()
    sucesso = novo_reconhecedor.carregar_modelo()
    assert sucesso is True
    assert novo_reconhecedor.nomes.get(1) == "Alice"
    assert novo_reconhecedor.nomes.get(2) == "Bob"

    print("Testes dos modelos concluídos com sucesso!")


if __name__ == "__main__":
    test_detector_e_reconhecedor_modelos()
