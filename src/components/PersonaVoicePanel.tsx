import React, { useEffect, useState } from 'react';
import {
  Brain,
  Plus,
  Sliders,
  Trash2,
  Volume2,
  Square,
  Check,
  Radio,
  Sparkles,
  Heart,
} from 'lucide-react';
import {
  PERSONA_PROFILES,
  PersonaId,
  TrainedVoiceProfile,
  VOICE_EFFECT_PRESETS,
  VOICE_MODEL_CATALOG,
  VoiceEffectId,
  VoiceGenderMode,
  VoiceSampleItem,
  speedToPlaybackRate,
  summarizeSelfKnowledgeInsights,
  toneToPitchRatio,
} from '../utils/zapiaLogic';
import { LocalDailyCheckin, LocalPreference, ZapiaSettingsState } from '../utils/offlineDb';
import { zapiaSpeech } from '../utils/speechPlayer';
import { VoiceTrainingSection } from './VoiceTrainingSection';

interface PersonaVoicePanelProps {
  settings: ZapiaSettingsState;
  preferences: LocalPreference[];
  dailyCheckins?: LocalDailyCheckin[];
  voiceSamples?: VoiceSampleItem[];
  trainedProfiles?: TrainedVoiceProfile[];
  isOnline?: boolean;
  onUpdateSettings: (patch: Partial<ZapiaSettingsState>) => void;
  onAddPreference: (category: LocalPreference['category'], key: string, value: string) => void;
  onDeletePreference: (id: string) => void;
  onSaveDailyCheckin?: (checkin: Omit<LocalDailyCheckin, 'id' | 'dateIso' | 'createdAtIso'>) => Promise<void>;
  onAskSelfKnowledgeAi?: (prompt: string) => Promise<void> | void;
  onAddVoiceSample?: (sample: VoiceSampleItem) => Promise<void>;
  onDeleteVoiceSample?: (id: string) => Promise<void>;
  onSaveTrainedProfile?: (profile: TrainedVoiceProfile) => Promise<void>;
  onActivateTrainedProfile?: (id: string | null) => Promise<void>;
  onDeleteTrainedProfile?: (id: string) => Promise<void>;
}

export const PersonaVoicePanel: React.FC<PersonaVoicePanelProps> = ({
  settings,
  preferences,
  dailyCheckins = [],
  voiceSamples = [],
  trainedProfiles = [],
  isOnline = true,
  onUpdateSettings,
  onAddPreference,
  onDeletePreference,
  onSaveDailyCheckin,
  onAskSelfKnowledgeAi,
  onAddVoiceSample,
  onDeleteVoiceSample,
  onSaveTrainedProfile,
  onActivateTrainedProfile,
  onDeleteTrainedProfile,
}) => {
  const [newPrefKey, setNewPrefKey] = useState('');
  const [newPrefValue, setNewPrefValue] = useState('');
  const [newPrefCategory, setNewPrefCategory] = useState<LocalPreference['category']>('rotina');
  const [isTestingVoice, setIsTestingVoice] = useState(false);
  const [activeTestVoice, setActiveTestVoice] = useState<string | null>(null);
  const [testPhrase, setTestPhrase] = useState(
    'Olá, Moisés! Esta é uma demonstração em tempo real da minha cadência, timbre e personalidade no ZAPIA.'
  );
  const [voiceFeedback, setVoiceFeedback] = useState<string | null>(null);

  const [checkinMood, setCheckinMood] = useState<LocalDailyCheckin['mood']>('focado');
  const [checkinEnergy, setCheckinEnergy] = useState(8);
  const [checkinGoal, setCheckinGoal] = useState('');
  const [checkinReflection, setCheckinReflection] = useState('');
  const [checkinSavedMsg, setCheckinSavedMsg] = useState<string | null>(null);

  const voicePitch = settings.voicePitch ?? 50;
  const playbackRate = speedToPlaybackRate(settings.speed);
  const pitchRatio = toneToPitchRatio(voicePitch);

  // Modulate active audio playback speed in real time whenever the cadence slider moves
  useEffect(() => {
    zapiaSpeech.applyLiveParameters(settings.speed);
  }, [settings.speed]);

  const handleAddPrefSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPrefKey.trim() || !newPrefValue.trim()) return;
    onAddPreference(newPrefCategory, newPrefKey.trim(), newPrefValue.trim());
    setNewPrefKey('');
    setNewPrefValue('');
  };

  const handlePreviewVoice = async (overrideVoice?: string) => {
    setVoiceFeedback(null);
    if (isTestingVoice && !overrideVoice) {
      zapiaSpeech.stop();
      setIsTestingVoice(false);
      setActiveTestVoice(null);
      return;
    }

    await zapiaSpeech.speak({
      text: testPhrase.trim() || 'ZAPIA pronto para ajudar você em tempo real.',
      overrideVoiceName: overrideVoice,
      settings,
      isOnline,
      onStart: (voiceLabel) => {
        setIsTestingVoice(true);
        setActiveTestVoice(voiceLabel);
      },
      onEnd: () => {
        setIsTestingVoice(false);
        setActiveTestVoice(null);
      },
      onError: (msg) => {
        setVoiceFeedback(msg);
      },
    });
  };

  const maleModels = VOICE_MODEL_CATALOG.filter((m) => m.gender === 'masculina');
  const femaleModels = VOICE_MODEL_CATALOG.filter((m) => m.gender === 'feminina');

  const pitchDescription =
    voicePitch > 62 ? 'Agudo / Brilhante' : voicePitch < 38 ? 'Grave / Encorpado' : 'Natural Equilibrado';

  const selfKnowledgeSummary = summarizeSelfKnowledgeInsights(dailyCheckins);

  return (
    <div className="space-y-6">
      {/* Real-Time Voice Studio Control Panel */}
      <section className="rounded-2xl border border-[var(--zapia-border)] bg-[var(--zapia-surface)] p-5 sm:p-6 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <Radio className="w-5 h-5 text-[var(--zapia-accent)]" />
            <div>
              <h2 className="text-lg font-semibold text-[var(--zapia-text)]">
                Controle de Voz em Tempo Real
              </h2>
              <p className="text-xs text-[var(--zapia-muted)]">
                Selecione modelos masculinos ou femininos e ajuste cadência, tom e calor ao vivo.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => handlePreviewVoice()}
            data-testid="test-voice-btn"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full bg-[var(--zapia-accent)] text-[var(--zapia-accent-fg)] text-xs font-semibold hover:opacity-90 transition-opacity whitespace-nowrap shrink-0 min-h-[40px]"
          >
            {isTestingVoice ? (
              <>
                <Square className="w-3.5 h-3.5 fill-current" />
                <span>Parar Prévia ({activeTestVoice})</span>
              </>
            ) : (
              <>
                <Volume2 className="w-4 h-4" />
                <span>Testar Voz em Tempo Real</span>
              </>
            )}
          </button>
        </div>

        {/* Mode Selector (Masculina / Feminina / Alternada) */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-[var(--zapia-muted)]">
              Modo de Reprodução das Respostas
            </span>
            <span className="text-xs font-mono-tabular text-[var(--zapia-text)]">
              {settings.voiceGender === 'alternada'
                ? `${settings.preferredMaleVoice} ↔ ${settings.preferredFemaleVoice}`
                : settings.voiceGender === 'masculina'
                  ? settings.preferredMaleVoice
                  : settings.preferredFemaleVoice}
            </span>
          </div>
          <div className="grid grid-cols-3 gap-1.5 p-1 rounded-xl bg-[var(--zapia-surface-alt)] border border-[var(--zapia-border)]">
            {(['masculina', 'feminina', 'alternada'] as VoiceGenderMode[]).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => onUpdateSettings({ voiceGender: mode })}
                className={`py-2.5 px-2 rounded-lg text-xs font-semibold capitalize transition-colors ${
                  settings.voiceGender === mode
                    ? 'bg-[var(--zapia-accent)] text-[var(--zapia-accent-fg)]'
                    : 'text-[var(--zapia-muted)] hover:text-[var(--zapia-text)]'
                }`}
              >
                {mode === 'alternada' ? 'Alternada (M/F)' : mode}
              </button>
            ))}
          </div>
        </div>

        {/* Voice Model Cards (Male & Female) */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="space-y-2.5">
            <div className="text-xs font-semibold text-[var(--zapia-text)]">
              Modelos de Voz Masculina
            </div>
            <div className="space-y-2">
              {maleModels.map((model) => {
                const selected = settings.preferredMaleVoice === model.id;
                return (
                  <div
                    key={model.id}
                    className={`flex items-center justify-between gap-2 p-3 rounded-xl border transition-colors ${
                      selected
                        ? 'border-[var(--zapia-accent)] bg-[var(--zapia-accent-soft)]'
                        : 'border-[var(--zapia-border)] bg-[var(--zapia-bg)]'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => onUpdateSettings({ preferredMaleVoice: model.id })}
                      className="flex-1 text-left min-w-0"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-[var(--zapia-text)]">
                          {model.label}
                        </span>
                        {selected && <Check className="w-3.5 h-3.5 text-[var(--zapia-accent)]" />}
                      </div>
                      <p className="text-xs text-[var(--zapia-muted)] truncate">
                        {model.timbre} · {model.recommendedFor}
                      </p>
                    </button>
                    <button
                      type="button"
                      aria-label={`Ouvir prévia da voz masculina ${model.label}`}
                      onClick={() => {
                        onUpdateSettings({ preferredMaleVoice: model.id });
                        handlePreviewVoice(model.id);
                      }}
                      className="p-2 rounded-lg border border-[var(--zapia-border)] bg-[var(--zapia-surface)] hover:border-[var(--zapia-accent)] text-xs shrink-0"
                    >
                      <Volume2 className="w-4 h-4 text-[var(--zapia-accent)]" />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="space-y-2.5">
            <div className="text-xs font-semibold text-[var(--zapia-text)]">
              Modelos de Voz Feminina
            </div>
            <div className="space-y-2">
              {femaleModels.map((model) => {
                const selected = settings.preferredFemaleVoice === model.id;
                return (
                  <div
                    key={model.id}
                    className={`flex items-center justify-between gap-2 p-3 rounded-xl border transition-colors ${
                      selected
                        ? 'border-[var(--zapia-accent)] bg-[var(--zapia-accent-soft)]'
                        : 'border-[var(--zapia-border)] bg-[var(--zapia-bg)]'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => onUpdateSettings({ preferredFemaleVoice: model.id })}
                      className="flex-1 text-left min-w-0"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-[var(--zapia-text)]">
                          {model.label}
                        </span>
                        {selected && <Check className="w-3.5 h-3.5 text-[var(--zapia-accent)]" />}
                      </div>
                      <p className="text-xs text-[var(--zapia-muted)] truncate">
                        {model.timbre} · {model.recommendedFor}
                      </p>
                    </button>
                    <button
                      type="button"
                      aria-label={`Ouvir prévia da voz feminina ${model.label}`}
                      onClick={() => {
                        onUpdateSettings({ preferredFemaleVoice: model.id });
                        handlePreviewVoice(model.id);
                      }}
                      className="p-2 rounded-lg border border-[var(--zapia-border)] bg-[var(--zapia-surface)] hover:border-[var(--zapia-accent)] text-xs shrink-0"
                    >
                      <Volume2 className="w-4 h-4 text-[var(--zapia-accent)]" />
                    </button>
                  </div>
                );
              })}

              {/* Auto-speak toggle card */}
              <div className="p-3 rounded-xl border border-[var(--zapia-border)] bg-[var(--zapia-bg)] flex items-center justify-between gap-3">
                <div>
                  <div className="text-xs font-semibold text-[var(--zapia-text)]">
                    Falar respostas automaticamente
                  </div>
                  <p className="text-[11px] text-[var(--zapia-muted)]">
                    Reproduz a voz escolhida assim que o ZAPIA responder no chat.
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={settings.autoSpeak}
                  onClick={() => onUpdateSettings({ autoSpeak: !settings.autoSpeak })}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors shrink-0 ${
                    settings.autoSpeak
                      ? 'bg-emerald-600 text-white'
                      : 'bg-[var(--zapia-surface-alt)] text-[var(--zapia-muted)] border border-[var(--zapia-border)]'
                  }`}
                >
                  {settings.autoSpeak ? 'Ativo' : 'Manual'}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Real-time Sliders: Cadence, Vocal Pitch/Tone, Warmth */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2 border-t border-[var(--zapia-border)]">
          <div className="p-3.5 rounded-xl border border-[var(--zapia-border)] bg-[var(--zapia-bg)] space-y-2">
            <div className="flex justify-between text-xs">
              <label htmlFor="speed-range" className="font-semibold text-[var(--zapia-text)]">
                Cadência da Fala
              </label>
              <span className="font-mono-tabular font-semibold text-[var(--zapia-accent)]" data-testid="cadence-readout">
                {playbackRate.toFixed(2)}x
              </span>
            </div>
            <input
              id="speed-range"
              type="range"
              min={0}
              max={100}
              value={settings.speed}
              onChange={(e) => onUpdateSettings({ speed: Number(e.target.value) })}
              className="w-full accent-[var(--zapia-accent)]"
            />
            <div className="flex justify-between text-[11px] text-[var(--zapia-muted)]">
              <span>0.75x Lenta</span>
              <span>1.05x Normal</span>
              <span>1.35x Ágil</span>
            </div>
          </div>

          <div className="p-3.5 rounded-xl border border-[var(--zapia-border)] bg-[var(--zapia-bg)] space-y-2">
            <div className="flex justify-between text-xs">
              <label htmlFor="pitch-range" className="font-semibold text-[var(--zapia-text)]">
                Tom Vocal (Altura)
              </label>
              <span className="font-mono-tabular font-semibold text-[var(--zapia-accent)]" data-testid="pitch-readout">
                {pitchRatio.toFixed(2)} ({pitchDescription})
              </span>
            </div>
            <input
              id="pitch-range"
              type="range"
              min={0}
              max={100}
              value={voicePitch}
              onChange={(e) => onUpdateSettings({ voicePitch: Number(e.target.value) })}
              className="w-full accent-[var(--zapia-accent)]"
            />
            <div className="flex justify-between text-[11px] text-[var(--zapia-muted)]">
              <span>Grave</span>
              <span>Natural</span>
              <span>Agudo</span>
            </div>
          </div>

          <div className="p-3.5 rounded-xl border border-[var(--zapia-border)] bg-[var(--zapia-bg)] space-y-2">
            <div className="flex justify-between text-xs">
              <label htmlFor="warmth-range" className="font-semibold text-[var(--zapia-text)]">
                Calor & Emoção
              </label>
              <span className="font-mono-tabular font-semibold text-[var(--zapia-accent)]" data-testid="warmth-readout">
                {settings.warmth}%
              </span>
            </div>
            <input
              id="warmth-range"
              type="range"
              min={0}
              max={100}
              value={settings.warmth}
              onChange={(e) => onUpdateSettings({ warmth: Number(e.target.value) })}
              className="w-full accent-[var(--zapia-accent)]"
            />
            <div className="flex justify-between text-[11px] text-[var(--zapia-muted)]">
              <span>Sóbrio</span>
              <span>Equilibrado</span>
              <span>Caloroso</span>
            </div>
          </div>
        </div>

        {/* Editable Live Test Phrase */}
        <div className="space-y-1.5">
          <label htmlFor="voice-test-phrase" className="block text-xs text-[var(--zapia-muted)]">
            Frase de teste em tempo real
          </label>
          <input
            id="voice-test-phrase"
            type="text"
            value={testPhrase}
            onChange={(e) => setTestPhrase(e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-xl border border-[var(--zapia-border)] bg-[var(--zapia-bg)] text-xs sm:text-sm text-[var(--zapia-text)]"
          />
          {voiceFeedback && (
            <p className="text-xs text-amber-500 pt-1" role="status">
              {voiceFeedback}
            </p>
          )}
        </div>

        {/* Voz com Efeitos (DSP Web Audio API) */}
        <div className="space-y-2.5 pt-3 border-t border-[var(--zapia-border)]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-semibold text-[var(--zapia-text)]">
              <Sparkles className="w-4 h-4 text-[var(--zapia-accent)]" />
              <span>Efeitos de Voz em Tempo Real</span>
            </div>
            <span className="text-[11px] text-[var(--zapia-muted)]">
              Ativo:{' '}
              {VOICE_EFFECT_PRESETS.find((e) => e.id === (settings.voiceEffect || 'natural'))?.label}
            </span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            {VOICE_EFFECT_PRESETS.map((preset) => {
              const selected = (settings.voiceEffect || 'natural') === preset.id;
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() =>
                    onUpdateSettings({ voiceEffect: preset.id as VoiceEffectId })
                  }
                  className={`p-2.5 rounded-xl border text-left transition-colors ${
                    selected
                      ? 'border-[var(--zapia-accent)] bg-[var(--zapia-accent-soft)] text-[var(--zapia-text)]'
                      : 'border-[var(--zapia-border)] bg-[var(--zapia-bg)] text-[var(--zapia-muted)] hover:text-[var(--zapia-text)]'
                  }`}
                >
                  <div className="text-xs font-semibold">{preset.label}</div>
                  <div className="text-[10px] opacity-80 line-clamp-2">{preset.description}</div>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* Treinamento de Voz Personalizada */}
      {onAddVoiceSample &&
        onDeleteVoiceSample &&
        onSaveTrainedProfile &&
        onActivateTrainedProfile &&
        onDeleteTrainedProfile && (
          <VoiceTrainingSection
            samples={voiceSamples}
            profiles={trainedProfiles}
            settings={settings}
            isOnline={isOnline}
            onAddSample={onAddVoiceSample}
            onDeleteSample={onDeleteVoiceSample}
            onSaveProfile={onSaveTrainedProfile}
            onActivateProfile={onActivateTrainedProfile}
            onDeleteProfile={onDeleteTrainedProfile}
          />
        )}

      {/* Treinamento com Autoconhecimento Diário */}
      {onSaveDailyCheckin && (
        <section className="rounded-2xl border border-[var(--zapia-border)] bg-[var(--zapia-surface)] p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Heart className="w-5 h-5 text-[var(--zapia-accent)]" />
              <div>
                <h3 className="text-base font-semibold text-[var(--zapia-text)]">
                  Treinamento com Autoconhecimento Diário
                </h3>
                <p className="text-xs text-[var(--zapia-muted)]">
                  O ZAPIA adapta o tom, ritmo e sugestões conforme seu estado emocional e meta de hoje.
                </p>
              </div>
            </div>
            <span className="text-xs font-mono-tabular text-[var(--zapia-muted)]">
              {dailyCheckins.length} check-in(s)
            </span>
          </div>

          <div
            data-testid="self-knowledge-summary"
            className="p-3.5 rounded-xl border border-[var(--zapia-border)] bg-[var(--zapia-bg)] flex flex-wrap items-center justify-between gap-3"
          >
            <div className="min-w-0 flex-1 space-y-0.5">
              <div className="text-xs font-semibold text-[var(--zapia-text)]">
                IA de Autoconhecimento · Panorama Atual
              </div>
              <p className="text-xs text-[var(--zapia-muted)] leading-relaxed">
                {selfKnowledgeSummary.summaryText}
              </p>
            </div>
            {onAskSelfKnowledgeAi && (
              <button
                type="button"
                onClick={() => onAskSelfKnowledgeAi(selfKnowledgeSummary.suggestedCoachPrompt)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-[var(--zapia-accent)] text-[var(--zapia-accent-fg)] text-xs font-semibold hover:opacity-90 transition-opacity whitespace-nowrap shrink-0"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Analisar Evolução com IA</span>
              </button>
            )}
          </div>

          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (!checkinGoal.trim() && !checkinReflection.trim()) return;
              await onSaveDailyCheckin({
                mood: checkinMood,
                energy: checkinEnergy,
                focusGoal: checkinGoal.trim() || 'Manter clareza e produtividade',
                reflection: checkinReflection.trim() || 'Check-in registrado no dia.',
              });
              setCheckinGoal('');
              setCheckinReflection('');
              setCheckinSavedMsg('Check-in diário salvo! ZAPIA ajustou seu perfil proativo.');
            }}
            className="space-y-3"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="checkin-mood" className="block text-xs text-[var(--zapia-muted)] mb-1">
                  Como está se sentindo hoje?
                </label>
                <select
                  id="checkin-mood"
                  value={checkinMood}
                  onChange={(e) => setCheckinMood(e.target.value as LocalDailyCheckin['mood'])}
                  className="w-full px-3 py-2.5 rounded-xl border border-[var(--zapia-border)] bg-[var(--zapia-bg)] text-xs text-[var(--zapia-text)]"
                >
                  <option value="focado">Focado e determinado</option>
                  <option value="motivado">Motivado e com alta energia</option>
                  <option value="criativo">Criativo e explorando ideias</option>
                  <option value="calmo">Calmo e reflexivo</option>
                  <option value="cansado">Cansado (precisa de ritmo leve)</option>
                </select>
              </div>
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <label htmlFor="checkin-energy" className="text-[var(--zapia-muted)]">
                    Nível de Energia
                  </label>
                  <span className="font-mono-tabular font-semibold text-[var(--zapia-accent)]">
                    {checkinEnergy}/10
                  </span>
                </div>
                <input
                  id="checkin-energy"
                  type="range"
                  min={1}
                  max={10}
                  value={checkinEnergy}
                  onChange={(e) => setCheckinEnergy(Number(e.target.value))}
                  className="w-full accent-[var(--zapia-accent)] mt-2"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input
                type="text"
                aria-label="Foco principal de hoje"
                value={checkinGoal}
                onChange={(e) => setCheckinGoal(e.target.value)}
                placeholder="Qual sua prioridade nº 1 de hoje?"
                className="px-3.5 py-2.5 rounded-xl border border-[var(--zapia-border)] bg-[var(--zapia-bg)] text-xs text-[var(--zapia-text)]"
              />
              <input
                type="text"
                aria-label="Reflexão ou hábito para melhorar"
                value={checkinReflection}
                onChange={(e) => setCheckinReflection(e.target.value)}
                placeholder="O que deseja aprender ou melhorar hoje?"
                className="px-3.5 py-2.5 rounded-xl border border-[var(--zapia-border)] bg-[var(--zapia-bg)] text-xs text-[var(--zapia-text)]"
              />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2">
              {checkinSavedMsg ? (
                <span className="text-xs text-emerald-400" role="status">
                  {checkinSavedMsg}
                </span>
              ) : (
                <span className="text-[11px] text-[var(--zapia-muted)]">
                  Salvo com segurança no cofre offline e usado apenas pelo seu ZAPIA.
                </span>
              )}
              <button
                type="submit"
                className="px-4 py-2 rounded-full bg-white text-[#111113] text-xs font-semibold hover:bg-neutral-200 transition-colors"
              >
                Registrar Autoconhecimento
              </button>
            </div>
          </form>

          {dailyCheckins.length > 0 && (
            <div className="space-y-2 pt-2 border-t border-[var(--zapia-border)] max-h-36 overflow-y-auto">
              {dailyCheckins.slice(0, 4).map((c) => (
                <div
                  key={c.id}
                  className="text-xs flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-xl bg-[var(--zapia-bg)] border border-[var(--zapia-border)]"
                >
                  <div className="min-w-0">
                    <span className="font-semibold capitalize text-[var(--zapia-text)]">
                      {c.mood} ({c.energy}/10)
                    </span>{' '}
                    · <span className="text-[var(--zapia-muted)]">{c.focusGoal}</span>
                  </div>
                  <span className="text-[11px] font-mono-tabular text-[var(--zapia-muted)]">
                    {new Date(c.createdAtIso).toLocaleDateString('pt-BR')}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Personality & Learned Memory Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="rounded-2xl border border-[var(--zapia-border)] bg-[var(--zapia-surface)] p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Sliders className="w-4 h-4 text-[var(--zapia-accent)]" />
            <h3 className="text-base font-semibold text-[var(--zapia-text)]">
              Personalidade do Assistente
            </h3>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {(Object.keys(PERSONA_PROFILES) as PersonaId[]).map((pid) => {
              const active = settings.persona === pid;
              return (
                <button
                  key={pid}
                  type="button"
                  onClick={() => onUpdateSettings({ persona: pid })}
                  className={`px-3 py-2.5 rounded-xl border text-left transition-colors ${
                    active
                      ? 'border-[var(--zapia-accent)] bg-[var(--zapia-accent-soft)] text-[var(--zapia-text)]'
                      : 'border-[var(--zapia-border)] bg-[var(--zapia-surface-alt)] text-[var(--zapia-muted)] hover:text-[var(--zapia-text)]'
                  }`}
                >
                  <div className="text-xs font-semibold">{PERSONA_PROFILES[pid].label}</div>
                </button>
              );
            })}
          </div>
          <p className="text-xs text-[var(--zapia-muted)]">
            {PERSONA_PROFILES[settings.persona].roleDescription}
          </p>
        </div>

        {/* Aprendizado Contínuo */}
        <div className="rounded-2xl border border-[var(--zapia-border)] bg-[var(--zapia-surface)] p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Brain className="w-4 h-4 text-[var(--zapia-accent)]" />
              <h3 className="text-base font-semibold text-[var(--zapia-text)]">
                Aprendizado Contínuo
              </h3>
            </div>
            <span className="text-xs font-mono-tabular text-[var(--zapia-muted)]">
              {preferences.length} registros
            </span>
          </div>

          <ul className="space-y-2.5 max-h-48 overflow-y-auto">
            {preferences.map((pref) => (
              <li
                key={pref.id}
                className="flex items-start justify-between gap-2 pb-2.5 border-b border-[var(--zapia-border)] last:border-b-0 last:pb-0"
              >
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-[var(--zapia-text)]">
                    {pref.key} · <span className="text-[var(--zapia-muted)] font-normal">{pref.category}</span>
                  </div>
                  <p className="text-xs text-[var(--zapia-muted)] break-words">{pref.value}</p>
                </div>
                <button
                  type="button"
                  aria-label={`Remover preferência ${pref.key}`}
                  onClick={() => onDeletePreference(pref.id)}
                  className="p-1.5 rounded-lg text-[var(--zapia-muted)] hover:text-rose-500 shrink-0"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </li>
            ))}
          </ul>

          <form onSubmit={handleAddPrefSubmit} className="space-y-2 pt-2 border-t border-[var(--zapia-border)]">
            <div className="grid grid-cols-2 gap-2">
              <input
                type="text"
                value={newPrefKey}
                onChange={(e) => setNewPrefKey(e.target.value)}
                placeholder="Ex: Horário foco"
                aria-label="Nome da preferência"
                className="px-3 py-2 rounded-lg border border-[var(--zapia-border)] bg-[var(--zapia-bg)] text-xs text-[var(--zapia-text)]"
              />
              <select
                value={newPrefCategory}
                onChange={(e) => setNewPrefCategory(e.target.value as LocalPreference['category'])}
                aria-label="Categoria da preferência"
                className="px-3 py-2 rounded-lg border border-[var(--zapia-border)] bg-[var(--zapia-bg)] text-xs text-[var(--zapia-text)]"
              >
                <option value="rotina">Rotina</option>
                <option value="voz">Voz</option>
                <option value="estilo">Estilo</option>
                <option value="atalho">Atalho</option>
                <option value="contato">Contato</option>
              </select>
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={newPrefValue}
                onChange={(e) => setNewPrefValue(e.target.value)}
                placeholder="Detalhe para o ZAPIA lembrar..."
                aria-label="Valor da preferência"
                className="flex-1 px-3 py-2 rounded-lg border border-[var(--zapia-border)] bg-[var(--zapia-bg)] text-xs text-[var(--zapia-text)]"
              />
              <button
                type="submit"
                aria-label="Adicionar preferência"
                className="px-3 py-2 rounded-lg bg-[var(--zapia-surface-alt)] border border-[var(--zapia-border)] text-xs font-medium text-[var(--zapia-text)] hover:border-[var(--zapia-accent)]"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
