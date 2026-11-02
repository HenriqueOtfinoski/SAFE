# Reconhecimento facial

## Pipeline

O ponto de entrada é `software/reconhecimento_facial/reconhecimento_facial.py`.
Ele usa:

- **OpenCV Haar Cascade** para detectar faces na imagem em tons de cinza.
- **LBPH** (`cv2.face.LBPHFaceRecognizer`) para classificar a face e medir a
  distância em relação às amostras treinadas.
- **Histórico temporal** para reduzir decisões baseadas em uma única imagem:
  mantém até 10 predições e confirma quando a predição atual aparece pelo menos
  `FRAMES_CONFIRMACAO` vezes nesse histórico.

O maior rosto detectado é recortado, redimensionado para 200 × 200 pixels e passa
por equalização de histograma. Se não houver rosto, o sistema limpa o histórico e
volta à FSM para Aguardando. Uma predição desconhecida (ID `-1`) ou sem nome
associado resulta em acesso negado.

`LBPH_THRESHOLD` controla a distância máxima aceita pelo classificador (padrão
`70.0`). Uma distância acima do limite é tratada pelo LBPH como desconhecida.

## De onde vêm as imagens

Na inicialização sem um modelo carregável, o treinamento segue esta ordem:

1. Se `DIRETORIO_DATASET` existir e contiver itens, carrega imagens JPG de suas
   subpastas. O nome da pasta é usado como nome da pessoa.
2. Caso contrário, consulta `API_URL` para listar pessoas, listar as imagens de
   cada pessoa e baixar os arquivos.

O reconhecimento não atualiza automaticamente um modelo já salvo. Para
reconstruí-lo com os dados disponíveis:

```bash
cd software
python treinar.py
```

O script salva `modelo_lbph.xml` e `modelo_lbph_nomes.json` no diretório
`DIRETORIO_MODELO` (padrão `model/`). O reconhecedor também pode salvar esses
arquivos durante o treinamento de inicialização.

## Captura de imagens

Execute `python reconhecimento_facial/webcam.py` a partir de `software/`. Informe
o **ID numérico da pessoa na API**. Pressione `C` para capturar e `Q` para
encerrar. A captura exige exatamente um rosto visível; a imagem é enviada para a
API e salva no dataset local para treinamento offline.

Na API, imagens aceitas são JPEG ou PNG, têm no máximo 5 MB e devem conter
exatamente um rosto. Consulte o [guia da API](../api/README.md) para os endpoints.

## Execução

Com interface gráfica:

```bash
cd software
python reconhecimento_facial/reconhecimento_facial.py
```

Sem janela gráfica:

```bash
cd software
HEADLESS=1 python reconhecimento_facial/reconhecimento_facial.py
```

Os parâmetros da câmera, API, LBPH, diretórios e confirmação estão descritos no
[README do software](../../software/README.md#configuração).
