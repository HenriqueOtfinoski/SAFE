from fastapi.testclient import TestClient


def test_raiz_redireciona_para_painel(client: TestClient):
    resposta = client.get("/", follow_redirects=False)

    assert resposta.status_code in (302, 307)
    assert resposta.headers["location"] == "/painel"


def test_painel_serve_index_modular(client: TestClient):
    resposta = client.get("/painel/")

    assert resposta.status_code == 200
    assert 'type="module"' in resposta.text
    assert 'src="js/app.js"' in resposta.text


def test_painel_recursos(client: TestClient):
    for caminho in ("/painel/js/app.js", "/painel/style.css"):
        resposta = client.get(caminho)
        assert resposta.status_code == 200, caminho


def test_painel_three_local(client: TestClient):
    resposta = client.get("/painel/vendor/three.module.min.js")

    assert resposta.status_code == 200
    assert len(resposta.content) > 300_000


def test_painel_index_tem_cena(client: TestClient):
    resposta = client.get("/painel/")

    assert resposta.status_code == 200
    assert 'id="cena"' in resposta.text
    assert '"three": "./vendor/three.module.min.js"' in resposta.text
    assert "unpkg.com" not in resposta.text
    assert "getlayers" not in resposta.text


def test_painel_modelo_do_rosto(client: TestClient):
    pontos = client.get("/painel/modelos/rosto-pontos.bin")
    linhas = client.get("/painel/modelos/rosto-linhas.bin")
    marcos = client.get("/painel/modelos/rosto-marcos.json")

    assert pontos.status_code == 200
    assert len(pontos.content) >= 12 * 7000  # 6 valores int16 por ponto
    assert len(pontos.content) % 12 == 0
    assert linhas.status_code == 200
    assert len(linhas.content) % 24 == 0  # dois vértices por segmento
    assert marcos.status_code == 200
    assert len(marcos.json()["pontos"]) > 20
