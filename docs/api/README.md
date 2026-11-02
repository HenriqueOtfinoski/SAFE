# API e persistência

A API é uma aplicação FastAPI definida em `software/api/app/main.py`. Ela fornece
cadastro de pessoas e armazenamento de imagens faciais em SQLite por meio do
SQLAlchemy. Os modelos de dados são criados e atualizados por migrações Alembic.

## Executar

A partir de `software/`, com as dependências instaladas:

```bash
cd api
python -m alembic upgrade head
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Explore e teste os contratos em `http://localhost:8000/docs`. Para iniciar a API
em Docker, use `docker compose up --build`; a imagem aplica as migrações antes de
iniciar o servidor.

Por padrão, o banco local fica em `software/api/safe.sqlite3`. Configure
`DATABASE_URL` para usar outro banco. No Compose, o banco fica em
`/app/data/safe.sqlite3`, persistido no volume `safe_data`.

## Endpoints

| Método | Caminho | Descrição |
| --- | --- | --- |
| `GET` | `/health` | Verifica se a API está respondendo |
| `GET` | `/health/database` | Verifica a conexão com o banco |
| `POST` | `/pessoas` | Cadastra uma pessoa; retorna `201` |
| `GET` | `/pessoas?offset=0&limite=100` | Lista pessoas com paginação |
| `GET` | `/pessoas/{pessoa_id}` | Consulta uma pessoa |
| `PATCH` | `/pessoas/{pessoa_id}` | Atualiza os campos informados |
| `DELETE` | `/pessoas/{pessoa_id}` | Exclui uma pessoa e suas imagens; retorna `204` |
| `POST` | `/pessoas/{pessoa_id}/imagens` | Envia imagem no campo multipart `arquivo`; retorna `201` |
| `GET` | `/pessoas/{pessoa_id}/imagens` | Lista metadados das imagens da pessoa |
| `GET` | `/pessoas/{pessoa_id}/imagens/{imagem_id}/arquivo` | Retorna os bytes da imagem |

## Dados e validação

Uma pessoa possui `id`, `nome`, `identificador`, `data_nascimento` opcional,
`email` opcional e `data_registro`. Nome e identificador são obrigatórios; o
identificador e o email são únicos. Emails são normalizados para minúsculas e
validados. A data de nascimento não pode estar no futuro.

As imagens são associadas à pessoa e guardam bytes, tipo MIME, largura, altura e
data de registro. O upload aceita JPEG e PNG até 5 MB e exige uma imagem legível
com exatamente um rosto detectado. A exclusão da pessoa remove suas imagens
associadas.

Erros comuns: `404` para pessoa ou imagem inexistente, `409` para identificador
ou email duplicado, `400` para imagem inválida e `503` quando o banco não está
disponível no endpoint de health check.

## Integração com o reconhecedor

O reconhecedor usa `API_URL` para listar pessoas e fotos quando treina a partir da
API. O cadastro sozinho não modifica um modelo LBPH existente. Após adicionar
imagens, execute `python treinar.py` no diretório `software/` para exportar um
modelo atualizado.
