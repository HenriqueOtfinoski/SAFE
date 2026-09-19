import json
import os
import sys
import time
from collections import deque
from pathlib import Path

import cv2
import numpy as np

# Adiciona pasta raiz e pasta do script ao sys.path
BASE_PATH = Path(__file__).resolve().parent.parent
SCRIPT_DIR = Path(__file__).resolve().parent
sys.path.append(str(BASE_PATH))
sys.path.append(str(SCRIPT_DIR))

import requests
from config import (
    API_URL,
    CAMINHO_HAAR,
    CAMINHO_MODELO,
    CAMERA_INDEX,
    DIRETORIO_DATASET,
    DURACAO_STROBE,
    FRAME_ALTURA,
    FRAME_LARGURA,
    FRAMES_CONFIRMACAO,
    HEADLESS,
    LBPH_THRESHOLD,
    TAMANHO_ROSTO,
)
from controle_acesso import liberar_acesso, recusar_acesso
from controle_gpio import gpio_controller

CAMINHO_NOMES_JSON = BASE_PATH / "modelo_lbph_nomes.json"


def criar_detector():
    # Carrega o detector Haar Cascade.
    if not CAMINHO_HAAR.exists():
        raise RuntimeError(f"Arquivo Haar Cascade não encontrado em: {CAMINHO_HAAR}")

    detector = cv2.CascadeClassifier(str(CAMINHO_HAAR))
    if detector.empty():
        raise RuntimeError("Não foi possível carregar o detector Haar Cascade.")

    return detector


def treinar_modelo(detector):
    """
    Treina o reconhecedor LBPH a partir da API ou do diretório local dataset/.
    Salva o modelo em arquivo para carregamento rápido nas próximas execuções.
    """
    rostos_treinamento = []
    identificadores = []
    nomes = {}

    # Tenta carregar do diretório local dataset/ primeiro, ou da API HTTP
    if DIRETORIO_DATASET.exists() and any(DIRETORIO_DATASET.iterdir()):
        print(f"Treinando modelo a partir do diretório local: {DIRETORIO_DATASET}")
        id_atual = 1
        for pasta_pessoa in DIRETORIO_DATASET.iterdir():
            if pasta_pessoa.is_dir():
                nome_pessoa = pasta_pessoa.name
                nomes[id_atual] = nome_pessoa
                for img_path in pasta_pessoa.glob("*.[jJ][pP][gG]"):
                    imagem = cv2.imread(str(img_path), cv2.IMREAD_GRAYSCALE)
                    if imagem is None:
                        continue
                    rostos = detector.detectMultiScale(
                        imagem, scaleFactor=1.1, minNeighbors=5, minSize=(30, 30)
                    )
                    for x, y, w, h in rostos:
                        rosto = cv2.resize(imagem[y : y + h, x : x + w], TAMANHO_ROSTO)
                        rosto = cv2.equalizeHist(rosto)
                        rostos_treinamento.append(rosto)
                        identificadores.append(id_atual)
                id_atual += 1
    else:
        print(f"Conectando à API ({API_URL}) para carregar referências...")
        try:
            res = requests.get(f"{API_URL}/pessoas", timeout=5)
            res.raise_for_status()
            pessoas = res.json()

            for pessoa in pessoas:
                pessoa_id = pessoa["id"]
                nomes[pessoa_id] = pessoa["nome"]

                r_imgs = requests.get(
                    f"{API_URL}/pessoas/{pessoa_id}/imagens", timeout=5
                )
                r_imgs.raise_for_status()

                for metadados in r_imgs.json():
                    img_id = metadados["id"]
                    r_arq = requests.get(
                        f"{API_URL}/pessoas/{pessoa_id}/imagens/{img_id}/arquivo",
                        timeout=5,
                    )
                    r_arq.raise_for_status()

                    buffer = np.frombuffer(r_arq.content, dtype=np.uint8)
                    imagem = cv2.imdecode(buffer, cv2.IMREAD_GRAYSCALE)
                    if imagem is None:
                        continue

                    rostos = detector.detectMultiScale(
                        imagem, scaleFactor=1.1, minNeighbors=5, minSize=(30, 30)
                    )
                    for x, y, w, h in rostos:
                        rosto = cv2.resize(imagem[y : y + h, x : x + w], TAMANHO_ROSTO)
                        rosto = cv2.equalizeHist(rosto)
                        rostos_treinamento.append(rosto)
                        identificadores.append(pessoa_id)
        except Exception as e:
            print(f"Aviso: Não foi possível obter dados da API ({e}).")

    if not rostos_treinamento:
        print(
            "Nenhuma imagem de referência válida encontrada. Criando reconhecedor vazio."
        )
        reconhecedor = cv2.face.LBPHFaceRecognizer_create()
        return reconhecedor, {}

    reconhecedor = cv2.face.LBPHFaceRecognizer_create(
        radius=1, neighbors=8, grid_x=8, grid_y=8, threshold=LBPH_THRESHOLD
    )
    reconhecedor.train(rostos_treinamento, np.array(identificadores, dtype=np.int32))

    # Salva o modelo para inicializações instantâneas no Raspberry Pi
    try:
        reconhecedor.write(str(CAMINHO_MODELO))
        with open(CAMINHO_NOMES_JSON, "w", encoding="utf-8") as f:
            json.dump({str(k): v for k, v in nomes.items()}, f)
        print(f"Modelo salvo em {CAMINHO_MODELO}")
    except Exception as e:
        print(f"Erro ao salvar arquivo de modelo: {e}")

    return reconhecedor, nomes


def carregar_reconhecedor(detector):
    """Carrega o modelo LBPH salvo ou executa o treinamento."""
    reconhecedor = cv2.face.LBPHFaceRecognizer_create(
        radius=1, neighbors=8, grid_x=8, grid_y=8, threshold=LBPH_THRESHOLD
    )

    if CAMINHO_MODELO.exists() and CAMINHO_NOMES_JSON.exists():
        try:
            reconhecedor.read(str(CAMINHO_MODELO))
            with open(CAMINHO_NOMES_JSON, "r", encoding="utf-8") as f:
                nomes_raw = json.load(f)
                nomes = {int(k): v for k, v in nomes_raw.items()}
            print(
                f"Modelo LBPH pré-treinado carregado com sucesso de {CAMINHO_MODELO.name}"
            )
            return reconhecedor, nomes
        except Exception as e:
            print(f"Falha ao carregar modelo salvo ({e}). Re-treinando...")

    return treinar_modelo(detector)


def main():
    detector = criar_detector()
    reconhecedor, nomes = carregar_reconhecedor(detector)

    historico = deque(maxlen=10)
    cooldown_ate = 0.0

    camera = cv2.VideoCapture(CAMERA_INDEX)
    camera.set(cv2.CAP_PROP_FRAME_WIDTH, FRAME_LARGURA)
    camera.set(cv2.CAP_PROP_FRAME_HEIGHT, FRAME_ALTURA)

    if not camera.isOpened():
        raise RuntimeError(f"Não foi possível abrir a câmera (índice {CAMERA_INDEX}).")

    print(f"\nSistema SAFE Inicializado (Raspberry Pi 5 Ready)")
    print(
        f"Controle GPIO Ativo (Strobe S: GPIO{gpio_controller.pin_strobe_num}, Validade V: GPIO{gpio_controller.pin_validade_num})"
    )
    print("Pressione 'Q' para encerrar.\n")

    try:
        while True:
            sucesso, frame = camera.read()
            if not sucesso:
                print("Erro na captura de frame da câmera.")
                time.sleep(0.1)
                continue

            agora = time.time()
            if agora < cooldown_ate:
                # Durante o cooldown pós validação, mantém visualização e aguarda
                if not HEADLESS:
                    cv2.imshow("SAFE - Reconhecimento Facial (RPi 5)", frame)
                    if cv2.waitKey(1) & 0xFF == ord("q"):
                        break
                continue

            imagem_cinza = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
            rostos = detector.detectMultiScale(
                imagem_cinza, scaleFactor=1.1, minNeighbors=5, minSize=(40, 40)
            )

            if len(rostos) == 0:
                gpio_controller.estado_aguardando()
                historico.clear()
            else:
                # Rosto detectado -> Muda FSM para Validando (S=1, V=0)
                gpio_controller.estado_validando()

                # Processa o maior rosto detectado
                rostos_ordenados = sorted(
                    rostos, key=lambda r: r[2] * r[3], reverse=True
                )
                x, y, largura, altura = rostos_ordenados[0]

                rosto = imagem_cinza[y : y + altura, x : x + largura]
                rosto = cv2.resize(rosto, TAMANHO_ROSTO)
                rosto = cv2.equalizeHist(rosto)

                pessoa_id, distancia = reconhecedor.predict(rosto)
                historico.append(pessoa_id)

                ocorrencias = historico.count(pessoa_id)
                cor = (0, 255, 255)  # Amarelo (Validando)
                texto = "Validando..."

                if ocorrencias >= FRAMES_CONFIRMACAO:
                    if pessoa_id != -1 and pessoa_id in nomes:
                        nome_reconhecido = nomes[pessoa_id]
                        texto = f"Acesso Permitido: {nome_reconhecido}"
                        cor = (0, 255, 0)
                        liberar_acesso(nome_reconhecido)
                    else:
                        texto = "Acesso Negado"
                        cor = (0, 0, 255)
                        recusar_acesso()

                    historico.clear()
                    cooldown_ate = time.time() + DURACAO_STROBE

                if not HEADLESS:
                    cv2.rectangle(frame, (x, y), (x + largura, y + altura), cor, 2)
                    cv2.putText(
                        frame,
                        texto,
                        (x, max(y - 10, 20)),
                        cv2.FONT_HERSHEY_SIMPLEX,
                        0.7,
                        cor,
                        2,
                    )

            if not HEADLESS:
                try:
                    cv2.imshow("SAFE - Reconhecimento Facial (RPi 5)", frame)
                    if cv2.waitKey(1) & 0xFF == ord("q"):
                        break
                except Exception:
                    # Se falhar a exibição GUI (ex: servidor headless), alterna para HEADLESS
                    pass

    finally:
        camera.release()
        try:
            cv2.destroyAllWindows()
        except Exception:
            pass
        gpio_controller.fechar()


if __name__ == "__main__":
    main()
