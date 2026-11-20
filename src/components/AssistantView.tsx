import React, { useEffect, useRef, useState } from 'react';
import {
  Mic,
  MicOff,
  Plus,
  Send,
  Volume2,
  CheckCircle2,
  Loader2,
  Sliders,
  FolderLock,
  Images,
  Palette,
  ChevronLeft,
  ChevronRight,
  X,
  MessageSquarePlus,
  Gamepad2,
} from 'lucide-react';
import {
  PERSONA_PROFILES,
  ProactiveRadarCard,
  getPortugueseGreeting,
} from '../utils/zapiaLogic';
import {
  LocalMessage,
  LocalPreference,
  LocalThread,
  ZapiaSettingsState,
} from '../utils/offlineDb';
import { zapiaSpeech } from '../utils/speechPlayer';
import { PersonaVoicePanel } from './PersonaVoicePanel';

export interface SuggestedAction {
  type: 'reminder' | 'vault_note' | 'email_draft' | 'calendar_event' | 'optimize';
  label: string;
  payload: string;
}

interface AssistantViewProps {
  activeThread: LocalThread | null;
  messages: LocalMessage[];
  preferences: LocalPreference[];
  radarCards: ProactiveRadarCard[];
  settings: ZapiaSettingsState;
  isOnline: boolean;
  isSending: boolean;
  suggestedActions: SuggestedAction[];
  onUpdateSettings: (patch: Partial<ZapiaSettingsState>) => void;
  onSendMessage: (text: string) => Promise<void>;
  onExecuteSuggestedAction: (action: SuggestedAction) => void;
  onAddPreference: (category: LocalPreference['category'], key: string, value: string) => void;
  onDeletePreference: (id: string) => void;
  onQuickOpenWorkspace: (target: 'vault' | 'gallery' | 'schedule' | 'system' | 'settings' | 'code') => void;
  onNewChat: () => void;
  activeCustomModelName?: string | null;
}

export const AssistantView: React.FC<AssistantViewProps> = ({
  activeThread,
  messages,
  preferences,
  radarCards,
  settings,
  isOnline,
  isSending,
  suggestedActions,
  onUpdateSettings,
  onSendMessage,
  onExecuteSuggestedAction,
  onAddPreference,
  onDeletePreference,
  onQuickOpenWorkspace,
  onNewChat,
  activeCustomModelName,
}) => {
  const [input, setInput] = useState('');
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [activeCardIdx, setActiveCardIdx] = useState(0);
  const [dismissedCardIds, setDismissedCardIds] = useState<string[]>([]);
  const [plusMenuOpen, setPlusMenuOpen] = useState(false);
  const [voiceModalOpen, setVoiceModalOpen] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const lastAutoSpokenIdRef = useRef<string | null>(null);

  const visibleCards = radarCards.filter((c) => !dismissedCardIds.includes(c.id));
  const cardsToShow = visibleCards.length > 0 ? visibleCards : radarCards;
  const safeCardIdx = cardsToShow.length > 0 ? Math.min(activeCardIdx, cardsToShow.length - 1) : 0;
  const currentCard = cardsToShow[safeCardIdx];

  const isHomeMode = !activeThread && messages.length === 0;
  const greetingText = getPortugueseGreeting(settings.userName);

  useEffect(() => {
    if (!isHomeMode) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages.length, isHomeMode]);

  // Apply real-time cadence changes to active speech playback
  useEffect(() => {
    zapiaSpeech.applyLiveParameters(settings.speed);
  }, [settings.speed]);

  // Auto-speak new assistant responses when autoSpeak is enabled
  useEffect(() => {
    if (!settings.autoSpeak || messages.length === 0) return;
    const last = messages[messages.length - 1];
    if (last.role === 'assistant' && last.id !== lastAutoSpokenIdRef.current) {
      lastAutoSpokenIdRef.current = last.id;
      zapiaSpeech.speak({
        text: last.content,
        turnIndex: messages.length - 1,
        settings,
        isOnline,
        onStart: () => setSpeakingId(last.id),
        onEnd: () => setSpeakingId(null),
      });
    }
  }, [messages, settings.autoSpeak, settings, isOnline]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || isSending) return;
    setInput('');
    setPlusMenuOpen(false);
    await onSendMessage(trimmed);
  };

  const handleSpeak = async (msg: LocalMessage, index: number) => {
    setVoiceError(null);
    if (speakingId === msg.id) {
      zapiaSpeech.stop();
      setSpeakingId(null);
      return;
    }

    await zapiaSpeech.speak({
      text: msg.content,
      turnIndex: index,
      settings,
      isOnline,
      onStart: () => setSpeakingId(msg.id),
      onEnd: () => setSpeakingId(null),
      onError: (errMsg) => setVoiceError(errMsg),
    });
  };

  const toggleRecording = async () => {
    setVoiceError(null);
    if (isRecording) {
      mediaRecorderRef.current?.stop();
      setIsRecording(false);
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (ev) => {
        if (ev.data.size > 0) chunksRef.current.push(ev.data);
      };
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        const buf = await blob.arrayBuffer();
        const bytes = new Uint8Array(buf);
        let bin = '';
        for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
        const base64 = btoa(bin);
        try {
          const res = await fetch('/api/ai/transcribe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ audioBase64: base64, mimeType: blob.type || 'audio/webm' }),
          });
          if (res.ok) {
            const data = (await res.json()) as { text?: string };
            if (data.text) setInput((prev) => (prev ? `${prev} ${data.text}` : data.text!));
          }
        } catch {
          setVoiceError('Transcrição requer conexão ativa.');
        }
      };
      mediaRecorderRef.current = recorder;
      recorder.start();
      setIsRecording(true);
    } catch {
      setVoiceError('Permissão de microfone não concedida pelo navegador.');
    }
  };

  const handleSuggestionClick = async (
    s: ProactiveRadarCard['suggestions'][number]
  ) => {
    if (s.dismissOnly && currentCard) {
      setDismissedCardIds((prev) => [...prev, currentCard.id]);
      setActiveCardIdx(0);
      return;
    }
    if (s.openTab) {
      onQuickOpenWorkspace(s.openTab);
      return;
    }
    if (s.prompt) {
      await onSendMessage(s.prompt);
    }
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 h-[calc(100dvh-3.5rem)] justify-between max-w-4xl mx-auto w-full px-3 sm:px-6 pb-4">
      {/* Main Area: Either ZAPIA Home (Screenshot 1) or Active Conversation Thread */}
      {isHomeMode ? (
        <div className="flex-1 flex flex-col justify-between pt-4 sm:pt-8 pb-4">
          {/* Editorial Serif Greeting (Screenshot 1 Centerpiece) */}
          <div className="text-center pt-4 sm:pt-8 pb-6">
            <h1 className="font-editorial text-3xl sm:text-4xl font-normal tracking-tight text-[var(--zapia-text)]">
              {greetingText}
            </h1>
          </div>

          {/* Horizontal Peeking Radar Card Carousel */}
          {currentCard && (
            <div className="my-auto py-2">
              <div className="relative flex items-center justify-center gap-3 sm:gap-5 overflow-hidden px-1">
                {/* Left Peeking Card */}
                {cardsToShow.length > 1 && (
                  <button
                    type="button"
                    aria-label="Aviso anterior do Radar"
                    onClick={() =>
                      setActiveCardIdx((i) => (i - 1 + cardsToShow.length) % cardsToShow.length)
                    }
                    className="hidden sm:flex w-20 md:w-28 h-48 rounded-[28px] shrink-0 items-center justify-end p-4 opacity-90 hover:opacity-100 transition-opacity"
                    style={{
                      backgroundColor:
                        cardsToShow[(safeCardIdx - 1 + cardsToShow.length) % cardsToShow.length]
                          .cardBg || '#E5C267',
                    }}
                  >
                    <ChevronLeft className="w-5 h-5 text-[#141416]" />
                  </button>
                )}

                {/* Mobile subtle left edge peek */}
                {cardsToShow.length > 1 && (
                  <button
                    type="button"
                    aria-label="Cartão anterior"
                    onClick={() =>
                      setActiveCardIdx((i) => (i - 1 + cardsToShow.length) % cardsToShow.length)
                    }
                    className="sm:hidden -ml-8 w-12 h-44 rounded-r-[24px] shrink-0"
                    style={{
                      backgroundColor:
                        cardsToShow[(safeCardIdx - 1 + cardsToShow.length) % cardsToShow.length]
                          .cardBg || '#E5C267',
                    }}
                  />
                )}

                {/* Center Active Card */}
                <div
                  className="w-full max-w-[290px] sm:max-w-[360px] min-h-[190px] sm:min-h-[215px] rounded-[28px] p-6 sm:p-7 flex flex-col justify-between shadow-lg transition-colors"
                  style={{ backgroundColor: currentCard.cardBg }}
                >
                  <p className="font-editorial text-xl sm:text-2xl leading-snug text-[#141416] text-left">
                    {currentCard.headline}
                  </p>
                  <div className="flex items-center justify-between pt-4 text-xs text-[#141416]/70">
                    <span className="font-mono-tabular">
                      {safeCardIdx + 1} / {cardsToShow.length}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        onQuickOpenWorkspace(
                          currentCard.targetTab === 'assistant'
                            ? 'system'
                            : currentCard.targetTab || 'system'
                        )
                      }
                      className="font-semibold underline underline-offset-2 text-[#141416] hover:opacity-80"
                    >
                      Abrir detalhes
                    </button>
                  </div>
                </div>

                {/* Mobile subtle right edge peek */}
                {cardsToShow.length > 1 && (
                  <button
                    type="button"
                    aria-label="Próximo cartão"
                    onClick={() => setActiveCardIdx((i) => (i + 1) % cardsToShow.length)}
                    className="sm:hidden -mr-8 w-12 h-44 rounded-l-[24px] shrink-0"
                    style={{
                      backgroundColor:
                        cardsToShow[(safeCardIdx + 1) % cardsToShow.length].cardBg || '#EE966C',
                    }}
                  />
                )}

                {/* Right Peeking Card */}
                {cardsToShow.length > 1 && (
                  <button
                    type="button"
                    aria-label="Próximo aviso do Radar"
                    onClick={() => setActiveCardIdx((i) => (i + 1) % cardsToShow.length)}
                    className="hidden sm:flex w-20 md:w-28 h-48 rounded-[28px] shrink-0 items-center justify-start p-4 opacity-90 hover:opacity-100 transition-opacity"
                    style={{
                      backgroundColor:
                        cardsToShow[(safeCardIdx + 1) % cardsToShow.length].cardBg || '#EE966C',
                    }}
                  >
                    <ChevronRight className="w-5 h-5 text-[#141416]" />
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Right-Aligned Contextual Quick-Reply Chips (Screenshot 1) */}
          {currentCard && (
            <div className="flex flex-col items-end gap-2.5 pt-4 pb-2">
              {currentCard.suggestions.map((s) => (
                <button
                  key={s.label}
                  type="button"
                  onClick={() => handleSuggestionClick(s)}
                  className="px-4 py-2.5 rounded-full bg-[var(--zapia-surface-alt)] border border-[var(--zapia-border)] text-sm font-medium text-[var(--zapia-text)] hover:border-[var(--zapia-accent)] transition-colors text-right max-w-[90%]"
                >
                  {s.label}
                </button>
              ))}
            </div>
          )}
        </div>
      ) : (
        /* Active Chat Thread Feed */
        <div className="flex-1 flex flex-col pt-3 pb-2 min-h-0">
          {/* Compact Thread Context Bar */}
          <div className="flex flex-wrap items-center justify-between gap-2 pb-3 mb-3 border-b border-[var(--zapia-border)]">
            <div className="min-w-0">
              <h2 className="text-sm sm:text-base font-semibold truncate text-[var(--zapia-text)]">
                {activeThread?.title || 'Conversa ZAPIA'}
              </h2>
              <p className="text-xs text-[var(--zapia-muted)] truncate">
                {PERSONA_PROFILES[settings.persona].label} · Voz {settings.voiceGender} ·{' '}
                {activeCustomModelName ? `API: ${activeCustomModelName}` : isOnline ? 'Online' : 'Offline Seguro'}
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setVoiceModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[var(--zapia-surface)] border border-[var(--zapia-border)] text-xs font-medium hover:border-[var(--zapia-accent)] transition-colors whitespace-nowrap"
              >
                <Sliders className="w-3.5 h-3.5 text-[var(--zapia-accent)]" />
                <span>Voz & Persona</span>
              </button>
              <button
                type="button"
                onClick={onNewChat}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[var(--zapia-surface)] border border-[var(--zapia-border)] text-xs font-medium hover:border-[var(--zapia-accent)] transition-colors whitespace-nowrap"
              >
                <MessageSquarePlus className="w-3.5 h-3.5" />
                <span>Início</span>
              </button>
            </div>
          </div>

          {/* Messages Stream */}
          <div
            className="flex-1 overflow-y-auto space-y-4 pr-1 max-h-[calc(100dvh-16rem)]"
            data-testid="chat-messages"
          >
            {messages.map((msg, idx) => {
              const isUser = msg.role === 'user';
              return (
                <article
                  key={msg.id}
                  className={`flex flex-col gap-1.5 ${isUser ? 'items-end' : 'items-start'}`}
                >
                  <div className="flex items-center gap-2 text-xs text-[var(--zapia-muted)] px-1">
                    <span>{isUser ? settings.userName : 'ZAPIA'}</span>
                    <span aria-hidden="true">·</span>
                    <span>
                      {isUser
                        ? 'Você'
                        : `${PERSONA_PROFILES[msg.persona]?.label || 'Assistente'} · Voz ${msg.voiceName}`}
                    </span>
                  </div>
                  <div
                    className={`max-w-[90%] sm:max-w-[82%] rounded-3xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
                      isUser
                        ? 'bg-[var(--zapia-surface-alt)] border border-[var(--zapia-border)] text-[var(--zapia-text)]'
                        : 'bg-[var(--zapia-surface)] border border-[var(--zapia-border)] text-[var(--zapia-text)]'
                    }`}
                  >
                    {msg.content}
                  </div>
                  {!isUser && (
                    <button
                      type="button"
                      onClick={() => handleSpeak(msg, idx)}
                      aria-label={`Ouvir resposta de voz ${msg.voiceName}`}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium text-[var(--zapia-muted)] hover:text-[var(--zapia-text)] hover:bg-[var(--zapia-surface-alt)] transition-colors"
                    >
                      <Volume2 className="w-3.5 h-3.5 text-[var(--zapia-accent)]" />
                      <span>
                        {speakingId === msg.id ? 'Parar voz' : `Ouvir (${msg.voiceName})`}
                      </span>
                    </button>
                  )}
                </article>
              );
            })}

            {isSending && (
              <div className="flex items-center gap-2 text-xs text-[var(--zapia-muted)] py-2">
                <Loader2 className="w-4 h-4 animate-spin text-[var(--zapia-accent)]" />
                <span>ZAPIA está processando sua solicitação...</span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Suggested Proactive Actions from AI */}
          {suggestedActions.length > 0 && (
            <div className="pt-2 flex flex-wrap items-center gap-2">
              {suggestedActions.map((act, i) => (
                <button
                  key={`${act.type}-${i}`}
                  type="button"
                  onClick={() => onExecuteSuggestedAction(act)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full border border-[var(--zapia-border)] bg-[var(--zapia-surface-alt)] text-xs font-medium text-[var(--zapia-text)] hover:border-[var(--zapia-accent)] transition-colors"
                >
                  <CheckCircle2 className="w-3.5 h-3.5 text-[var(--zapia-accent)]" />
                  <span>{act.label}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Floating Bottom Composer Capsule (Screenshot 1) */}
      <div className="relative pt-2 shrink-0 pb-safe">
        {voiceError && (
          <p className="pb-2 text-xs text-amber-500 text-center" role="status">
            {voiceError}
          </p>
        )}

        {/* Quick '+' Action Popover */}
        {plusMenuOpen && (
          <div className="absolute bottom-20 left-0 z-30 w-64 rounded-2xl border border-[var(--zapia-border)] bg-[var(--zapia-surface)] p-2 shadow-xl space-y-1">
            <button
              type="button"
              onClick={() => {
                setPlusMenuOpen(false);
                onQuickOpenWorkspace('vault');
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-medium hover:bg-[var(--zapia-surface-alt)] text-left"
            >
              <FolderLock className="w-4 h-4 text-[var(--zapia-accent)]" />
              <span>Anexar no Cofre E2EE</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setPlusMenuOpen(false);
                onQuickOpenWorkspace('gallery');
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-medium hover:bg-[var(--zapia-surface-alt)] text-left"
            >
              <Images className="w-4 h-4 text-[var(--zapia-accent)]" />
              <span>Estúdio Foto & Vídeo HD</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setPlusMenuOpen(false);
                setVoiceModalOpen(true);
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-medium hover:bg-[var(--zapia-surface-alt)] text-left"
            >
              <Sliders className="w-4 h-4 text-[var(--zapia-accent)]" />
              <span>Personalizar Voz & Persona</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setPlusMenuOpen(false);
                onQuickOpenWorkspace('code');
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-medium hover:bg-[var(--zapia-surface-alt)] text-left"
            >
              <Gamepad2 className="w-4 h-4 text-[var(--zapia-accent)]" />
              <span>Criar Jogos, Apps & Código</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setPlusMenuOpen(false);
                onQuickOpenWorkspace('settings');
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-medium hover:bg-[var(--zapia-surface-alt)] text-left"
            >
              <Palette className="w-4 h-4 text-[var(--zapia-accent)]" />
              <span>Trocar Cores & Otimizar</span>
            </button>
          </div>
        )}

        <form
          onSubmit={handleSubmit}
          className="flex items-center gap-2 p-1.5 rounded-full bg-[var(--zapia-surface-alt)] border border-[var(--zapia-border)] shadow-md"
        >
          <button
            type="button"
            onClick={() => setPlusMenuOpen((v) => !v)}
            aria-label="Abrir ferramentas rápidas ZAPIA"
            className="w-11 h-11 rounded-full bg-[var(--zapia-surface)] border border-[var(--zapia-border)] flex items-center justify-center text-[var(--zapia-text)] hover:border-[var(--zapia-accent)] transition-colors shrink-0"
          >
            <Plus className={`w-5 h-5 transition-transform ${plusMenuOpen ? 'rotate-45' : ''}`} />
          </button>

          <label htmlFor="zapia-chat-input" className="sr-only">
            Pergunte-me qualquer coisa
          </label>
          <input
            id="zapia-chat-input"
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Pergunte-me qualquer coisa"
            className="flex-1 min-w-0 bg-transparent px-2 py-2.5 text-sm sm:text-base text-[var(--zapia-text)] placeholder:text-[var(--zapia-muted)] focus:outline-none"
          />

          {input.trim() ? (
            <button
              type="submit"
              disabled={isSending}
              aria-label="Enviar mensagem"
              className="w-11 h-11 rounded-full bg-white text-[#111113] flex items-center justify-center hover:bg-neutral-200 disabled:opacity-50 transition-colors shrink-0"
            >
              <Send className="w-4 h-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={toggleRecording}
              aria-label={isRecording ? 'Parar gravação de voz' : 'Gravar comando de voz'}
              className={`w-11 h-11 rounded-full flex items-center justify-center transition-colors shrink-0 ${
                isRecording
                  ? 'bg-rose-600 text-white'
                  : 'bg-[var(--zapia-surface)] border border-[var(--zapia-border)] text-[var(--zapia-text)] hover:border-[var(--zapia-accent)]'
              }`}
            >
              {isRecording ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
            </button>
          )}
        </form>
      </div>

      {/* Persona, Alternating Voices & Continuous Learning Modal */}
      {voiceModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto"
          role="dialog"
          aria-modal="true"
          aria-label="Personalidade, Vozes e Memória ZAPIA"
        >
          <div className="w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-3xl border border-[var(--zapia-border)] bg-[var(--zapia-bg)] p-5 sm:p-6 space-y-4 my-auto">
            <div className="flex items-center justify-between">
              <h2 className="font-editorial text-xl text-[var(--zapia-text)]">
                Controle de Voz, Personalidade e Memória
              </h2>
              <button
                type="button"
                aria-label="Fechar configurações de voz"
                onClick={() => setVoiceModalOpen(false)}
                className="w-10 h-10 rounded-full bg-[var(--zapia-surface)] border border-[var(--zapia-border)] flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <PersonaVoicePanel
              settings={settings}
              preferences={preferences}
              isOnline={isOnline}
              onUpdateSettings={onUpdateSettings}
              onAddPreference={onAddPreference}
              onDeletePreference={onDeletePreference}
            />
          </div>
        </div>
      )}
    </div>
  );
};
