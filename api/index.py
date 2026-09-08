import os
import re
import unicodedata
import requests as http_requests
import tempfile
import subprocess
import shutil

import imageio_ffmpeg
import yt_dlp
from fastapi import FastAPI, Query, HTTPException, BackgroundTasks
from fastapi.responses import FileResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from mangum import Mangum

# O binário é instalado junto com imageio-ffmpeg durante o build.
# Não tenta escrever em /var/task durante a execução no Vercel.
FFMPEG_PATH = imageio_ffmpeg.get_ffmpeg_exe()

app = FastAPI(title="Music Downloader API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["GET"],
    allow_headers=["*"],
)


# ── Utilitários ──────────────────────────────────────────────────────────────

def sanitizar_nome(texto: str) -> str:
    nfkd = unicodedata.normalize("NFKD", texto)
    sem_acento = "".join([c for c in nfkd if not unicodedata.combining(c)])
    limpo = re.sub(r"[^\w\s]", "", sem_acento)
    return re.sub(r"\s+", "_", limpo.strip().lower())


def obter_info_deezer(entrada: str) -> dict:
    session = http_requests.Session()
    session.headers.update({"User-Agent": "Mozilla/5.0"})
    cover = ""

    if "deezer.com" in entrada:
        response = session.get(entrada, allow_redirects=True, timeout=10)
        match = re.search(r"/track/(\d+)", response.url)
        if not match:
            raise ValueError("Não foi possível extrair o ID da faixa do link.")
        track_id = match.group(1)
        dados = session.get(f"https://api.deezer.com/track/{track_id}", timeout=10).json()
        artista = dados["artist"]["name"]
        titulo = dados["title"]
        cover = (
            dados.get("album", {}).get("cover_xl")
            or dados.get("album", {}).get("cover_big")
            or dados.get("album", {}).get("cover_medium", "")
        )
    else:
        if "," in entrada:
            artista_busca, musica_busca = [p.strip() for p in entrada.split(",", 1)]
            termo_api = f'artist:"{artista_busca}" track:"{musica_busca}"'
        else:
            termo_api = entrada

        url_api = f"https://api.deezer.com/search?q={http_requests.utils.quote(termo_api)}&limit=1"
        resposta = session.get(url_api, timeout=10).json()

        if not resposta.get("data"):
            url_fallback = f"https://api.deezer.com/search?q={http_requests.utils.quote(entrada)}&limit=1"
            resposta = session.get(url_fallback, timeout=10).json()
            if not resposta.get("data"):
                raise ValueError(f"Música não encontrada no Deezer para: '{entrada}'")

        item = resposta["data"][0]
        artista = item["artist"]["name"]
        titulo = item["title"]
        cover = (
            item.get("album", {}).get("cover_xl")
            or item.get("album", {}).get("cover_big")
            or item.get("album", {}).get("cover_medium", "")
        )

    nome_completo = f"{artista} - {titulo}"
    return {
        "titulo": titulo,
        "artista": artista,
        "nome_completo": nome_completo,
        "sanitizado": sanitizar_nome(nome_completo),
        "cover_url": cover or "",
    }


# ── Endpoints ────────────────────────────────────────────────────────────────

@app.get("/api/info")
async def info(q: str = Query(..., description="Busca textual ou link do Deezer")):
    try:
        dados = obter_info_deezer(q)
        return JSONResponse(content=dados)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro interno: {str(e)}")


@app.get("/api/download")
async def download(
    background_tasks: BackgroundTasks,
    q: str = Query(...),
    formato: str = Query(default="mp3"),
    qualidade: str = Query(default="320k"),
    start_time: str = Query(default=""),
    end_time: str = Query(default=""),
):
    # 1. Buscar metadados no Deezer
    try:
        dados = obter_info_deezer(q)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao buscar música: {str(e)}")

    nome_sanitizado = dados["sanitizado"]
    nome_busca = dados["nome_completo"]

    # 2. Preparar diretório temporário em /tmp
    tmp_dir = tempfile.mkdtemp(dir="/tmp")
    output_template = os.path.join(tmp_dir, f"{nome_sanitizado}.%(ext)s")

    # 3. Montar post-processors
    postprocessors: list = []
    if formato == "mp3":
        postprocessors.append({
            "key": "FFmpegExtractAudio",
            "preferredcodec": "mp3",
            "preferredquality": qualidade.replace("k", ""),
        })
    else:
        postprocessors.append({
            "key": "FFmpegExtractAudio",
            "preferredcodec": "wav",
        })

    # 4. Configurar yt-dlp (somente áudio, sem vídeo)
    ydl_opts = {
        "format": "bestaudio/best",
        "outtmpl": output_template,
        "postprocessors": postprocessors,
        "ffmpeg_location": FFMPEG_PATH,
        "noplaylist": True,
        "quiet": True,
        "no_warnings": True,
        "socket_timeout": 30,
    }

    # 5. Download via YouTube Search
    search_query = f"ytsearch1:{nome_busca}"
    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            ydl.download([search_query])
    except Exception as e:
        shutil.rmtree(tmp_dir, ignore_errors=True)
        raise HTTPException(status_code=500, detail=f"Erro ao baixar áudio: {str(e)}")

    # 6. Localizar arquivo gerado
    output_file = None
    for fname in os.listdir(tmp_dir):
        if fname.startswith(nome_sanitizado):
            output_file = os.path.join(tmp_dir, fname)
            break

    if not output_file or not os.path.exists(output_file):
        shutil.rmtree(tmp_dir, ignore_errors=True)
        raise HTTPException(status_code=500, detail="Arquivo de áudio não foi gerado.")

    # 7. Trimming opcional via ffmpeg direto
    if start_time or end_time:
        ext = "mp3" if formato == "mp3" else "wav"
        trimmed_file = os.path.join(tmp_dir, f"{nome_sanitizado}_trim.{ext}")
        cmd = ["ffmpeg", "-y"]
        if start_time:
            cmd.extend(["-ss", start_time])
        cmd.extend(["-i", output_file])
        if end_time:
            cmd.extend(["-to", end_time])
        cmd.extend(["-c", "copy", trimmed_file])
        try:
            subprocess.run(cmd, check=True, capture_output=True, timeout=60)
            os.remove(output_file)
            output_file = trimmed_file
        except Exception as e:
            shutil.rmtree(tmp_dir, ignore_errors=True)
            raise HTTPException(status_code=500, detail=f"Erro ao recortar áudio: {str(e)}")

    # 8. Retornar arquivo e agendar limpeza do /tmp
    filename = f"{nome_sanitizado}.{formato}"

    def cleanup_tmp():
        shutil.rmtree(tmp_dir, ignore_errors=True)

    background_tasks.add_task(cleanup_tmp)

    media_type = "audio/mpeg" if formato == "mp3" else "audio/wav"
    return FileResponse(
        path=output_file,
        filename=filename,
        media_type=media_type,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


# ── Handler Vercel (ASGI via Mangum) ─────────────────────────────────────────
handler = Mangum(app, lifespan="off")