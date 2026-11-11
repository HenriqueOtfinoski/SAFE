"""Lê um GLB, amostra pontos+normais da superfície e gera prévias/arquivo binário.

Uso:
  python glb_rosto.py info  modelo.glb previa.png
  python glb_rosto.py gerar modelo.glb saida.bin previa.png [y_corte] [n_pontos]
"""
import json
import struct
import sys

import cv2
import numpy as np

COMP = {5120: np.int8, 5121: np.uint8, 5122: np.int16, 5123: np.uint16, 5125: np.uint32, 5126: np.float32}
NCOMP = {"SCALAR": 1, "VEC2": 2, "VEC3": 3, "VEC4": 4, "MAT4": 16}


def ler_glb(caminho):
    dados = open(caminho, "rb").read()
    magic, versao, _total = struct.unpack_from("<4sII", dados, 0)
    assert magic == b"glTF", "não é GLB"
    pos = 12
    doc = None
    binario = None
    while pos < len(dados):
        tam, tipo = struct.unpack_from("<I4s", dados, pos)
        corpo = dados[pos + 8 : pos + 8 + tam]
        if tipo == b"JSON":
            doc = json.loads(corpo.decode("utf-8"))
        elif tipo.startswith(b"BIN"):
            binario = corpo
        pos += 8 + tam
    return doc, binario


def acessor(doc, binario, indice):
    a = doc["accessors"][indice]
    bv = doc["bufferViews"][a["bufferView"]]
    tipo = COMP[a["componentType"]]
    n = NCOMP[a["type"]]
    inicio = bv.get("byteOffset", 0) + a.get("byteOffset", 0)
    passo = bv.get("byteStride", 0)
    tam_item = np.dtype(tipo).itemsize * n
    if passo and passo != tam_item:
        bruto = np.frombuffer(binario, dtype=np.uint8, count=passo * a["count"], offset=inicio).reshape(a["count"], passo)
        arr = np.frombuffer(bruto[:, :tam_item].tobytes(), dtype=tipo).reshape(a["count"], n)
    else:
        arr = np.frombuffer(binario, dtype=tipo, count=a["count"] * n, offset=inicio).reshape(a["count"], n)
    arr = arr.astype(np.float64) if tipo == np.float32 else arr.astype(np.int64)
    if a.get("normalized") and tipo != np.float32:
        arr = arr / np.iinfo(tipo).max
    return arr


def matriz_do_no(no):
    if "matrix" in no:
        return np.array(no["matrix"], dtype=np.float64).reshape(4, 4).T
    m = np.eye(4)
    if "scale" in no:
        m = np.diag(list(no["scale"]) + [1.0]) @ m
    if "rotation" in no:
        x, y, z, w = no["rotation"]
        r = np.array([
            [1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w), 0],
            [2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w), 0],
            [2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y), 0],
            [0, 0, 0, 1],
        ])
        m = r @ m
    if "translation" in no:
        t = np.eye(4)
        t[:3, 3] = no["translation"]
        m = t @ m
    return m


def carregar_triangulos(caminho):
    doc, binario = ler_glb(caminho)
    usados = doc.get("extensionsRequired", [])
    assert not any("draco" in e.lower() or "meshopt" in e.lower() for e in usados), f"compressão não suportada: {usados}"
    verts = []
    tris = []
    base = 0

    def visitar(i, pai):
        nonlocal base
        no = doc["nodes"][i]
        m = pai @ matriz_do_no(no)
        if "mesh" in no:
            for prim in doc["meshes"][no["mesh"]]["primitives"]:
                if prim.get("mode", 4) != 4:
                    continue
                p = acessor(doc, binario, prim["attributes"]["POSITION"])
                p = (np.c_[p, np.ones(len(p))] @ m.T)[:, :3]
                if "indices" in prim:
                    idx = acessor(doc, binario, prim["indices"]).reshape(-1, 3)
                else:
                    idx = np.arange(len(p)).reshape(-1, 3)
                verts.append(p)
                tris.append(idx + base)
                base += len(p)
        for f in no.get("children", []):
            visitar(f, m)

    cena = doc["scenes"][doc.get("scene", 0)]
    for raiz in cena["nodes"]:
        visitar(raiz, np.eye(4))
    return np.vstack(verts), np.vstack(tris)


def normais_suaves(v, t):
    # Solda vértices coincidentes para a normal ficar contínua entre faces.
    chave = np.round(v / (np.ptp(v, axis=0).max() * 1e-5)).astype(np.int64)
    _, inv = np.unique(chave, axis=0, return_inverse=True)
    inv = inv.reshape(-1)
    a, b, c = v[t[:, 0]], v[t[:, 1]], v[t[:, 2]]
    fn = np.cross(b - a, c - a)  # módulo = 2x área
    acum = np.zeros((inv.max() + 1, 3))
    for k in range(3):
        np.add.at(acum, inv[t[:, k]], fn)
    vn = acum[inv]
    vn /= np.linalg.norm(vn, axis=1, keepdims=True) + 1e-12
    return vn, np.linalg.norm(fn, axis=1) / 2


def amostrar(v, t, vn, areas, n, rng, peso=None):
    w = areas if peso is None else areas * peso
    escolha = rng.choice(len(t), size=n, p=w / w.sum())
    r1 = np.sqrt(rng.random(n))
    r2 = rng.random(n)
    b0, b1, b2 = 1 - r1, r1 * (1 - r2), r1 * r2
    tt = t[escolha]
    p = v[tt[:, 0]] * b0[:, None] + v[tt[:, 1]] * b1[:, None] + v[tt[:, 2]] * b2[:, None]
    nn = vn[tt[:, 0]] * b0[:, None] + vn[tt[:, 1]] * b1[:, None] + vn[tt[:, 2]] * b2[:, None]
    nn /= np.linalg.norm(nn, axis=1, keepdims=True) + 1e-12
    return p, nn


def previa(p, nn, caminho, titulo=""):
    """Três vistas (frente, 3/4, perfil) com sombreamento simples."""
    tam = 520
    img = np.zeros((tam, tam * 3, 3), np.uint8)
    luz = np.array([0.5, 0.55, 0.67])
    luz /= np.linalg.norm(luz)
    esc = tam / (np.ptp(p[:, 1]) * 1.15)
    cy = (p[:, 1].max() + p[:, 1].min()) / 2
    for k, ang in enumerate([0, 40, 90]):
        a = np.radians(ang)
        rot = np.array([[np.cos(a), 0, -np.sin(a)], [0, 1, 0], [np.sin(a), 0, np.cos(a)]])
        q = p @ rot.T
        nq = nn @ rot.T
        vis = nq[:, 2] > -0.05
        brilho = np.clip(nn @ luz, 0, 1) * 0.85 + 0.15
        xs = (q[vis, 0] * esc + tam / 2 + k * tam).astype(int)
        ys = (tam / 2 - (q[vis, 1] - cy) * esc).astype(int)
        ok = (xs >= k * tam) & (xs < (k + 1) * tam) & (ys >= 0) & (ys < tam)
        cor = (brilho[vis][ok] * 255).astype(np.uint8)
        img[ys[ok], xs[ok]] = np.stack([cor, cor, (cor * 0.6).astype(np.uint8)], axis=1)
    cv2.putText(img, titulo, (10, 20), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (200, 200, 200), 1)
    cv2.imwrite(caminho, img)


def main():
    modo, glb = sys.argv[1], sys.argv[2]
    v, t = carregar_triangulos(glb)
    vn, areas = normais_suaves(v, t)
    rng = np.random.default_rng(20261111)
    print("vertices", len(v), "triangulos", len(t))
    print("min", v.min(axis=0).round(3), "max", v.max(axis=0).round(3))

    if modo == "info":
        p, nn = amostrar(v, t, vn, areas, 60000, rng)
        previa(p, nn, sys.argv[3], "bruto: frente / 40 graus / perfil")
        # Perfil de largura por altura, para achar pescoço e queixo.
        ys = np.linspace(v[:, 1].min(), v[:, 1].max(), 41)
        for i in range(40):
            m = (p[:, 1] >= ys[i]) & (p[:, 1] < ys[i + 1])
            if m.any():
                print(f"y {ys[i]:+.3f}  largX {np.ptp(p[m, 0]):.3f}  zmax {p[m, 2].max():+.3f}  zmin {p[m, 2].min():+.3f}")
        return

    saida, png = sys.argv[3], sys.argv[4]
    y_corte = float(sys.argv[5])  # tudo abaixo disso (ombros/base) é descartado
    n = int(sys.argv[6]) if len(sys.argv) > 6 else 14000
    y_queixo = float(sys.argv[7])  # altura do queixo no modelo bruto
    girar = float(sys.argv[8]) if len(sys.argv) > 8 else 0.0  # graus em torno de Y, se o modelo não olhar para +Z

    if girar:
        a = np.radians(girar)
        rot = np.array([[np.cos(a), 0, np.sin(a)], [0, 1, 0], [-np.sin(a), 0, np.cos(a)]])
        v = v @ rot.T
        vn = vn @ rot.T

    # Normaliza: do queixo ao topo = 2.1 unidades, centrado em y=0; x e z centrados no crânio.
    topo = v[:, 1].max()
    escala = 2.1 / (topo - y_queixo)
    cabeca = v[v[:, 1] > y_queixo + (topo - y_queixo) * 0.35]
    cx = (cabeca[:, 0].max() + cabeca[:, 0].min()) / 2
    cz = (cabeca[:, 2].max() + cabeca[:, 2].min()) / 2
    centro = np.array([cx, (topo + y_queixo) / 2, cz])
    v2 = (v - centro) * escala
    corte = (y_corte - centro[1]) * escala

    # Mantém só triângulos acima do corte; mais densidade na frente do rosto.
    cent = v2[t].mean(axis=1)
    manter = cent[:, 1] > corte
    t2 = t[manter]
    cn = vn[t2].mean(axis=1)
    cn /= np.linalg.norm(cn, axis=1, keepdims=True) + 1e-12
    cent2 = cent[manter]
    peso = np.where((cn[:, 2] > 0.1) & (cent2[:, 1] > -1.1), 2.6, 1.0)
    p, nn = amostrar(v2, t2, vn, areas[manter], n, rng, peso)

    print("pontos", len(p), "min", p.min(axis=0).round(3), "max", p.max(axis=0).round(3), "corte", round(corte, 3))
    previa(p, nn, png, f"{n} pontos: frente / 40 graus / perfil")

    # Binário: int16 intercalado [x,y,z,nx,ny,nz]; posição em unidades de 1/8192, normal em 1/32767.
    dados = np.empty((n, 6), np.int16)
    dados[:, :3] = np.clip(np.round(p * 8192), -32767, 32767)
    dados[:, 3:] = np.round(nn * 32767)
    open(saida, "wb").write(dados.tobytes())
    print("bytes", dados.nbytes)


if __name__ == "__main__":
    main()
