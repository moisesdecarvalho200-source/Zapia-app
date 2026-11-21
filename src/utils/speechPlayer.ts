import {
  TrainedVoiceProfile,
  VoiceEffectId,
  buildTrainedVoiceStylePrompt,
  buildVoiceStylePrompt,
  selectNextVoice,
  speedToPlaybackRate,
  toneToPitchRatio,
} from './zapiaLogic';
import { ZapiaSettingsState } from './offlineDb';

export interface SpeakOptions {
  text: string;
  turnIndex?: number;
  overrideVoiceName?: string;
  overrideTrainedProfile?: TrainedVoiceProfile | null;
  settings: ZapiaSettingsState;
  isOnline: boolean;
  onStart?: (voiceLabel: string) => void;
  onEnd?: () => void;
  onError?: (msg: string) => void;
}

class ZapiaSpeechController {
  private currentAudio: HTMLAudioElement | null = null;
  private activeAudioCtx: AudioContext | null = null;

  private cleanupAudioGraph(): void {
    if (this.activeAudioCtx) {
      this.activeAudioCtx.close().catch(() => {});
      this.activeAudioCtx = null;
    }
  }

  public stop(): void {
    if (this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio.currentTime = 0;
      this.currentAudio = null;
    }
    this.cleanupAudioGraph();
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
  }

  public applyLiveParameters(speed: number): void {
    if (this.currentAudio) {
      this.currentAudio.playbackRate = speedToPlaybackRate(speed);
    }
  }

  private attachVoiceEffect(audio: HTMLAudioElement, effect: VoiceEffectId): void {
    if (effect === 'natural' || typeof window === 'undefined') return;
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;

    try {
      const ctx = new AudioCtx();
      this.activeAudioCtx = ctx;
      const source = ctx.createMediaElementSource(audio);

      if (effect === 'studio') {
        const compressor = ctx.createDynamicsCompressor();
        compressor.threshold.value = -20;
        compressor.ratio.value = 4;
        const boost = ctx.createBiquadFilter();
        boost.type = 'highshelf';
        boost.frequency.value = 3200;
        boost.gain.value = 4;
        source.connect(boost);
        boost.connect(compressor);
        compressor.connect(ctx.destination);
      } else if (effect === 'radio') {
        const bandpass = ctx.createBiquadFilter();
        bandpass.type = 'bandpass';
        bandpass.frequency.value = 1400;
        bandpass.Q.value = 1.6;
        const gain = ctx.createGain();
        gain.gain.value = 1.4;
        source.connect(bandpass);
        bandpass.connect(gain);
        gain.connect(ctx.destination);
      } else if (effect === 'robot') {
        const delay = ctx.createDelay(0.2);
        delay.delayTime.value = 0.028;
        const feedback = ctx.createGain();
        feedback.gain.value = 0.48;
        const shaper = ctx.createWaveShaper();
        const curve = new Float32Array(256);
        for (let i = 0; i < 256; i++) {
          const x = (i * 2) / 256 - 1;
          curve[i] = Math.tanh(x * 3.2);
        }
        shaper.curve = curve;
        source.connect(shaper);
        shaper.connect(ctx.destination);
        shaper.connect(delay);
        delay.connect(feedback);
        feedback.connect(delay);
        delay.connect(ctx.destination);
      } else if (effect === 'echo') {
        const delay = ctx.createDelay(1.0);
        delay.delayTime.value = 0.24;
        const feedback = ctx.createGain();
        feedback.gain.value = 0.35;
        const wet = ctx.createGain();
        wet.gain.value = 0.45;
        source.connect(ctx.destination);
        source.connect(delay);
        delay.connect(feedback);
        feedback.connect(delay);
        delay.connect(wet);
        wet.connect(ctx.destination);
      }
      if (ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }
    } catch {
      // Fallback cleanly to unprocessed audio element
    }
  }

  public async speak(opts: SpeakOptions): Promise<void> {
    this.stop();

    const trained =
      opts.overrideTrainedProfile !== undefined
        ? opts.overrideTrainedProfile
        : opts.settings.trainedVoiceProfile;
    const useTrained = Boolean(trained && (trained.active || opts.overrideTrainedProfile) && !opts.overrideVoiceName);

    const chosen = selectNextVoice(
      opts.settings.voiceGender,
      opts.turnIndex ?? 0,
      opts.settings.preferredMaleVoice,
      opts.settings.preferredFemaleVoice
    );
    const activeVoiceName = opts.overrideVoiceName
      ? opts.overrideVoiceName
      : useTrained && trained
        ? trained.baseModelId
        : chosen.voiceName;
    const pitchVal =
      useTrained && trained ? trained.recommendedPitch : (opts.settings.voicePitch ?? 50);
    const speedVal =
      useTrained && trained ? trained.recommendedSpeed : opts.settings.speed;
    const warmthVal =
      useTrained && trained ? trained.recommendedWarmth : opts.settings.warmth;

    const effect: VoiceEffectId = opts.settings.voiceEffect || 'natural';
    const baseStyle = buildVoiceStylePrompt(
      opts.settings.persona,
      warmthVal,
      speedVal,
      pitchVal
    );
    const trainedStyle = useTrained && trained
      ? buildTrainedVoiceStylePrompt(baseStyle, {
          active: true,
          name: trained.name,
          vocalStylePrompt: trained.vocalStylePrompt,
        })
      : baseStyle;
    const style =
      effect !== 'natural' ? `${trainedStyle} Efeito vocal aplicado: ${effect}.` : trainedStyle;
    const playbackRate = speedToPlaybackRate(speedVal);
    const pitchRatio = toneToPitchRatio(pitchVal);

    opts.onStart?.(useTrained && trained ? trained.name : activeVoiceName);

    const speakBrowserFallback = () => {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        const utter = new SpeechSynthesisUtterance(opts.text);
        utter.lang = 'pt-BR';
        utter.rate = playbackRate;
        utter.pitch =
          effect === 'robot' ? Math.max(0.65, pitchRatio - 0.18) : pitchRatio;
        const voices = window.speechSynthesis.getVoices();
        const ptVoices = voices.filter((v) => v.lang.toLowerCase().includes('pt'));
        if (ptVoices.length > 1) {
          const isFem = activeVoiceName === 'Kore' || activeVoiceName === 'Zephyr';
          const matched = ptVoices.find((v) =>
            isFem
              ? /female|maria|luciana|vitoria|francisca|google português/i.test(v.name)
              : /male|daniel|felipe|antonio|ricardo/i.test(v.name)
          );
          if (matched) utter.voice = matched;
        } else if (ptVoices.length === 1) {
          utter.voice = ptVoices[0];
        }
        utter.onend = () => opts.onEnd?.();
        utter.onerror = () => opts.onEnd?.();
        window.speechSynthesis.speak(utter);
      } else {
        opts.onEnd?.();
      }
    };

    if (!opts.isOnline) {
      speakBrowserFallback();
      return;
    }

    try {
      const res = await fetch('/api/ai/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: opts.text,
          voiceName: activeVoiceName,
          style,
          dualSpeaker:
            !opts.overrideVoiceName &&
            opts.settings.voiceGender === 'alternada' &&
            opts.text.length > 140,
          secondaryVoiceName:
            chosen.genderLabel === 'Masculina'
              ? opts.settings.preferredFemaleVoice
              : opts.settings.preferredMaleVoice,
        }),
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(err.error || 'Falha ao gerar voz realista.');
      }
      const data = (await res.json()) as { audioBase64: string; mimeType: string };
      const audio = new Audio(`data:${data.mimeType};base64,${data.audioBase64}`);
      audio.playbackRate = playbackRate;
      this.currentAudio = audio;
      this.attachVoiceEffect(audio, effect);
      audio.onended = () => {
        if (this.currentAudio === audio) {
          this.currentAudio = null;
          this.cleanupAudioGraph();
        }
        opts.onEnd?.();
      };
      audio.onerror = () => {
        if (this.currentAudio === audio) {
          this.currentAudio = null;
          this.cleanupAudioGraph();
        }
        speakBrowserFallback();
      };
      await audio.play();
    } catch (err: unknown) {
      opts.onError?.(err instanceof Error ? err.message : 'Usando síntese local do aparelho.');
      speakBrowserFallback();
    }
  }
}

export const zapiaSpeech = new ZapiaSpeechController();
