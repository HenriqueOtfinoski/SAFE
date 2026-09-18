import cv2
import numpy as np

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.imagem_facial import ImagemFacial
from app.services.deteccao_facial import detectar_rostos
from app.services.pessoa import buscar_pessoa

TAMANHO_MAXIMO = 5 * 1024 * 1024

class ImagemFacialInvalida(ValueError):
    pass

class ImagemFacialNaoEncontrada(Exception):
    pass


def validar_imagem(dados: bytes) -> tuple[str, int, int]:
    if not dados:
        raise ImagemFacialInvalida("O arquivo esta vazio")

    if len(dados) > TAMANHO_MAXIMO:
        raise ImagemFacialInvalida(
            "A imagem deve ter no maximo 5 MB."
        )

    if dados.startswith(b"\xff\xd8\xff"):
        tipo_mime = "image/jpeg"
    elif dados.startswith(b"\x89PNG\r\n\x1a\n"):
        tipo_mime = "image/png"
    else:
        raise ImagemFacialInvalida(
            "Formato invalido. Envie uma imagem JPGEG ou PNG"
        )

    buffer = np.frombuffer(dados, dtype=np.uint8)

    try:
        imagem = cv2.imdecode(buffer, cv2.IMREAD_COLOR)
    except cv2.error as erro:
        raise ImagemFacialInvalida(
            "Nao foi possivel ler a imagem"
        ) from erro

    if imagem is None:
        raise ImagemFacialInvalida(
            "O arquivo nao contem uma imagem valida"
        )

    altura, largura = imagem.shape[:2]

    return tipo_mime, largura, altura


def criar_imagem_facial(
    database:Session,
    pessoa_id: int,
    dados: bytes,
) -> ImagemFacial:
    pessoa = buscar_pessoa(database, pessoa_id)

    tipo_mime, largura, altura = validar_imagem(dados)

    rostos = detectar_rostos(dados)

    if not rostos:
        raise ImagemFacialInvalida(
            "Nenhum rosto foi detectado, envie outra foto"
        )

    if len(rostos) >1:
        raise ImagemFacialInvalida(
            "A imagem deve conter apenas um rosto"
        )



    imagem = ImagemFacial(
        pessoa_id= pessoa.id,
        dados=dados,
        tipo_mime=tipo_mime,
        largura=largura,
        altura=altura,
    )

    database.add(imagem)

    try:
        database.commit()
    except Exception:
        database.rollback()
        raise

    database.refresh(imagem)

    return imagem

def listar_imagens(
    database:Session,
    pessoa_id: int,
) -> list[ImagemFacial]:
    buscar_pessoa(database, pessoa_id)

    consulta =(
        select(ImagemFacial)
        .where(ImagemFacial.pessoa_id == pessoa_id)
        .order_by(ImagemFacial.id)
    )

    return list(database.scalars(consulta).all())


def buscar_imagens(
    database: Session,
    pessoa_id: int,
    imagem_id: int,
) -> ImagemFacial: 
    buscar_pessoa(database, pessoa_id)

    consulta = select(ImagemFacial).where(
        ImagemFacial.id == imagem_id,
        ImagemFacial.pessoa_id == pessoa_id,
    )
    imagem = database.scalar(consulta)

    if imagem is None:
        raise ImagemFacialNaoEncontrada(
            "Imagem facial nao encontrada"
        )

    return imagem
