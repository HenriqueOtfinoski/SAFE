import cv2
import requests

from pathlib import Path

def main():
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


    pessoa_id = int(input("ID da pessoa cadastrada: "))
    url = f"http://127.0.0.1:8000/pessoas/{pessoa_id}/imagens"


    camera = cv2.VideoCapture(0)

    try:
        if not camera.isOpened():
            raise RuntimeError("nao foi possivel abrir a webcam")

        while True:
            sucesso, frame = camera.read()

            if not sucesso:
                print("Nao foi possivel capturar o frame")
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

            frame_original = frame.copy()

            for x, y, largura, altura in rostos:
                cv2.rectangle(
                    frame,
                    (x, y),
                    (x + largura, y + altura),
                    (0, 255, 0),
                    2,
                )

            cv2.imshow("SAFE - Webcam", frame)

            tecla = cv2.waitKey(1) & 0xFF

            if tecla == ord("q"):
                break

            if tecla == ord("c"):
                if len(rostos) != 1:
                    print("A captura deve conter exatamente um rosto.")
                    continue

                sucesso, imagem = cv2.imencode(
                    ".jpg",
                    frame_original,
                )

                if not sucesso:
                    print("Não foi possível gerar a foto.")
                    continue

                try:
                    resposta = requests.post(
                        url,
                        files={
                            "arquivo": (
                                "webcam.jpg",
                                imagem.tobytes(),
                                "image/jpeg",
                            )
                        },
                        timeout=10,
                    )

                    if resposta.status_code == 201:
                        print("Foto cadastrada:", resposta.json())
                    else:
                        print(
                            "Erro no upload:",
                            resposta.status_code,
                            resposta.text,
                        )
                except requests.RequestException as erro:
                    print("Não foi possível acessar a API:", erro)

    finally:
        camera.release()
        cv2.destroyAllWindows()

if __name__ == "__main__":
    main()