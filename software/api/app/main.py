from pathlib import Path

from fastapi import FastAPI
from fastapi.responses import RedirectResponse
from fastapi.staticfiles import StaticFiles

from app.routers import health, pessoas

app = FastAPI(
    title="SAFE API",
    version="0.1.0",
)

app.include_router(health.router)
app.include_router(pessoas.router)

# Painel de Administração (HTML/CSS/JS)
PAINEL_DIR = Path(__file__).resolve().parent / "assets" / "painel"
app.mount("/painel", StaticFiles(directory=PAINEL_DIR, html=True), name="painel")


@app.get("/", include_in_schema=False)
def raiz():
    return RedirectResponse(url="/painel")