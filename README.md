# 🎵 Music Downloader

Aplicação web para baixar músicas em MP3 ou WAV de alta qualidade.
Busca metadados via **Deezer API** e extrai o áudio via **YouTube (yt-dlp)**.

## Stack
- **Frontend:** Next.js 14 (App Router) + Tailwind CSS + Lucide React
- **Backend:** FastAPI (Python) + Mangum (Vercel Serverless)
- **Áudio:** yt-dlp + ffmpeg (via static-ffmpeg)

## 🚀 Deploy na Vercel (3 passos)

### 1. Faça push para o GitHub
```bash
git init
git add .
git commit -m "feat: music downloader app"
git remote add origin https://github.com/SEU_USUARIO/music-downloader.git
git push -u origin main
```

### 2. Conecte na Vercel
1. Acesse [vercel.com/new](https://vercel.com/new)
2. Clique em **"Import Git Repository"**
3. Selecione o repositório `music-downloader`
4. Clique em **"Deploy"** — a Vercel detecta Next.js + Python automaticamente

### 3. Aguarde o build
O primeiro deploy leva ~2–3 minutos. Após isso, sua URL estará ativa.

## Desenvolvimento Local

```bash
# Frontend
npm install
npm run dev   # http://localhost:3000

# Backend (terminal separado)
pip install -r requirements.txt
uvicorn api.index:app --reload --port 8000
```

Para o frontend chamar o backend local, adicione ao `next.config.mjs`:
```js
const nextConfig = {
  async rewrites() {
    return [{ source: '/api/:path*', destination: 'http://localhost:8000/api/:path*' }]
  },
}
```

## ⚠️ Notas sobre o Vercel

- **Timeout:** Configurado para 60s (requer plano **Pro**). No Hobby plan, o limite é 10s — suficiente para `/api/info` mas pode falhar em `/api/download` para músicas longas.
- **FFmpeg:** O `static-ffmpeg` baixa os binários para `/tmp` no primeiro cold start (~10–15s). Requisições seguintes (container quente) são instantâneas.
