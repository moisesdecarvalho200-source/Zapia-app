import React, { useRef, useState } from 'react';
import {
  Image as ImageIcon,
  Video,
  Upload,
  Download,
  Printer,
  CloudUpload,
  Trash2,
  Camera,
  Film,
  X,
  Check,
} from 'lucide-react';
import { LocalGalleryItem } from '../utils/offlineDb';

interface GalleryViewProps {
  items: LocalGalleryItem[];
  hasGoogleToken: boolean;
  userName: string;
  onAddMediaItem: (item: LocalGalleryItem) => Promise<void>;
  onDeleteMediaItem: (id: string) => Promise<void>;
  onSaveMediaToDrive: (item: LocalGalleryItem) => Promise<void>;
  onSyncPhotosFromDrive: () => Promise<void>;
}

export const GalleryView: React.FC<GalleryViewProps> = ({
  items,
  hasGoogleToken,
  userName,
  onAddMediaItem,
  onDeleteMediaItem,
  onSaveMediaToDrive,
  onSyncPhotosFromDrive,
}) => {
  const [filter, setFilter] = useState<'all' | 'photo' | 'video' | 'drive'>('all');
  const [lightboxItem, setLightboxItem] = useState<LocalGalleryItem | null>(null);
  const [studioTitle, setStudioTitle] = useState('ZAPIA Studio Pro');
  const [studioSubtitle, setStudioSubtitle] = useState(`Produção assinada por ${userName}`);
  const [studioStyle, setStudioStyle] = useState<'obsidian' | 'crimson' | 'gold' | 'platinum'>('obsidian');
  const [studioFilter, setStudioFilter] = useState<'none' | 'contrast' | 'vivid'>('vivid');
  const [isRenderingVideo, setIsRenderingVideo] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  const videoPreviewRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const filtered = items.filter((item) => {
    if (filter === 'all') return true;
    if (filter === 'drive') return item.source === 'drive' || !!item.driveFileId;
    return item.kind === filter;
  });

  const handleImportFiles = async (fileList: FileList) => {
    for (const file of Array.from(fileList)) {
      const reader = new FileReader();
      reader.onload = async () => {
        const dataUrl = String(reader.result || '');
        if (!dataUrl) return;
        const kind: 'photo' | 'video' = file.type.startsWith('video/') ? 'video' : 'photo';
        await onAddMediaItem({
          id: `gal_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          title: file.name,
          kind,
          source: 'local',
          mimeType: file.type || (kind === 'video' ? 'video/mp4' : 'image/png'),
          dataUrl,
          createdAtIso: new Date().toISOString(),
        });
      };
      reader.readAsDataURL(file);
    }
    setStatusMsg(`${fileList.length} mídia(s) importada(s) para a Galeria Integrada.`);
  };

  const drawStudioFrame = (
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    t: number
  ) => {
    const palettes = {
      obsidian: ['#090b10', '#181c28', '#dc2626'],
      crimson: ['#14070a', '#450a0a', '#f43f5e'],
      gold: ['#120f08', '#2c2210', '#f59e0b'],
      platinum: ['#f8fafc', '#e2e8f0', '#dc2626'],
    };
    const [c1, c2, accent] = palettes[studioStyle];
    const grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, c1);
    grad.addColorStop(1, c2);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // Architectural kinetic rings
    ctx.save();
    ctx.strokeStyle = accent;
    ctx.globalAlpha = 0.28;
    ctx.lineWidth = 3;
    for (let i = 0; i < 4; i++) {
      const r = 110 + i * 58 + Math.sin(t * 2 + i) * 10;
      ctx.beginPath();
      ctx.arc(w * 0.78, h * 0.45, r, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();

    // Metallic Z monogram
    ctx.save();
    ctx.fillStyle = studioStyle === 'platinum' ? '#0f172a' : '#f8fafc';
    ctx.font = 'bold 96px Outfit, sans-serif';
    ctx.fillText('ZAPIA', 64, 150);
    ctx.fillStyle = accent;
    ctx.fillRect(64, 174, 140, 6);
    ctx.restore();

    // User title & signature
    ctx.fillStyle = studioStyle === 'platinum' ? '#0f172a' : '#f1f5f9';
    ctx.font = '600 44px Outfit, sans-serif';
    ctx.fillText(studioTitle.slice(0, 34), 64, h * 0.54);

    ctx.fillStyle = studioStyle === 'platinum' ? '#475569' : '#cbd5e1';
    ctx.font = '400 24px Plus Jakarta Sans, sans-serif';
    ctx.fillText(studioSubtitle.slice(0, 54), 64, h * 0.63);

    ctx.fillStyle = accent;
    ctx.font = '600 18px JetBrains Mono, monospace';
    ctx.fillText(`ASSINADO POR ${userName.toUpperCase()}`, 64, h - 56);
  };

  const handleGeneratePhoto = async () => {
    const canvas = document.createElement('canvas');
    canvas.width = 1280;
    canvas.height = 720;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (studioFilter === 'contrast') {
      ctx.filter = 'contrast(118%) saturate(105%)';
    } else if (studioFilter === 'vivid') {
      ctx.filter = 'contrast(110%) saturate(125%)';
    }
    drawStudioFrame(ctx, canvas.width, canvas.height, 0.5);

    const dataUrl = canvas.toDataURL('image/png');
    await onAddMediaItem({
      id: `gal_photo_${Date.now()}`,
      title: `${studioTitle || 'Arte_ZAPIA'}.png`,
      kind: 'photo',
      source: 'studio',
      mimeType: 'image/png',
      dataUrl,
      width: 1280,
      height: 720,
      createdAtIso: new Date().toISOString(),
    });
    setStatusMsg('Foto HD 1280x720 gerada e salva na galeria.');
  };

  const handleRenderRealVideo = async () => {
    if (isRenderingVideo) return;
    setIsRenderingVideo(true);
    setStatusMsg('Renderizando vídeo WebM em tempo real...');
    try {
      const canvas = document.createElement('canvas');
      canvas.width = 960;
      canvas.height = 540;
      const ctx = canvas.getContext('2d');
      if (!ctx || typeof canvas.captureStream !== 'function' || typeof MediaRecorder === 'undefined') {
        throw new Error('Navegador sem suporte a MediaRecorder para renderização de vídeo.');
      }

      const stream = canvas.captureStream(24);
      const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
        ? 'video/webm;codecs=vp9'
        : 'video/webm';
      const recorder = new MediaRecorder(stream, { mimeType });
      const chunks: Blob[] = [];
      recorder.ondataavailable = (ev) => {
        if (ev.data.size > 0) chunks.push(ev.data);
      };

      const donePromise = new Promise<Blob>((resolve) => {
        recorder.onstop = () => resolve(new Blob(chunks, { type: 'video/webm' }));
      });

      recorder.start();
      const totalMs = 2400;
      const start = performance.now();
      await new Promise<void>((resolve) => {
        const step = () => {
          const elapsed = performance.now() - start;
          drawStudioFrame(ctx, canvas.width, canvas.height, elapsed / 1000);
          if (elapsed < totalMs) {
            requestAnimationFrame(step);
          } else {
            resolve();
          }
        };
        step();
      });
      recorder.stop();
      const videoBlob = await donePromise;
      const reader = new FileReader();
      reader.onload = async () => {
        const dataUrl = String(reader.result || '');
        await onAddMediaItem({
          id: `gal_video_${Date.now()}`,
          title: `${studioTitle || 'Video_ZAPIA'}.webm`,
          kind: 'video',
          source: 'studio',
          mimeType: 'video/webm',
          dataUrl,
          width: 960,
          height: 540,
          createdAtIso: new Date().toISOString(),
        });
        setStatusMsg('Vídeo real WebM criado e salvo na galeria.');
        setIsRenderingVideo(false);
      };
      reader.readAsDataURL(videoBlob);
    } catch (err: unknown) {
      setStatusMsg(err instanceof Error ? err.message : 'Erro ao renderizar vídeo.');
      setIsRenderingVideo(false);
    }
  };

  const toggleCamera = async () => {
    if (cameraActive) {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      setCameraActive(false);
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      streamRef.current = stream;
      setCameraActive(true);
      setTimeout(() => {
        if (videoPreviewRef.current) {
          videoPreviewRef.current.srcObject = stream;
        }
      }, 60);
    } catch {
      setStatusMsg('Câmera indisponível ou permissão recusada.');
    }
  };

  const captureCameraPhoto = async () => {
    if (!videoPreviewRef.current) return;
    const video = videoPreviewRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/png');
    await onAddMediaItem({
      id: `gal_cam_${Date.now()}`,
      title: `Captura_${new Date().toLocaleTimeString('pt-BR').replace(/:/g, '-')}.png`,
      kind: 'photo',
      source: 'local',
      mimeType: 'image/png',
      dataUrl,
      width: canvas.width,
      height: canvas.height,
      createdAtIso: new Date().toISOString(),
    });
    setStatusMsg('Foto capturada da câmera e salva na galeria.');
  };

  const downloadMedia = (item: LocalGalleryItem) => {
    const a = document.createElement('a');
    a.href = item.dataUrl;
    a.download = item.title;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  return (
    <div className="space-y-6">
      {/* Studio Creator Card */}
      <section className="rounded-2xl border border-[var(--zapia-border)] bg-[var(--zapia-surface)] p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-[var(--zapia-text)]">
              Estúdio de Foto & Vídeo Real
            </h2>
            <p className="text-xs text-[var(--zapia-muted)]">
              Crie imagens PNG em alta definição, grave vídeos WebM reais ou importe mídias do Android e PC
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border border-[var(--zapia-border)] bg-[var(--zapia-surface-alt)] text-xs font-medium text-[var(--zapia-text)] cursor-pointer hover:border-[var(--zapia-accent)]">
              <Upload className="w-4 h-4" />
              <span>Importar Mídia</span>
              <input
                type="file"
                accept="image/*,video/*"
                multiple
                className="sr-only"
                onChange={(e) => {
                  if (e.target.files?.length) {
                    handleImportFiles(e.target.files);
                    e.target.value = '';
                  }
                }}
              />
            </label>
            <button
              type="button"
              onClick={toggleCamera}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border border-[var(--zapia-border)] bg-[var(--zapia-surface-alt)] text-xs font-medium text-[var(--zapia-text)] hover:border-[var(--zapia-accent)]"
            >
              <Camera className="w-4 h-4" />
              <span>{cameraActive ? 'Fechar Câmera' : 'Câmera Ao Vivo'}</span>
            </button>
            {hasGoogleToken && (
              <button
                type="button"
                onClick={onSyncPhotosFromDrive}
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border border-[var(--zapia-border)] bg-[var(--zapia-surface-alt)] text-xs font-medium text-[var(--zapia-text)] hover:border-[var(--zapia-accent)]"
              >
                <CloudUpload className="w-4 h-4 text-[var(--zapia-accent)]" />
                <span>Sincronizar Drive / Fotos</span>
              </button>
            )}
          </div>
        </div>

        {cameraActive && (
          <div className="p-4 rounded-xl border border-[var(--zapia-border)] bg-[var(--zapia-bg)] space-y-3">
            <video ref={videoPreviewRef} autoPlay playsInline muted className="w-full max-h-72 rounded-xl object-cover bg-black" />
            <button
              type="button"
              onClick={captureCameraPhoto}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[var(--zapia-accent)] text-[var(--zapia-accent-fg)] text-xs font-semibold"
            >
              <Camera className="w-4 h-4" />
              <span>Capturar Foto PNG</span>
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div>
            <label htmlFor="studio-title" className="block text-xs text-[var(--zapia-muted)] mb-1">
              Título da Arte / Vídeo
            </label>
            <input
              id="studio-title"
              type="text"
              value={studioTitle}
              onChange={(e) => setStudioTitle(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-[var(--zapia-border)] bg-[var(--zapia-bg)] text-xs text-[var(--zapia-text)]"
            />
          </div>
          <div>
            <label htmlFor="studio-subtitle" className="block text-xs text-[var(--zapia-muted)] mb-1">
              Legenda
            </label>
            <input
              id="studio-subtitle"
              type="text"
              value={studioSubtitle}
              onChange={(e) => setStudioSubtitle(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-[var(--zapia-border)] bg-[var(--zapia-bg)] text-xs text-[var(--zapia-text)]"
            />
          </div>
          <div>
            <label htmlFor="studio-style" className="block text-xs text-[var(--zapia-muted)] mb-1">
              Paleta do Estúdio
            </label>
            <select
              id="studio-style"
              value={studioStyle}
              onChange={(e) => setStudioStyle(e.target.value as typeof studioStyle)}
              className="w-full px-3 py-2 rounded-xl border border-[var(--zapia-border)] bg-[var(--zapia-bg)] text-xs text-[var(--zapia-text)]"
            >
              <option value="obsidian">Obsidian & Crimson</option>
              <option value="crimson">Crimson Intenso</option>
              <option value="gold">Royal Gold</option>
              <option value="platinum">Platinum Claro</option>
            </select>
          </div>
          <div>
            <label htmlFor="studio-filter" className="block text-xs text-[var(--zapia-muted)] mb-1">
              Tratamento de Cor
            </label>
            <select
              id="studio-filter"
              value={studioFilter}
              onChange={(e) => setStudioFilter(e.target.value as typeof studioFilter)}
              className="w-full px-3 py-2 rounded-xl border border-[var(--zapia-border)] bg-[var(--zapia-bg)] text-xs text-[var(--zapia-text)]"
            >
              <option value="vivid">Cores Vivas HD</option>
              <option value="contrast">Alto Contraste</option>
              <option value="none">Original</option>
            </select>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={handleGeneratePhoto}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[var(--zapia-accent)] text-[var(--zapia-accent-fg)] text-xs font-semibold hover:opacity-90"
          >
            <ImageIcon className="w-4 h-4" />
            <span>Gerar Foto HD (PNG)</span>
          </button>
          <button
            type="button"
            onClick={handleRenderRealVideo}
            disabled={isRenderingVideo}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-[var(--zapia-border)] bg-[var(--zapia-surface-alt)] text-xs font-semibold text-[var(--zapia-text)] hover:border-[var(--zapia-accent)] disabled:opacity-50"
          >
            <Film className="w-4 h-4 text-[var(--zapia-accent)]" />
            <span>{isRenderingVideo ? 'Renderizando Vídeo...' : 'Criar Vídeo WebM Real'}</span>
          </button>
        </div>

        {statusMsg && (
          <p className="text-xs text-emerald-500 flex items-center gap-1.5" role="status">
            <Check className="w-3.5 h-3.5" />
            {statusMsg}
          </p>
        )}
      </section>

      {/* Gallery Grid */}
      <section className="rounded-2xl border border-[var(--zapia-border)] bg-[var(--zapia-surface)] p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-base font-semibold text-[var(--zapia-text)]">
            Galeria Integrada Android & PC ({filtered.length})
          </h3>
          <div className="flex items-center gap-1 p-1 rounded-xl bg-[var(--zapia-surface-alt)] border border-[var(--zapia-border)]">
            {[
              { id: 'all', label: 'Tudo' },
              { id: 'photo', label: 'Fotos' },
              { id: 'video', label: 'Vídeos' },
              { id: 'drive', label: 'Drive' },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setFilter(tab.id as typeof filter)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  filter === tab.id
                    ? 'bg-[var(--zapia-accent)] text-[var(--zapia-accent-fg)]'
                    : 'text-[var(--zapia-muted)] hover:text-[var(--zapia-text)]'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4" data-testid="gallery-grid">
          {filtered.map((item) => (
            <article
              key={item.id}
              className="rounded-xl border border-[var(--zapia-border)] bg-[var(--zapia-bg)] overflow-hidden flex flex-col"
            >
              <button
                type="button"
                onClick={() => setLightboxItem(item)}
                className="relative aspect-video bg-black/40 overflow-hidden group text-left"
              >
                {item.kind === 'video' ? (
                  <video src={item.dataUrl} className="w-full h-full object-cover" muted playsInline />
                ) : (
                  <img
                    src={item.dataUrl}
                    alt={item.title}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform"
                  />
                )}
                <span className="sr-only">Visualizar {item.title}</span>
              </button>
              <div className="p-3.5 flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-[var(--zapia-text)] truncate">{item.title}</div>
                  <div className="text-[11px] text-[var(--zapia-muted)]">
                    {item.kind === 'video' ? 'Vídeo' : 'Foto'} · {item.source}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    aria-label={`Baixar ${item.title}`}
                    onClick={() => downloadMedia(item)}
                    className="p-2 rounded-lg text-[var(--zapia-muted)] hover:text-[var(--zapia-text)] hover:bg-[var(--zapia-surface-alt)]"
                  >
                    <Download className="w-3.5 h-3.5" />
                  </button>
                  {hasGoogleToken && (
                    <button
                      type="button"
                      aria-label={`Salvar ${item.title} no Drive`}
                      onClick={() => onSaveMediaToDrive(item)}
                      className="p-2 rounded-lg text-[var(--zapia-muted)] hover:text-[var(--zapia-text)] hover:bg-[var(--zapia-surface-alt)]"
                    >
                      <CloudUpload className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <button
                    type="button"
                    aria-label={`Excluir ${item.title}`}
                    onClick={() => onDeleteMediaItem(item.id)}
                    className="p-2 rounded-lg text-[var(--zapia-muted)] hover:text-rose-500 hover:bg-[var(--zapia-surface-alt)]"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* Lightbox Modal */}
      {lightboxItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-3xl rounded-2xl border border-[var(--zapia-border)] bg-[var(--zapia-surface)] p-5 space-y-4">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2 min-w-0">
                {lightboxItem.kind === 'video' ? <Video className="w-4 h-4 text-[var(--zapia-accent)]" /> : <ImageIcon className="w-4 h-4 text-[var(--zapia-accent)]" />}
                <h3 className="text-base font-semibold text-[var(--zapia-text)] truncate">{lightboxItem.title}</h3>
              </div>
              <button
                type="button"
                aria-label="Fechar visualização"
                onClick={() => setLightboxItem(null)}
                className="p-2 rounded-lg text-[var(--zapia-muted)] hover:text-[var(--zapia-text)]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="rounded-xl overflow-hidden bg-black flex items-center justify-center max-h-[60vh]">
              {lightboxItem.kind === 'video' ? (
                <video src={lightboxItem.dataUrl} controls autoPlay className="max-h-[60vh] w-full" />
              ) : (
                <img
                  src={lightboxItem.dataUrl}
                  alt={lightboxItem.title}
                  referrerPolicy="no-referrer"
                  className="max-h-[60vh] object-contain"
                />
              )}
            </div>

            <div className="flex flex-wrap justify-end gap-2 no-print">
              <button
                type="button"
                onClick={() => downloadMedia(lightboxItem)}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-[var(--zapia-border)] text-xs font-medium text-[var(--zapia-text)]"
              >
                <Download className="w-4 h-4" />
                <span>Baixar</span>
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--zapia-accent)] text-[var(--zapia-accent-fg)] text-xs font-semibold"
              >
                <Printer className="w-4 h-4" />
                <span>Imprimir</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
