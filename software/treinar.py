#!/usr/bin/env python3

# Script utilitário para pré-treinar e exportar o modelo LBPH na pasta model/.


import sys
from pathlib import Path

BASE_PATH = Path(__file__).resolve().parent
REC_DIR = BASE_PATH / "reconhecimento_facial"
sys.path.append(str(BASE_PATH))
sys.path.append(str(REC_DIR))

from detector import DetectorFacial
from gerenciador_dataset import GerenciadorDataset
from reconhecedor import ReconhecedorLBPH


def main():
    print("=== SAFE - Treinamento do Modelo Facial ===")
    detector = DetectorFacial()
    reconhecedor = ReconhecedorLBPH()
    gerenciador = GerenciadorDataset(detector)

    rostos, labels, nomes = gerenciador.carregar_dados_treinamento()

    if not rostos or not labels:
        print("[Erro] Nenhum dado facial foi encontrado para treinamento.")
        return

    reconhecedor.treinar(rostos, labels, nomes)
    print(f"Treinamento concluído com sucesso! {len(nomes)} pessoa(s) cadastrada(s).")
    print(f"Arquivos salvos no diretório model/.")


if __name__ == "__main__":
    main()
