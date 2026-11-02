# Funcionamento e arquitetura

## Componentes

O software está em `software/` e possui dois processos que podem funcionar juntos:

- **API** (`software/api/`): aplicação FastAPI que cadastra pessoas e guarda
  imagens faciais em SQLite.
- **Reconhecedor** (`software/reconhecimento_facial/`): processo Python com
  OpenCV que captura vídeo, detecta rostos, classifica imagens com LBPH e aciona
  o controlador GPIO.

O treinamento pode usar imagens locais no diretório `software/dataset/` ou imagens
fornecidas pela API. O modelo exportado fica em `software/model/`. Os diagramas
de arquitetura e da FSM estão em [`../diagramas/`](../diagramas/).

## Fluxo de execução

1. Inicie a API para permitir cadastros e consultas. Ela usa a configuração
   `DATABASE_URL`; sem essa variável, usa `software/api/safe.sqlite3`.
2. Inicie o reconhecimento facial. O programa abre o classificador Haar Cascade
   incluído em `software/api/app/assets/`.
3. Primeiro, tenta carregar `modelo_lbph.xml` e `modelo_lbph_nomes.json` do
   diretório configurado em `DIRETORIO_MODELO`.
4. Se os arquivos do modelo não puderem ser carregados, coleta imagens do
   `DIRETORIO_DATASET`, quando não vazio; caso contrário, consulta a API em
   `API_URL` para obter as pessoas e suas fotos.
5. A câmera fornece frames. O detector Haar localiza os rostos e o maior rosto
   é redimensionado para 200 × 200 pixels e equalizado antes da classificação LBPH.
6. O sistema acumula os resultados em um histórico de até 10 detecções. Quando
   uma identificação aparece pelo menos `FRAMES_CONFIRMACAO` vezes, ela é aceita
   se o LBPH não a classificou como desconhecida e houver um nome associado;
   caso contrário, o acesso é negado.
7. O controlador GPIO sinaliza o resultado à FSM. A câmera continua sendo
   processada após o intervalo `DURACAO_STROBE`.

Se nenhum rosto for detectado, o sistema retorna à condição Aguardando e limpa o
histórico. `HEADLESS=1` desativa a janela de vídeo, mas não desativa a captura da
câmera nem o reconhecimento.

## Executar localmente

A partir de `software/`, instale as dependências conforme o
[guia principal](../../software/README.md). A API e o reconhecedor são processos
separados:

```bash
cd api
python -m alembic upgrade head
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000
```

Em outro terminal:

```bash
python reconhecimento_facial/reconhecimento_facial.py
```

Para execução sem interface gráfica, defina `HEADLESS=1` no ambiente. Para
desligar os processos, use `Ctrl+C`; o reconhecedor libera os recursos da câmera
e retorna os sinais GPIO para Aguardando.

## Persistência e atualização do modelo

- A API mantém os cadastros e bytes das imagens no banco de dados.
- O Compose persiste o banco em um volume Docker chamado `safe_data`.
- Imagens locais são armazenadas em pastas dentro de `dataset/`, agrupadas pelo
  identificador usado na captura.
- Um modelo existente é carregado diretamente no início; novos cadastros não
  atualizam esse modelo automaticamente. Execute `python treinar.py` após incluir
  ou alterar imagens.
- Quando o dataset local não está vazio, ele tem prioridade sobre a API durante
  o treinamento. Use um dataset local vazio para treinar usando os dados da API.

Mais detalhes por componente: [API](../api/README.md),
[reconhecimento facial](../reconhecimento-facial/README.md) e
[GPIO/FSM](../hardware/README.md).
