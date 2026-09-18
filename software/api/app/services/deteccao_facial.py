import cv2
import numpy as np

from pathlib import Path

class ErroDeteccaoFacial(ValueError):
    pass

def detectar_rostos(
    dados: bytes,
) -> list[tuple[int, int, int, int]]:
    if not dados: 
        raise ErroDeteccaoFacial("O arquivo esta vazio")

    buffer = np.frombuffer(dados,dtype=np.uint8)

    try:
        imagem = cv2.imdecode(buffer,cv2.IMREAD_GRAYSCALE)
    except cv2.error as erro:
        raise ErroDeteccaoFacial(
            "Nao foi possivel ler a imagem"
        ) from erro

    if imagem is None:
        raise ErroDeteccaoFacial(
            "O arquivo nao contem uma imagem valida"
        )

    caminho = (
        Path(__file__).resolve().parent.parent
        / "assets"
        / "haarcascade_frontalface_default.xml"
    )
    detector = cv2.CascadeClassifier(str(caminho))

    if detector.empty():
        raise RuntimeError(
            "Nao foi possivel carregar o detector de srostos"
        )

    rostos = detector.detectMultiScale(
        imagem,
        scaleFactor=1.1,
        minNeighbors=5,
        minSize=(30,30),
    )

    return [
        (int(x), int (y), int(largura), int(altura))
        for x,y,largura,altura in rostos
    ]