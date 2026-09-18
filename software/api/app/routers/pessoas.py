from fastapi import (
    APIRouter,
    Depends,
    File,
    HTTPException,
    Query,
    Response,
    status,
    UploadFile,
)
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas.pessoa import (
    PessoaAtualizacao,
    PessoaCriacao,
    PessoaResposta,
)
from app.services import pessoa as pessoa_service
from app.services.pessoa import (
    PessoaDuplicada,
    PessoaNaoEncontrada,
)

from app.schemas.imagem_facial import ImagemFacialResposta
from app.services import imagem_facial as imagem_facial_service
from app.services.imagem_facial import (
    TAMANHO_MAXIMO,
    ImagemFacialInvalida,
    ImagemFacialNaoEncontrada,
    criar_imagem_facial,
)


router = APIRouter(
    prefix="/pessoas",
    tags=["Pessoas"],
)


@router.post(
    "",
    response_model=PessoaResposta,
    status_code=status.HTTP_201_CREATED,
)
def criar_pessoa(
    dados: PessoaCriacao,
    database: Session = Depends(get_db),
):
    try:
        return pessoa_service.criar_pessoa(
            database,
            dados,
        )
    except PessoaDuplicada as erro:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(erro),
        ) from erro


@router.get(
    "",
    response_model=list[PessoaResposta],
)
def listar_pessoas(
    offset: int = Query(default=0, ge=0),
    limite: int = Query(default=100, ge=1, le=100),
    database: Session = Depends(get_db),
):
    return pessoa_service.listar_pessoas(
        database,
        offset,
        limite,
    )


@router.get(
    "/{pessoa_id}",
    response_model=PessoaResposta,
)
def consultar_pessoa(
    pessoa_id: int,
    database: Session = Depends(get_db),
):
    try:
        return pessoa_service.buscar_pessoa(
            database,
            pessoa_id,
        )
    except PessoaNaoEncontrada as erro:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(erro),
        ) from erro


@router.patch(
    "/{pessoa_id}",
    response_model=PessoaResposta,
)
def atualizar_pessoa(
    pessoa_id: int,
    dados: PessoaAtualizacao,
    database: Session = Depends(get_db),
):
    try:
        return pessoa_service.atualizar_pessoa(
            database,
            pessoa_id,
            dados,
        )
    except PessoaNaoEncontrada as erro:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(erro),
        ) from erro
    except PessoaDuplicada as erro:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(erro),
        ) from erro


@router.delete(
    "/{pessoa_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def excluir_pessoa(
    pessoa_id: int,
    database: Session = Depends(get_db),
) -> Response:
    try:
        pessoa_service.excluir_pessoa(
            database,
            pessoa_id,
        )
    except PessoaNaoEncontrada as erro:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(erro),
        ) from erro

    return Response(
        status_code=status.HTTP_204_NO_CONTENT
    )

@router.post(
    "/{pessoa_id}/imagens",
    response_model=ImagemFacialResposta,
    status_code=status.HTTP_201_CREATED,
)
def enviar_imagem_facial(
    pessoa_id: int,
    arquivo: UploadFile = File(...),
    database: Session = Depends(get_db),
):
    try:
        dados = arquivo.file.read(TAMANHO_MAXIMO+1)

        return criar_imagem_facial(
            database,
            pessoa_id,
            dados,
        )
    except PessoaNaoEncontrada as erro:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(erro),
        )from erro
    except ImagemFacialInvalida as erro:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(erro),
        )from erro
    finally:
        arquivo.file.close()


@router.get(
    "/{pessoa_id}/imagens",
    response_model=list[ImagemFacialResposta],
)
def listar_imagens(
    pessoa_id: int,
    database: Session =Depends(get_db),
):
    try:
        return imagem_facial_service.listar_imagens(database, pessoa_id)
    except PessoaNaoEncontrada as erro:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(erro)
        )from erro

@router.get(
    "/{pessoa_id}/imagens/{imagem_id}/arquivo",
    responses={
        200: {
            "content": {
                "image/jpeg": {},
                "image/png": {},
            },
            "description": "Arquivo da imagem facial.",
        }
    },
)
def importar_imagem(
    pessoa_id: int,
    imagem_id: int,
    database: Session = Depends(get_db),
) -> Response:

    try:
        imagem = imagem_facial_service.buscar_imagens(
            database,
            pessoa_id,
            imagem_id,
        )
    except(
        PessoaNaoEncontrada,
        ImagemFacialNaoEncontrada,
    ) as erro: 
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(erro)
        )from erro

    return Response(
        content=imagem.dados,
        media_type=imagem.tipo_mime,
        headers={
            "Content-Disposition":(
                f'inline; filename="imagem-{imagem.id}"'
            )
        },
    )