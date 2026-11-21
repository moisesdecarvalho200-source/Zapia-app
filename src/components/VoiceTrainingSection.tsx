import React, { useEffect, useRef, useState } from 'react';
import {
  AudioWaveform,
  CheckCircle2,
  Loader2,
  Mic,
  Square,
  Trash2,
  Upload,
  Volume2,
  Wand2,
} from 'lucide-react';
import {
  TrainedVoiceProfile,
  VoiceSampleItem,
  normalizeTrainedVoiceAnalysis,
} from '../utils/zapiaLogic';
import { ZapiaSettingsState } from '../utils/offlineDb';
import { zapiaSpeech } from '../utils/speechPlayer';

interface VoiceTrainingSectionProps {
  samples: VoiceSampleItem[];
  profiles: TrainedVoiceProfile[];
  settings: ZapiaSettingsState;
  isOnline: boolean;
  onAddSample: (sample: VoiceSampleItem) => Promise<void>;
  onDeleteSample: (id: string) => Promise<void>;
  onSaveProfile: (profile: TrainedVoiceProfile) => Promise<void>;
  onActivateProfile: (id: string | null) => Promise<void>;
  onDeleteProfile: (id: string) => Promise<void>;
}

const MAX_SAMPLE_BYTES = 6 * 1024 * 1024;

function readBlobAsDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error || new Error('Falha ao ler áudio.'));
    reader.readAsDataURL(blob);
  });
}

async function analyzeAudioOfflineAcoustic(
  dataUrl: string,
  profileName: string,
  sampleCount: number
): Promise<TrainedVoiceProfile> {
  let zeroCrossingRate = 0.08;
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (AudioCtx) {
      const resp = await fetch(dataUrl);
      const buf = await resp.arrayBuffer();
      const ctx = new AudioCtx();
      const decoded = await ctx.decodeAudioData(buf);
      const channel = decoded.getChannelData(0);
      let crossings = 0;
      const len = Math.min(channel.length, 48000 * 5);
      for (let i = 1; i < len; i++) {
        if ((channel[i - 1] >= 0 && channel[i] < 0) || (channel[i - 1] < 0 && channel[i] >= 0)) {
          crossings++;
        }
      }
      zeroCrossingRate = len > 1 ? crossings / len : 0.08;
      await ctx.close().catch(() => {});
    }
  } catch {
    // Fallback to neutral defaults if codec cannot be decoded in browser Web Audio
  }

  const isHigherPitch = zeroCrossingRate > 0.11;
  return normalizeTrainedVoiceAnalysis({
    profileName,
    gender: isHigherPitch ? 'feminina' : 'masculina',
    recommendedBaseVoice: isHigherPitch ? 'Kore' : 'Fenrir',
    recommendedSpeed: 48,
    recommendedPitch: isHigherPitch ? 56 : 44,
    recommendedWarmth: 72,
    vocalStylePrompt: isHigherPitch
      ? 'Análise acústica offline: registro vocal claro, dicção articulada e cadência natural em português do Brasil.'
      : 'Análise acústica offline: registro vocal firme, ressonância encorpada e cadência natural em português do Brasil.',
    timbreNotes:
      'Calibrado localmente no aparelho (modo offline) por estimativa espectral da amostra de áudio.',
    sampleCount,
  });
}

export const VoiceTrainingSection: React.FC<VoiceTrainingSectionProps> = ({
  samples,
  profiles,
  settings,
  isOnline,
  onAddSample,
  onDeleteSample,
  onSaveProfile,
  onActivateProfile,
  onDeleteProfile,
}) => {
  const [profileName, setProfileName] = useState('');
  const [voiceNotes, setVoiceNotes] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [isTraining, setIsTraining] = useState(false);
  const [previewingId, setPreviewingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const recordStartRef = useRef<number>(0);

  useEffect(() => {
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
    };
  }, []);

  const toggleRecordingSample = async () => {
    setFeedback(null);
    if (isRecording) {
      if (timerRef.current) {
        window.clearInterval(timerRef.current);
        timerRef.current = null;
      }
      mediaRecorderRef.current?.stop();
      setIsRecording(false);
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recordStartRef.current = Date.now();
      setRecordSeconds(0);

      recorder.ondataavailable = (ev) => {
        if (ev.data.size > 0) chunksRef.current.push(ev.data);
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const elapsedSec = Math.max(1, Math.round((Date.now() - recordStartRef.current) / 1000));
        const mimeType = recorder.mimeType || 'audio/webm';
        const blob = new Blob(chunksRef.current, { type: mimeType });
        if (blob.size === 0) return;
        const dataUrl = await readBlobAsDataUrl(blob);
        const item: VoiceSampleItem = {
          id: `vsample_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          title: `Gravação_${samples.length + 1}.webm`,
          mimeType: mimeType.split(';')[0] || 'audio/webm',
          sizeBytes: blob.size,
          durationSec: elapsedSec,
          dataUrl,
          createdAtIso: new Date().toISOString(),
        };
        await onAddSample(item);
        setFeedback({ kind: 'ok', text: `Amostra "${item.title}" gravada (${elapsedSec}s).` });
      };

      mediaRecorderRef.current = recorder;
      recorder.start();
      setIsRecording(true);
      timerRef.current = window.setInterval(() => {
        setRecordSeconds((s) => s + 1);
      }, 1000);
    } catch {
      setFeedback({
        kind: 'error',
        text: 'Microfone indisponível ou permissão negada. Você pode subir um arquivo de áudio abaixo.',
      });
    }
  };

  const handleUploadSamples = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setFeedback(null);
    let added = 0;

    for (const file of Array.from(files)) {
      if (file.size > MAX_SAMPLE_BYTES) {
        setFeedback({
          kind: 'error',
          text: `"${file.name}" excede 6 MB. Envie trechos curtos de 5s a 30s para melhor treinamento.`,
        });
        continue;
      }
      const dataUrl = await readBlobAsDataUrl(file);
      const item: VoiceSampleItem = {
        id: `vsample_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        title: file.name,
        mimeType: file.type || 'audio/wav',
        sizeBytes: file.size,
        durationSec: Math.max(1, Math.round(file.size / 16000)),
        dataUrl,
        createdAtIso: new Date().toISOString(),
      };
      await onAddSample(item);
      added++;
    }

    if (added > 0) {
      setFeedback({
        kind: 'ok',
        text: `${added} amostra(s) de áudio adicionada(s) para treinamento.`,
      });
    }
  };

  const handleTrainVoice = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);

    const cleanName = profileName.trim();
    if (!cleanName) {
      setFeedback({
        kind: 'error',
        text: 'Dê um nome para a voz personalizada antes de iniciar o treinamento.',
      });
      return;
    }
    if (samples.length === 0) {
      setFeedback({
        kind: 'error',
        text: 'Grave pelo menos uma frase no microfone ou suba uma amostra de áudio.',
      });
      return;
    }

    setIsTraining(true);
    try {
      if (!isOnline) {
        const offlineProfile = await analyzeAudioOfflineAcoustic(
          samples[0].dataUrl,
          cleanName,
          samples.length
        );
        await onSaveProfile(offlineProfile);
        setProfileName('');
        setVoiceNotes('');
        setFeedback({
          kind: 'ok',
          text: `Perfil "${offlineProfile.name}" calibrado offline e ativado no ZAPIA!`,
        });
        return;
      }

      const payloadSamples = samples.slice(0, 3).map((s) => {
        const commaIdx = s.dataUrl.indexOf(',');
        const base64 = commaIdx >= 0 ? s.dataUrl.slice(commaIdx + 1) : s.dataUrl;
        return {
          title: s.title,
          mimeType: s.mimeType || 'audio/webm',
          base64,
        };
      });

      const res = await fetch('/api/ai/train-voice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          profileName: cleanName,
          samples: payloadSamples,
          additionalContext: voiceNotes.trim() || undefined,
        }),
        signal: AbortSignal.timeout(25000),
      });

      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(err.error || 'Falha ao analisar as amostras de voz na IA.');
      }

      const data = (await res.json()) as {
        gender?: string;
        recommendedBaseVoice?: string;
        recommendedSpeed?: number;
        recommendedPitch?: number;
        recommendedWarmth?: number;
        vocalStylePrompt?: string;
        timbreNotes?: string;
      };

      const profile = normalizeTrainedVoiceAnalysis({
        profileName: cleanName,
        ...data,
        sampleCount: samples.length,
      });

      await onSaveProfile(profile);
      setProfileName('');
      setVoiceNotes('');
      setFeedback({
        kind: 'ok',
        text: `Voz "${profile.name}" treinada e ativada! Base calibrada: ${profile.baseModelId}.`,
      });
    } catch (err: unknown) {
      const msg =
        err instanceof Error && err.name === 'TimeoutError'
          ? 'O servidor demorou para analisar o áudio. Tente uma amostra mais curta (5s–15s) ou ative o modo offline.'
          : err instanceof Error
            ? err.message
            : 'Erro ao treinar voz personalizada.';
      setFeedback({
        kind: 'error',
        text: msg,
      });
    } finally {
      setIsTraining(false);
    }
  };

  const handlePreviewTrainedProfile = async (profile: TrainedVoiceProfile) => {
    if (previewingId === profile.id) {
      zapiaSpeech.stop();
      setPreviewingId(null);
      return;
    }
    await zapiaSpeech.speak({
      text: `Olá, Moisés! Aqui é a sua voz personalizada "${profile.name}" emulando o timbre e a cadência treinados no ZAPIA.`,
      overrideTrainedProfile: profile,
      settings,
      isOnline,
      onStart: () => setPreviewingId(profile.id),
      onEnd: () => setPreviewingId(null),
      onError: (msg) => setFeedback({ kind: 'error', text: msg }),
    });
  };

  const activeProfileId = settings.trainedVoiceProfile?.active
    ? settings.trainedVoiceProfile.id
    : null;

  return (
    <section
      aria-labelledby="voice-training-heading"
      className="rounded-2xl border border-[var(--zapia-border)] bg-[var(--zapia-surface)] p-5 sm:p-6 space-y-5"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <AudioWaveform className="w-5 h-5 shrink-0 text-[var(--zapia-accent)]" />
          <div>
            <h2
              id="voice-training-heading"
              className="text-lg font-semibold text-[var(--zapia-text)]"
            >
              Treinamento de Voz
            </h2>
            <p className="text-xs text-[var(--zapia-muted)]">
              Grave ou suba amostras de áudio para o ZAPIA analisar seu timbre e emular uma voz personalizada.
            </p>
          </div>
        </div>
        <span className="text-xs font-mono-tabular text-[var(--zapia-muted)]">
          {samples.length} amostra(s) · {profiles.length} perfil(is)
        </span>
      </div>

      {/* Prompt guide + Capture controls */}
      <div className="rounded-xl border border-[var(--zapia-border)] bg-[var(--zapia-bg)] p-4 space-y-3">
        <p className="text-xs text-[var(--zapia-muted)]">
          Sugestão de leitura para gravar (5–15s):{' '}
          <span className="text-[var(--zapia-text)] italic">
            &ldquo;Olá ZAPIA, quero treinar esta voz com minha cadência natural, clareza e energia para nossas conversas diárias.&rdquo;
          </span>
        </p>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={toggleRecordingSample}
            className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-full text-xs font-semibold transition-colors ${
              isRecording
                ? 'bg-rose-600 text-white'
                : 'bg-[var(--zapia-accent)] text-[var(--zapia-accent-fg)] hover:opacity-90'
            }`}
          >
            {isRecording ? (
              <>
                <Square className="w-3.5 h-3.5 fill-current" />
                <span>
                  Parar Gravação (00:{String(recordSeconds).padStart(2, '0')})
                </span>
              </>
            ) : (
              <>
                <Mic className="w-4 h-4" />
                <span>Gravar Amostra</span>
              </>
            )}
          </button>

          <label className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full border border-[var(--zapia-border)] bg-[var(--zapia-surface)] text-xs font-semibold text-[var(--zapia-text)] hover:border-[var(--zapia-accent)] cursor-pointer transition-colors">
            <Upload className="w-4 h-4 text-[var(--zapia-accent)]" />
            <span>Subir Áudio</span>
            <input
              type="file"
              accept="audio/*"
              multiple
              aria-label="Subir amostras de áudio para treinamento de voz"
              onChange={(e) => {
                handleUploadSamples(e.target.files);
                e.target.value = '';
              }}
              className="sr-only"
            />
          </label>
        </div>

        {/* Recorded / Uploaded Samples List */}
        {samples.length > 0 && (
          <div className="space-y-2 pt-2 border-t border-[var(--zapia-border)]">
            {samples.map((sample) => (
              <div
                key={sample.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 p-3 rounded-xl border border-[var(--zapia-border)] bg-[var(--zapia-surface)]"
              >
                <div className="flex items-center justify-between gap-2 min-w-0 flex-1">
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-semibold text-[var(--zapia-text)] truncate">
                      {sample.title}
                    </div>
                    <div className="text-[11px] font-mono-tabular text-[var(--zapia-muted)] whitespace-nowrap">
                      ~{sample.durationSec}s · {(sample.sizeBytes / 1024).toFixed(0)} KB
                    </div>
                  </div>
                  <button
                    type="button"
                    aria-label={`Remover amostra ${sample.title}`}
                    onClick={() => onDeleteSample(sample.id)}
                    className="sm:hidden p-2 rounded-lg text-[var(--zapia-muted)] hover:text-rose-500 shrink-0"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <audio controls src={sample.dataUrl} className="h-8 w-full sm:w-[190px]" />
                  <button
                    type="button"
                    aria-label={`Remover amostra ${sample.title}`}
                    onClick={() => onDeleteSample(sample.id)}
                    className="hidden sm:inline-flex p-2 rounded-lg text-[var(--zapia-muted)] hover:text-rose-500 shrink-0"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Training Form */}
      <form onSubmit={handleTrainVoice} className="space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label htmlFor="trained-voice-name" className="block text-xs text-[var(--zapia-muted)] mb-1">
              Nome da Voz Personalizada
            </label>
            <input
              id="trained-voice-name"
              type="text"
              value={profileName}
              onChange={(e) => setProfileName(e.target.value)}
              placeholder="Ex: Voz do Moisés, Narrador Firme..."
              className="w-full px-3.5 py-2.5 rounded-xl border border-[var(--zapia-border)] bg-[var(--zapia-bg)] text-xs sm:text-sm text-[var(--zapia-text)]"
            />
          </div>
          <div>
            <label htmlFor="trained-voice-notes" className="block text-xs text-[var(--zapia-muted)] mb-1">
              Direção Adicional (opcional)
            </label>
            <input
              id="trained-voice-notes"
              type="text"
              value={voiceNotes}
              onChange={(e) => setVoiceNotes(e.target.value)}
              placeholder="Ex: Tom calmo, pausas naturais e ritmo ágil"
              className="w-full px-3.5 py-2.5 rounded-xl border border-[var(--zapia-border)] bg-[var(--zapia-bg)] text-xs sm:text-sm text-[var(--zapia-text)]"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          {feedback ? (
            <p
              role="status"
              className={`text-xs ${
                feedback.kind === 'ok' ? 'text-emerald-400' : 'text-amber-400'
              }`}
            >
              {feedback.text}
            </p>
          ) : (
            <span className="text-[11px] text-[var(--zapia-muted)]">
              Suporta MP3, WAV, WebM, OGG e M4A. A emulação ajusta timbre, cadência e prosódia do ZAPIA.
            </span>
          )}

          <button
            type="submit"
            disabled={isTraining}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-white text-[#111113] text-xs font-semibold hover:bg-neutral-200 disabled:opacity-60 transition-colors shrink-0"
          >
            {isTraining ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Treinando Emulação...</span>
              </>
            ) : (
              <>
                <Wand2 className="w-4 h-4" />
                <span>Treinar Voz com IA</span>
              </>
            )}
          </button>
        </div>
      </form>

      {/* Trained Custom Voice Profiles */}
      {profiles.length > 0 && (
        <div className="space-y-2.5 pt-3 border-t border-[var(--zapia-border)]">
          <div className="text-xs font-semibold text-[var(--zapia-text)]">
            Perfis de Voz Treinados
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {profiles.map((prof) => {
              const isActive = activeProfileId === prof.id;
              return (
                <div
                  key={prof.id}
                  className={`rounded-xl border p-3.5 space-y-2.5 transition-colors ${
                    isActive
                      ? 'border-[var(--zapia-accent)] bg-[var(--zapia-accent-soft)]'
                      : 'border-[var(--zapia-border)] bg-[var(--zapia-bg)]'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold text-[var(--zapia-text)] truncate">
                          {prof.name}
                        </span>
                        {isActive && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-600/20 text-emerald-400 text-[10px] font-semibold">
                            <CheckCircle2 className="w-3 h-3" />
                            <span>Voz Ativa</span>
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-[var(--zapia-muted)]">
                        Base {prof.baseModelId} ({prof.gender}) · {prof.sampleCount} amostra(s)
                      </p>
                    </div>
                    <button
                      type="button"
                      aria-label={`Excluir perfil treinado ${prof.name}`}
                      onClick={() => onDeleteProfile(prof.id)}
                      className="p-1.5 rounded-lg text-[var(--zapia-muted)] hover:text-rose-500 shrink-0"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <p className="text-xs text-[var(--zapia-muted)] line-clamp-2">
                    {prof.timbreNotes}
                  </p>

                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => onActivateProfile(isActive ? null : prof.id)}
                      className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                        isActive
                          ? 'bg-emerald-600 text-white'
                          : 'bg-white text-[#111113] hover:bg-neutral-200'
                      }`}
                    >
                      {isActive ? 'Desativar Emulação' : 'Ativar no ZAPIA'}
                    </button>
                    <button
                      type="button"
                      onClick={() => handlePreviewTrainedProfile(prof)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-[var(--zapia-border)] bg-[var(--zapia-surface)] text-xs font-medium text-[var(--zapia-text)] hover:border-[var(--zapia-accent)]"
                    >
                      <Volume2 className="w-3.5 h-3.5 text-[var(--zapia-accent)]" />
                      <span>
                        {previewingId === prof.id ? 'Parar' : 'Ouvir Emulação'}
                      </span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
};
