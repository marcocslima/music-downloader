"use client";

import { useState, useRef, KeyboardEvent } from "react";
import {
  Search,
  Download,
  Music,
  ChevronDown,
  ChevronUp,
  Loader2,
  AlertCircle,
  CheckCircle2,
  X,
} from "lucide-react";

type AppState = "idle" | "searching" | "ready" | "downloading" | "success";

interface TrackInfo {
  titulo: string;
  artista: string;
  nome_completo: string;
  sanitizado: string;
  cover_url: string;
}

interface Toast {
  id: number;
  type: "success" | "error";
  message: string;
}

export default function Home() {
  const [query, setQuery] = useState("");
  const [appState, setAppState] = useState<AppState>("idle");
  const [trackInfo, setTrackInfo] = useState<TrackInfo | null>(null);
  const [formato, setFormato] = useState("mp3");
  const [qualidade, setQualidade] = useState("320k");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastIdRef = useRef(0);

  const addToast = (type: "success" | "error", message: string) => {
    const id = ++toastIdRef.current;
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 5000);
  };

  const removeToast = (id: number) =>
    setToasts((prev) => prev.filter((t) => t.id !== id));

  const handleSearch = async () => {
    if (!query.trim()) return;
    setAppState("searching");
    setTrackInfo(null);

    try {
      const res = await fetch(`/api/info?q=${encodeURIComponent(query.trim())}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Música não encontrada.");
      setTrackInfo(data);
      setAppState("ready");
    } catch (err: any) {
      addToast("error", err.message || "Erro ao buscar música.");
      setAppState("idle");
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && appState === "idle") handleSearch();
  };

  const handleDownload = async () => {
    if (!trackInfo) return;
    setAppState("downloading");

    try {
      const params = new URLSearchParams({
        q: query.trim(),
        formato,
        qualidade,
        start_time: startTime,
        end_time: endTime,
      });

      const res = await fetch(`/api/download?${params.toString()}`);
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "Erro ao processar download.");
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${trackInfo.sanitizado}.${formato}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setAppState("success");
      addToast("success", `"${trackInfo.titulo}" baixada com sucesso!`);
      setTimeout(() => setAppState("ready"), 3000);
    } catch (err: any) {
      addToast("error", err.message || "Erro ao processar o download.");
      setAppState("ready");
    }
  };

  const isLoading = appState === "searching" || appState === "downloading";

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex flex-col items-center justify-center p-4">

      {/* ── Toasts ───────────────────────────────── */}
      <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`pointer-events-auto flex items-start gap-3 p-4 rounded-xl shadow-xl border animate-fade-in ${
              toast.type === "success"
                ? "bg-emerald-950/90 border-emerald-800 text-emerald-100"
                : "bg-red-950/90 border-red-800 text-red-100"
            }`}
          >
            {toast.type === "success" ? (
              <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5 text-emerald-400" />
            ) : (
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-red-400" />
            )}
            <p className="text-sm flex-1 leading-relaxed">{toast.message}</p>
            <button
              onClick={() => removeToast(toast.id)}
              className="shrink-0 opacity-60 hover:opacity-100 transition-opacity"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>

      {/* ── Card Principal ───────────────────────── */}
      <div className="w-full max-w-2xl">

        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center p-4 bg-sky-500/10 border border-sky-500/20 rounded-2xl mb-4">
            <Music className="w-10 h-10 text-sky-400" />
          </div>
          <h1 className="text-4xl font-bold text-white mb-2 tracking-tight">
            Music Downloader
          </h1>
          <p className="text-slate-400 text-base">
            Busque pelo nome ou cole um link do Deezer para baixar em MP3 ou WAV
          </p>
        </div>

        {/* Search Card */}
        <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-6 mb-4 shadow-2xl">

          {/* Input + Botão */}
          <div className="flex gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500 pointer-events-none" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ex: Tião Carreiro, Pagode em Brasília ou link do Deezer"
                disabled={isLoading}
                className="w-full bg-slate-900/60 border border-slate-600/50 rounded-xl pl-12 pr-4 py-3.5 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500/40 focus:border-sky-500/40 transition-all disabled:opacity-50 text-sm"
              />
            </div>
            <button
              onClick={handleSearch}
              disabled={isLoading || !query.trim()}
              className="shrink-0 px-5 py-3.5 bg-sky-600 hover:bg-sky-500 active:bg-sky-700 disabled:bg-slate-700 disabled:cursor-not-allowed text-white font-semibold rounded-xl flex items-center gap-2 transition-all shadow-lg shadow-sky-900/30 min-w-[120px] justify-center"
            >
              {appState === "searching" ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="text-sm">Buscando…</span>
                </>
              ) : (
                <>
                  <Search className="w-4 h-4" />
                  <span className="text-sm">Buscar</span>
                </>
              )}
            </button>
          </div>

          {/* Opções Avançadas */}
          <div className="mt-5">
            <button
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="flex items-center gap-1.5 text-slate-400 hover:text-slate-300 text-sm font-medium transition-colors"
            >
              {showAdvanced ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
              Opções Avançadas
            </button>

            {showAdvanced && (
              <div className="mt-4 pt-5 border-t border-slate-700/60 grid grid-cols-1 sm:grid-cols-2 gap-4">

                {/* Formato */}
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-2 uppercase tracking-widest">
                    Formato
                  </label>
                  <div className="flex gap-2">
                    {["mp3", "wav"].map((f) => (
                      <button
                        key={f}
                        onClick={() => setFormato(f)}
                        className={`flex-1 py-2.5 rounded-lg text-sm font-semibold uppercase transition-all ${
                          formato === f
                            ? "bg-sky-600 text-white shadow-md"
                            : "bg-slate-700/50 text-slate-400 hover:bg-slate-700 hover:text-white"
                        }`}
                      >
                        {f}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Qualidade */}
                {formato === "mp3" && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-2 uppercase tracking-widest">
                      Qualidade MP3
                    </label>
                    <div className="flex gap-2">
                      {["128k", "192k", "320k"].map((q) => (
                        <button
                          key={q}
                          onClick={() => setQualidade(q)}
                          className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                            qualidade === q
                              ? "bg-sky-600 text-white shadow-md"
                              : "bg-slate-700/50 text-slate-400 hover:bg-slate-700 hover:text-white"
                          }`}
                        >
                          {q}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Tempo Inicial */}
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-2 uppercase tracking-widest">
                    Tempo Inicial
                  </label>
                  <input
                    type="text"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    placeholder="00:00:00"
                    className="w-full bg-slate-900/60 border border-slate-600/50 rounded-lg px-3 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-sky-500/40 transition-all"
                  />
                </div>

                {/* Tempo Final */}
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-2 uppercase tracking-widest">
                    Tempo Final
                  </label>
                  <input
                    type="text"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    placeholder="00:03:30"
                    className="w-full bg-slate-900/60 border border-slate-600/50 rounded-lg px-3 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-sky-500/40 transition-all"
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Track Preview Card */}
        {trackInfo && (
          <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-6 mb-4 shadow-2xl">
            <div className="flex gap-4 items-center">
              {trackInfo.cover_url ? (
                <img
                  src={trackInfo.cover_url}
                  alt={`Capa: ${trackInfo.titulo}`}
                  className="w-20 h-20 sm:w-24 sm:h-24 rounded-xl object-cover shadow-lg shrink-0 ring-2 ring-slate-700"
                />
              ) : (
                <div className="w-20 h-20 rounded-xl bg-slate-700/60 flex items-center justify-center shrink-0">
                  <Music className="w-8 h-8 text-slate-500" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-slate-500 text-xs uppercase tracking-widest font-semibold mb-1">
                  Música encontrada
                </p>
                <h2 className="text-white font-bold text-lg leading-snug truncate">
                  {trackInfo.titulo}
                </h2>
                <p className="text-sky-400 font-medium truncate text-sm">
                  {trackInfo.artista}
                </p>
                <p className="text-slate-600 text-xs mt-1.5 font-mono truncate">
                  {trackInfo.sanitizado}.{formato}
                </p>
              </div>
            </div>

            {/* Botão Download */}
            <button
              onClick={handleDownload}
              disabled={isLoading}
              className={`w-full mt-5 py-4 font-bold rounded-xl flex items-center justify-center gap-2.5 transition-all shadow-lg text-sm tracking-wide ${
                appState === "success"
                  ? "bg-emerald-600 text-white"
                  : appState === "downloading"
                  ? "bg-slate-600 text-slate-300 cursor-not-allowed"
                  : "bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white shadow-emerald-900/30"
              }`}
            >
              {appState === "downloading" ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Processando e baixando…
                </>
              ) : appState === "success" ? (
                <>
                  <CheckCircle2 className="w-5 h-5" />
                  Download concluído!
                </>
              ) : (
                <>
                  <Download className="w-5 h-5" />
                  Baixar {formato.toUpperCase()}
                  {formato === "mp3" ? ` · ${qualidade}` : ""}
                </>
              )}
            </button>
          </div>
        )}

        {/* Footer */}
        <p className="text-center text-slate-700 text-xs mt-2">
          Metadados via Deezer API · Áudio extraído via YouTube
        </p>
      </div>
    </main>
  );
}
