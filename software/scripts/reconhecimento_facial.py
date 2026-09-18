import cv2
import numpy as np
import requests

from pathlib import Path

from collections import deque

from controle_acesso import liberar_acesso

API_URL = "http://127.0.0.1:8000"
TAMANHO_ROSTO = (200, 200)


def criar_detector():
    caminho = (
        Path(__file__).resolve().parent.parent
        / "api"
        / "app"
        / "assets"
        / "haarcascade_frontalface_default.xml"
    )

    detector = cv2.CascadeClassifier(str(caminho))

    if detector.empty():
        raise RuntimeError("Não foi possível carregar o detector.")

    return detector


def carregar_referencias(detector):
    pessoas = requests.get(
        f"{API_URL}/pessoas",
        timeout=10,
    )
    pessoas.raise_for_status()

    rostos_treinamento = []
    identificadores = []
    nomes = {}

    for pessoa in pessoas.json():
        pessoa_id = pessoa["id"]
        nomes[pessoa_id] = pessoa["nome"]

        resposta = requests.get(
            f"{API_URL}/pessoas/{pessoa_id}/imagens",
            timeout=10,
        )
        resposta.raise_for_status()

        for metadados in resposta.json():
            imagem_id = metadados["id"]

            arquivo = requests.get(
                (
                    f"{API_URL}/pessoas/{pessoa_id}"
                    f"/imagens/{imagem_id}/arquivo"
                ),
                timeout=10,
            )
            arquivo.raise_for_status()

            buffer = np.frombuffer(
                arquivo.content,
                dtype=np.uint8,
            )
            imagem = cv2.imdecode(
                buffer,
                cv2.IMREAD_GRAYSCALE,
            )

            if imagem is None:
                continue

            rostos = detector.detectMultiScale(
                imagem,
                scaleFactor=1.1,
                minNeighbors=5,
                minSize=(30, 30),
            )

            if len(rostos) != 1:
                continue

            x, y, largura, altura = rostos[0]
            rosto = imagem[
                y:y + altura,
                x:x + largura,
            ]
            rosto = cv2.resize(rosto, TAMANHO_ROSTO)
            rosto = cv2.equalizeHist(rosto)

            rostos_treinamento.append(rosto)
            identificadores.append(pessoa_id)

    if not rostos_treinamento:
        raise RuntimeError(
            "Nenhuma imagem facial válida foi encontrada."
        )

    reconhecedor = cv2.face.LBPHFaceRecognizer_create(
        radius=1,
        neighbors=8,
        grid_x=8,
        grid_y=8,
        threshold=70,
    )

    reconhecedor.train(
        rostos_treinamento,
        np.array(identificadores, dtype=np.int32),
    )

    print(
        f"Treinamento concluído com "
        f"{len(rostos_treinamento)} imagem(ns)."
    )

    return reconhecedor, nomes

def main():
    detector = criar_detector()
    reconhecedor, nomes = carregar_referencias(detector)
    historico = deque(maxlen=10)
    ultimo_confirmado = None

    camera = cv2.VideoCapture(0)

    if not camera.isOpened():
        raise RuntimeError("Não foi possível abrir a webcam.")

    try:
        while True:
            sucesso, frame = camera.read()

            if not sucesso:
                print("Não foi possível capturar o frame.")
                break

            imagem_cinza = cv2.cvtColor(
                frame,
                cv2.COLOR_BGR2GRAY,
            )

            rostos = detector.detectMultiScale(
                imagem_cinza,
                scaleFactor=1.1,
                minNeighbors=5,
                minSize=(30, 30),
            )

            if len(rostos) != 1:
                historico.clear()
                ultimo_confirmado = None

            for x, y, largura, altura in (
                rostos if len(rostos) == 1 else []
            ):
                rosto = imagem_cinza[
                    y:y + altura,
                    x:x + largura,
                ]
                rosto = cv2.resize(
                    rosto,
                    TAMANHO_ROSTO,
                )

                rosto = cv2.equalizeHist(rosto)

                pessoa_id, distancia = reconhecedor.predict(
                    rosto
                )

                historico.append(pessoa_id)
                ocorrencias = historico.count(pessoa_id)
                confirmado = (
                    pessoa_id != -1
                    and pessoa_id in nomes
                    and ocorrencias >= 7
                )

                if confirmado:
                    texto = (
                        f"Acesso permitido: {nomes[pessoa_id]} "
                        f"({distancia:.1f})"
                    )
                    cor = (0, 255, 0)

                    if ultimo_confirmado != pessoa_id:
                        print("Pessoa reconhecida:", nomes[pessoa_id])
                        liberar_acesso(nomes[pessoa_id])
                        ultimo_confirmado = pessoa_id
                elif pessoa_id == -1:
                    texto = "Nao reconhecido"
                    cor = (0, 0, 255)
                    ultimo_confirmado = None
                else:
                    texto = "Validando..."
                    cor = (0, 255, 255)

                cv2.rectangle(
                    frame,
                    (x, y),
                    (x + largura, y + altura),
                    cor,
                    2,
                )

                cv2.putText(
                    frame,
                    texto,
                    (x, max(y - 10, 20)),
                    cv2.FONT_HERSHEY_SIMPLEX,
                    0.7,
                    cor,
                    2,
                )

            cv2.imshow(
                "SAFE - Reconhecimento facial",
                frame,
            )

            tecla = cv2.waitKey(1) & 0xFF

            if tecla == ord("q"):
                break
    finally:
        camera.release()
        cv2.destroyAllWindows()


if __name__ == "__main__":
    main()