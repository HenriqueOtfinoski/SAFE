"""Converte a cabeça de referência (GLB) nos arquivos usados pelo painel.

Uso: python converter.py modelo.glb pasta_saida pasta_previas [marcos.json]

Saídas em pasta_saida:
  rosto-pontos.bin  int16 [x,y,z,nx,ny,nz] por ponto (posição/8192, normal/32767), ordem aleatória
  rosto-linhas.bin  mesmo formato, pares de vértices (segmentos de contorno)
  rosto-marcos.json marcos faciais projetados na superfície (se marcos.json for informado)
"""
import json
import sys

import cv2
import numpy as np

sys.path.insert(0, __file__.rsplit("\\", 1)[0].rsplit("/", 1)[0])
from glb_rosto import amostrar, carregar_triangulos, normais_suaves, previa  # noqa: E402

N_PONTOS = 24000
Y_QUEIXO = -0.25  # altura do queixo no modelo bruto (topo em +0.5)
ALTURA_ALVO = 2.1  # queixo → topo, nas unidades da cena


def normalizar_modelo(v, vn):
    # O modelo olha para +X; a cena espera +Z: x' = -z, z' = x.
    v = np.stack([-v[:, 2], v[:, 1], v[:, 0]], axis=1)
    vn = np.stack([-vn[:, 2], vn[:, 1], vn[:, 0]], axis=1)
    topo = v[:, 1].max()
    escala = ALTURA_ALVO / (topo - Y_QUEIXO)
    cranio = v[v[:, 1] > Y_QUEIXO + (topo - Y_QUEIXO) * 0.4]
    cx = (cranio[:, 0].max() + cranio[:, 0].min()) / 2
    cz = (cranio[:, 2].max() + cranio[:, 2].min()) / 2
    centro = np.array([cx, (topo + Y_QUEIXO) / 2, cz])
    return (v - centro) * escala, vn


def cortar_plano(v, t, vn, eixo, valor):
    """Segmentos da interseção da malha com o plano eixo=valor. Devolve (p0, p1, normal)."""
    d = v[:, eixo][t] - valor  # (T, 3)
    cruza = (d.min(axis=1) < 0) & (d.max(axis=1) > 0)
    tt = t[cruza]
    dd = d[cruza]
    pts = []
    for a, b in ((0, 1), (1, 2), (2, 0)):
        da, db = dd[:, a], dd[:, b]
        ok = (da * db) < 0
        f = np.where(ok, da / (da - db + 1e-30), 0)
        p = v[tt[:, a]] + (v[tt[:, b]] - v[tt[:, a]]) * f[:, None]
        pts.append((ok, p))
    # Cada triângulo que cruza tem exatamente duas arestas cortadas.
    p0 = np.where(pts[0][0][:, None], pts[0][1], pts[1][1])
    p1 = np.where(pts[2][0][:, None], pts[2][1], pts[1][1])
    n = vn[tt].mean(axis=1)
    n /= np.linalg.norm(n, axis=1, keepdims=True) + 1e-12
    return (p0 + p1) / 2, n


def anel_horizontal(v, t, vn, y, setores=96):
    """Contorno externo da fatia em y: um ponto por setor angular."""
    meio, n = cortar_plano(v, t, vn, 1, y)
    if len(meio) < 20:
        return []
    cx, cz = meio[:, 0].mean(), meio[:, 2].mean()
    ang = np.arctan2(meio[:, 0] - cx, meio[:, 2] - cz)
    raio = np.hypot(meio[:, 0] - cx, meio[:, 2] - cz)
    setor = ((ang + np.pi) / (2 * np.pi) * setores).astype(int) % setores
    pts = [None] * setores
    for s in range(setores):
        m = np.where(setor == s)[0]
        if len(m):
            k = m[np.argmax(raio[m])]
            pts[s] = (meio[k], n[k])
    segs = []
    for s in range(setores):
        a, b = pts[s], pts[(s + 1) % setores]
        if a is None or b is None:
            continue
        if np.linalg.norm(a[0] - b[0]) > 0.25:  # salto (ex.: orelha) não vira linha
            continue
        segs.append((a, b))
    return segs


def perfil_vertical(v, t, vn, x, faixas=110):
    """Curva frontal da fatia em x: para cada altura, o ponto mais à frente."""
    meio, n = cortar_plano(v, t, vn, 0, x)
    if len(meio) < 20:
        return []
    frente = n[:, 2] > 0.0
    meio, n = meio[frente], n[frente]
    y0, y1 = meio[:, 1].min(), meio[:, 1].max()
    faixa = np.clip(((meio[:, 1] - y0) / (y1 - y0 + 1e-9) * faixas).astype(int), 0, faixas - 1)
    pts = [None] * faixas
    for f in range(faixas):
        m = np.where(faixa == f)[0]
        if len(m):
            k = m[np.argmax(meio[m, 2])]
            pts[f] = (meio[k], n[k])
    segs = []
    for f in range(faixas - 1):
        a, b = pts[f], pts[f + 1]
        if a is None or b is None or np.linalg.norm(a[0] - b[0]) > 0.2:
            continue
        segs.append((a, b))
    return segs


def para_int16(pares_ou_pontos):
    arr = np.array(pares_ou_pontos, dtype=np.float64).reshape(-1, 6)
    out = np.empty((len(arr), 6), np.int16)
    out[:, :3] = np.clip(np.round(arr[:, :3] * 8192), -32767, 32767)
    out[:, 3:] = np.round(arr[:, 3:] * 32767)
    return out


def mapa_frontal(p, nn, caminho, marcos=None):
    """Vista frontal com grade de coordenadas, para posicionar os marcos."""
    px = 520  # pixels por unidade
    w, h = int(2.2 * px), int(3.2 * px)
    img = np.zeros((h, w, 3), np.uint8)
    luz = np.array([0.4, 0.5, 0.77])
    luz /= np.linalg.norm(luz)
    vis = nn[:, 2] > 0.02
    q, nq = p[vis], nn[vis]
    ordem = np.argsort(q[:, 2])
    q, nq = q[ordem], nq[ordem]
    xs = (q[:, 0] * px + w / 2).astype(int)
    ys = (1.2 * px - q[:, 1] * px).astype(int)
    ok = (xs >= 0) & (xs < w) & (ys >= 0) & (ys < h)
    cor = (np.clip(nq @ luz, 0, 1) * 235 + 20).astype(np.uint8)
    for dx in (0, 1):
        for dy in (0, 1):
            img[np.clip(ys[ok] + dy, 0, h - 1), np.clip(xs[ok] + dx, 0, w - 1)] = cor[ok][:, None]
    for g in np.arange(-1.0, 1.01, 0.1):
        x = int(g * px + w / 2)
        forte = abs(round(g * 10)) % 5 == 0
        cv2.line(img, (x, 0), (x, h), (0, 150, 255) if forte else (0, 70, 120), 1)
        if forte:
            cv2.putText(img, f"{g:+.1f}", (x + 3, 14), cv2.FONT_HERSHEY_SIMPLEX, 0.45, (0, 200, 255), 1)
    for g in np.arange(-1.9, 1.11, 0.1):
        y = int(1.2 * px - g * px)
        forte = abs(round(g * 10)) % 5 == 0
        cv2.line(img, (0, y), (w, y), (0, 150, 255) if forte else (0, 70, 120), 1)
        cv2.putText(img, f"{g:+.1f}", (3, y - 3), cv2.FONT_HERSHEY_SIMPLEX, 0.4, (0, 200, 255), 1)
    if marcos:
        for grupo in marcos:
            pts = [(int(x * px + w / 2), int(1.2 * px - y * px)) for x, y in grupo["pontos"]]
            for a, b in zip(pts, pts[1:] + (pts[:1] if grupo.get("fechado") else [])):
                cv2.line(img, a, b, (80, 255, 80), 2)
            for a in pts:
                cv2.circle(img, a, 5, (60, 60, 255), -1)
    cv2.imwrite(caminho, img)


def projetar(p, nn, x, y, raio=0.035):
    """Ponto da superfície frontal mais próximo de (x, y) na vista de frente."""
    d = np.hypot(p[:, 0] - x, p[:, 1] - y)
    m = np.where((d < raio) & (nn[:, 2] > 0.0))[0]
    if len(m) == 0:
        m = np.argsort(d)[:30]
    k = m[np.argmax(p[m, 2])]
    perto = m[np.abs(p[m, 2] - p[k, 2]) < 0.03]
    pos = np.array([x, y, p[perto, 2].mean()])
    n = nn[perto].mean(axis=0)
    n /= np.linalg.norm(n) + 1e-12
    return np.concatenate([pos + n * 0.012, n])


def main():
    glb, saida, previas = sys.argv[1], sys.argv[2], sys.argv[3]
    marcos_in = json.load(open(sys.argv[4], encoding="utf-8")) if len(sys.argv) > 4 else None

    v, t = carregar_triangulos(glb)
    vn, areas = normais_suaves(v, t)
    v, vn = normalizar_modelo(v, vn)
    rng = np.random.default_rng(20261111)

    # Descarta a tampa plana da base do pescoço.
    cent = v[t].mean(axis=1)
    cn = vn[t].mean(axis=1)
    cn /= np.linalg.norm(cn, axis=1, keepdims=True) + 1e-12
    base = v[:, 1].min()
    manter = ~((cent[:, 1] < base + 0.03) & (cn[:, 1] < -0.6))
    t, areas, cent, cn = t[manter], areas[manter], cent[manter], cn[manter]
    print("limites", v.min(axis=0).round(3), v.max(axis=0).round(3), "triangulos", len(t))

    # Pontos: mais densidade na frente do rosto.
    peso = np.where((cn[:, 2] > 0.15) & (cent[:, 1] > -1.15) & (np.abs(cent[:, 0]) < 0.8), 3.2, 1.0)
    p, nn = amostrar(v, t, vn, areas, N_PONTOS, rng, peso)
    pontos = para_int16(np.c_[p, nn])
    open(f"{saida}/rosto-pontos.bin", "wb").write(pontos.tobytes())
    previa(p, nn, f"{previas}/previa_pontos.png", f"{N_PONTOS} pontos")

    # Linhas de contorno: anéis horizontais + perfis verticais na frente.
    segs = []
    for y in np.linspace(-1.6, 1.0, 27):
        segs += anel_horizontal(v, t, vn, float(y))
    for x in np.linspace(-0.6, 0.6, 9):
        segs += perfil_vertical(v, t, vn, float(x) + 1e-4)
    linhas = para_int16([np.r_[a[0], a[1], b[0], b[1]] for a, b in segs])
    open(f"{saida}/rosto-linhas.bin", "wb").write(linhas.tobytes())
    print("pontos", pontos.nbytes, "bytes; segmentos", len(segs), "linhas", linhas.nbytes, "bytes")

    # Amostra densa para o mapa e para projetar os marcos.
    pd, nd = amostrar(v, t, vn, areas, 500000, rng, np.where(cn[:, 2] > 0, 3.0, 0.2))
    mapa_frontal(pd, nd, f"{previas}/mapa_frontal.png", marcos_in)

    if marcos_in:
        pts, lin = [], []
        for grupo in marcos_in:
            lista = [projetar(pd, nd, x, y) for x, y in grupo["pontos"]]
            pts += [q.round(4).tolist() for q in lista]
            fim = len(lista) if grupo.get("fechado") else len(lista) - 1
            for i in range(fim):
                a = np.array(grupo["pontos"][i])
                b = np.array(grupo["pontos"][(i + 1) % len(lista)])
                passos = 7
                for s in range(passos):
                    for f in (s / passos, (s + 1) / passos):
                        xy = a + (b - a) * f
                        lin.append(projetar(pd, nd, xy[0], xy[1]).round(4).tolist())
        json.dump({"pontos": pts, "linhas": lin}, open(f"{saida}/rosto-marcos.json", "w"), separators=(",", ":"))
        print("marcos", len(pts), "pontos;", len(lin) // 2, "segmentos")


if __name__ == "__main__":
    main()
