import sys
from pathlib import Path

# Adiciona pasta raiz e diretório do script ao sys.path
BASE_PATH = Path(__file__).resolve().parent.parent
SCRIPT_DIR = Path(__file__).resolve().parent
sys.path.append(str(BASE_PATH))
sys.path.append(str(SCRIPT_DIR))

import cv2
import requests
from config import (
    API_URL,
    CAMERA_INDEX,
    DIRETORIO_DATASET,
    FRAME_ALTURA,
    FRAME_LARGURA,
)
from detector import DetectorFacial


def main():
    detector = DetectorFacial()

    identificador = input("ID ou Nome da pessoa cadastrada: ").strip()
    if not identificador:
        print("Identificador inválido.")
        return

    url_api = f"{API_URL}/pessoas/{identificador}/imagens"

    camera = cv2.VideoCapture(CAMERA_INDEX)
    camera.set(cv2.CAP_PROP_FRAME_WIDTH, FRAME_LARGURA)
    camera.set(cv2.CAP_PROP_FRAME_HEIGHT, FRAME_ALTURA)

    try:
        if not camera.isOpened():
            raise RuntimeError(f"Não foi possível abrir a câmera (índice {CAMERA_INDEX})")

        print("\nControles:")
        print("  - Pressione 'C' para capturar a foto.")
        print("  - Pressione 'Q' para sair.\n")

        contagem_fotos = 0

        while True:
            sucesso, frame = camera.read()
            if not sucesso:
                print("Não foi possível capturar o frame.")
                break

            imagem_cinza = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
            caixas = detector.detectar_rostos(imagem_cinza)

            frame_original = frame.copy()

            for x, y, w, h in caixas:
                cv2.rectangle(frame, (x, y), (x + w, y + h), (0, 255, 0), 2)

            cv2.imshow("SAFE - Captura de Imagem Facial", frame)
            tecla = cv2.waitKey(1) & 0xFF

            if tecla == ord("q"):
                break

            if tecla == ord("c"):
                if len(caixas) != 1:
                    print("A captura deve conter exatamente UM rosto visível.")
                    continue

                sucesso_enc, imagem_enc = cv2.imencode(".jpg", frame_original)
                if not sucesso_enc:
                    print("Erro ao codificar a imagem.")
                    continue

                # Tenta enviar via API
                try:
                    resposta = requests.post(
                        url_api,
                        files={
                            "arquivo": (
                                "webcam.jpg",
                                imagem_enc.tobytes(),
                                "image/jpeg",
                            )
                        },
                        timeout=3,
                    )
                    if resposta.status_code == 201:
                        print("Foto cadastrada via API:", resposta.json())
                except Exception:
                    pass

                # Salva no diretório local dataset/ para treino offline rápido
                pasta_local = DIRETORIO_DATASET / str(identificador)
                pasta_local.mkdir(parents=True, exist_ok=True)
                contagem_fotos += 1
                caminho_foto_local = pasta_local / f"foto_{contagem_fotos}.jpg"
                caminho_foto_local.write_bytes(imagem_enc.tobytes())
                print(f"Foto salva localmente em: {caminho_foto_local}")

    finally:
        camera.release()
        try:
            cv2.destroyAllWindows()
        except Exception:
            pass


if __name__ == "__main__":
    main()