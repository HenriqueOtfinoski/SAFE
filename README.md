# SAFE - Sistema de Acesso Facial Embarcado

Projeto desenvolvido para a disciplina de Projeto Integrador IV - Arquitetura e Organização de Computadores.

---

## API com Docker

Na pasta do projeto:

```bash
cd software
docker compose up -d --build
```

A documentação da API estará disponível em:

```text
http://127.0.0.1:8000/docs
```


## Cadastro facial

Pelo Swagger da API:

1. Cadastre uma pessoa em `POST /pessoas`.
2. Envie uma foto em `POST /pessoas/{pessoa_id}/imagens`.
3. Consulte as imagens em `GET /pessoas/{pessoa_id}/imagens`.

A imagem deve ser JPEG ou PNG, ter no máximo 5 MB e conter apenas um rosto.

## Webcam no Windows

Na pasta `software`:

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
python -m pip install opencv-contrib-python requests
```

Para abrir a câmera e cadastrar uma foto:

```powershell
python .\scripts\webcam.py
```

Pressione `C` para capturar e enviar a imagem. Pressione `Q` para fechar.

## Reconhecimento facial

Com a API em execução:

```powershell
python .\scripts\reconhecimento_facial.py
```

O sistema detecta o rosto, compara com as imagens cadastradas e exige resultados consistentes antes de liberar o acesso. Pressione `Q` para fechar.

## Linux

Para criar e ativar um ambiente virtual:

```bash
cd software
python3 -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
python -m pip install opencv-contrib-python requests
```
