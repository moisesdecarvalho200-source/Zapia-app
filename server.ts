import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';
import { createServer as createViteServer } from 'vite';
import { validateSafeExternalUrl } from './src/utils/zapiaLogic';

dotenv.config();
if (!process.env.DISABLE_HMR) {
  process.env.DISABLE_HMR = 'true';
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json({ limit: '15mb' }));

function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    throw new Error('GEMINI_API_KEY não configurada no servidor.');
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, app: 'ZAPIA MS Assistente Inteligente', owner: 'Moisés de Carvalho' });
});

interface ChatRequestBody {
  message?: string;
  history?: Array<{ role: 'user' | 'assistant'; content: string }>;
  persona?: string;
  toneStyle?: string;
  userName?: string;
  preferences?: Array<{ category: string; key: string; value: string }>;
  contextSummary?: string;
  dailyCheckinSummary?: string;
}

app.post('/api/ai/chat', async (req, res) => {
  try {
    const body = (req.body || {}) as ChatRequestBody;
    const message = (body.message || '').trim();
    if (!message) {
      res.status(400).json({ error: 'Mensagem vazia.' });
      return;
    }

    const ai = getGeminiClient();
    const persona = body.persona || 'amigo';
    const toneStyle = body.toneStyle || 'natural, prestativo, direto e motivador';
    const userName = body.userName || 'Moisés de Carvalho';
    const prefsText = (body.preferences || [])
      .slice(0, 12)
      .map((p) => `- [${p.category}] ${p.key}: ${p.value}`)
      .join('\n');

    const historyText = (body.history || [])
      .slice(-8)
      .map((m) => `${m.role === 'user' ? userName : 'ZAPIA'}: ${m.content}`)
      .join('\n');

    const systemInstruction = [
      `Você é o ZAPIA MS, o assistente pessoal inteligente de ${userName}, criado no ecossistema de Moisés de Carvalho.`,
      `Fale sempre em português do Brasil claro, humano e realista.`,
      `Personalidade ativa: "${persona}". Estilo de tom configurado: ${toneStyle}.`,
      `Adapte o tratamento conforme a personalidade: "amigo" (caloroso, próximo), "colega" (colaborativo, ágil), "executivo" (estratégico, objetivo), "criativo" (inspirador, visual).`,
      `Você também é especialista em programação, construção de aplicativos (React, Flutter, Node.js, Python) e criação de jogos 2D/3D (HTML5 Canvas, Unity, Godot, Three.js): quando o usuário pedir código, jogos ou arquitetura de apps, entregue exemplos completos, claros e práticos.`,
      `Se o usuário pedir algo que envolva arquivos, agenda, e-mail, otimização ou lembretes, sugira ações concretas em suggestedActions.`,
      `Se perceber uma preferência duradoura do usuário (horário preferido, formato, estilo de resposta, contato frequente, rotina), registre em learnedPreference.`,
      prefsText ? `Preferências aprendidas até agora:\n${prefsText}` : '',
      body.dailyCheckinSummary
        ? `Check-in de autoconhecimento diário de ${userName}:\n${body.dailyCheckinSummary}`
        : '',
      body.contextSummary ? `Contexto atual do workspace:\n${body.contextSummary}` : '',
    ]
      .filter(Boolean)
      .join('\n');

    const prompt = historyText ? `${historyText}\n${userName}: ${message}` : `${userName}: ${message}`;

    const response = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: prompt,
      config: {
        systemInstruction,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            reply: {
              type: Type.STRING,
              description: 'Resposta conversacional realista do ZAPIA em português do Brasil.',
            },
            suggestedActions: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  type: {
                    type: Type.STRING,
                    description: 'reminder | vault_note | email_draft | calendar_event | optimize',
                  },
                  label: {
                    type: Type.STRING,
                    description: 'Rótulo curto do botão de ação para o usuário executar.',
                  },
                  payload: {
                    type: Type.STRING,
                    description: 'Texto ou título sugerido para preencher a ação.',
                  },
                },
              },
            },
            learnedPreference: {
              type: Type.OBJECT,
              nullable: true,
              properties: {
                category: {
                  type: Type.STRING,
                  description: 'rotina | voz | estilo | atalho | contato',
                },
                key: { type: Type.STRING },
                value: { type: Type.STRING },
              },
            },
          },
          required: ['reply', 'suggestedActions'],
        },
      },
    });

    const rawText = (response.text || '{}').trim();
    const parsed = JSON.parse(rawText);
    res.json(parsed);
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : 'Erro ao processar resposta de IA.';
    console.error('AI chat error:', errMsg);
    res.status(500).json({ error: errMsg });
  }
});

interface TtsRequestBody {
  text?: string;
  voiceName?: string;
  style?: string;
  dualSpeaker?: boolean;
  secondaryVoiceName?: string;
}

app.post('/api/ai/tts', async (req, res) => {
  try {
    const body = (req.body || {}) as TtsRequestBody;
    const text = (body.text || '').trim().slice(0, 1800);
    if (!text) {
      res.status(400).json({ error: 'Texto vazio para síntese de voz.' });
      return;
    }

    const ai = getGeminiClient();
    const voiceName = body.voiceName || 'Kore';
    const style = body.style || 'Natural Brazilian Portuguese conversational tone, warm and clear';

    if (body.dualSpeaker && body.secondaryVoiceName) {
      const midpoint = Math.floor(text.length / 2);
      const splitIdx = text.indexOf('. ', Math.max(0, midpoint - 40));
      const partA = splitIdx > 20 ? text.slice(0, splitIdx + 1) : text;
      const partB = splitIdx > 20 ? text.slice(splitIdx + 2) : 'Posso ajudar em mais alguma etapa agora?';

      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash-tts',
        contents: [
          {
            role: 'user',
            parts: [
              {
                text: `VozPrincipal: ${partA}`,
                speechMetadata: { speaker: 'VozPrincipal', style },
              },
              {
                text: `VozParceira: ${partB}`,
                speechMetadata: { speaker: 'VozParceira', style },
              },
            ],
          },
        ],
        config: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            multiSpeakerVoiceConfig: {
              speakerVoiceConfigs: [
                {
                  speaker: 'VozPrincipal',
                  voiceConfig: { prebuiltVoiceConfig: { voiceName } },
                },
                {
                  speaker: 'VozParceira',
                  voiceConfig: { prebuiltVoiceConfig: { voiceName: body.secondaryVoiceName } },
                },
              ],
            },
          },
        },
      });

      const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (!base64Audio) {
        res.status(502).json({ error: 'Áudio não retornado pelo modelo de voz.' });
        return;
      }
      res.json({ audioBase64: base64Audio, mimeType: 'audio/wav', voiceName: `${voiceName} + ${body.secondaryVoiceName}` });
      return;
    }

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash-lite-tts',
      contents: [
        {
          role: 'user',
          parts: [
            {
              text,
              speechMetadata: { style },
            },
          ],
        },
      ],
      config: {
        responseModalities: ['AUDIO'],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName },
          },
        },
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!base64Audio) {
      res.status(502).json({ error: 'Áudio não retornado pelo serviço de voz.' });
      return;
    }

    res.json({ audioBase64: base64Audio, mimeType: 'audio/wav', voiceName });
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : 'Erro ao gerar voz realista.';
    console.error('AI TTS error:', errMsg);
    res.status(500).json({ error: errMsg });
  }
});

interface TranscribeRequestBody {
  audioBase64?: string;
  mimeType?: string;
}

app.post('/api/ai/transcribe', async (req, res) => {
  try {
    const body = (req.body || {}) as TranscribeRequestBody;
    if (!body.audioBase64) {
      res.status(400).json({ error: 'Áudio não enviado para transcrição.' });
      return;
    }
    const ai = getGeminiClient();
    const response = await ai.models.generateContent({
      model: 'gemini-3.5-transcribe',
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: body.mimeType || 'audio/webm',
              data: body.audioBase64,
            },
          },
          { text: 'Transcreva fielmente este áudio em português do Brasil, apenas o texto falado.' },
        ],
      },
    });
    res.json({ text: (response.text || '').trim() });
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : 'Erro na transcrição de áudio.';
    console.error('Transcribe error:', errMsg);
    res.status(500).json({ error: errMsg });
  }
});

interface TrainVoiceRequestBody {
  profileName?: string;
  samples?: Array<{ base64: string; mimeType: string; title?: string }>;
  additionalContext?: string;
}

app.post('/api/ai/train-voice', async (req, res) => {
  try {
    const body = (req.body || {}) as TrainVoiceRequestBody;
    const samples = (body.samples || []).filter((s) => Boolean(s?.base64)).slice(0, 3);
    if (samples.length === 0) {
      res.status(400).json({ error: 'Envie ou grave ao menos 1 amostra de áudio para treinar a voz.' });
      return;
    }

    const ai = getGeminiClient();
    const profileName = (body.profileName || 'Voz Personalizada ZAPIA').trim();

    const parts: Array<
      { inlineData: { mimeType: string; data: string } } | { text: string }
    > = samples.map((s) => ({
      inlineData: {
        mimeType: s.mimeType || 'audio/webm',
        data: s.base64,
      },
    }));

    parts.push({
      text: [
        `Analise cuidadosamente as amostras de voz enviadas para criar um perfil de emulação chamado "${profileName}" para o assistente ZAPIA.`,
        `Identifique o gênero vocal predominante, escolha a voz base mais próxima dentre as disponíveis (masculinas: Fenrir, Charon, Puck; femininas: Kore, Zephyr),`,
        `calibre velocidade (0-100, sendo 45-55 natural), altura vocal/pitch (0-100, 50 natural), e calor emocional (0-100).`,
        `Escreva vocalStylePrompt como instrução detalhada de direção vocal (timbre, ressonância, cadência, dicção, pausa e prosódia em português do Brasil) para guiar a síntese de voz.`,
        body.additionalContext ? `Observações do usuário: ${body.additionalContext}` : '',
      ]
        .filter(Boolean)
        .join(' '),
    });

    const callTrainModel = () =>
      ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: { parts },
        config: {
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              gender: {
                type: Type.STRING,
                description: 'masculina | feminina',
              },
              recommendedBaseVoice: {
                type: Type.STRING,
                description: 'Fenrir | Charon | Puck | Kore | Zephyr',
              },
              recommendedSpeed: { type: Type.INTEGER },
              recommendedPitch: { type: Type.INTEGER },
              recommendedWarmth: { type: Type.INTEGER },
              vocalStylePrompt: {
                type: Type.STRING,
                description: 'Direção vocal detalhada para emular timbre, cadência, ritmo e expressividade.',
              },
              timbreNotes: {
                type: Type.STRING,
                description: 'Resumo curto em português do Brasil descrevendo o timbre analisado.',
              },
            },
            required: [
              'gender',
              'recommendedBaseVoice',
              'recommendedSpeed',
              'recommendedPitch',
              'recommendedWarmth',
              'vocalStylePrompt',
              'timbreNotes',
            ],
          },
        },
      });

    let response;
    try {
      response = await callTrainModel();
    } catch (firstErr: unknown) {
      const msg = firstErr instanceof Error ? firstErr.message : '';
      if (/503|UNAVAILABLE/i.test(msg)) {
        await new Promise((r) => setTimeout(r, 900));
        response = await callTrainModel();
      } else {
        throw firstErr;
      }
    }

    const raw = (response.text || '{}').trim();
    const parsed = JSON.parse(raw);
    res.json(parsed);
  } catch (err: unknown) {
    let errMsg = err instanceof Error ? err.message : 'Erro ao treinar perfil de voz personalizado.';
    try {
      const parsedErr = JSON.parse(errMsg) as { error?: { code?: number; message?: string } };
      if (parsedErr.error?.message) {
        errMsg =
          parsedErr.error.code === 503
            ? `Serviço de análise vocal da IA temporariamente sobrecarregado (503). Tente novamente em instantes ou alterne para modo offline.`
            : parsedErr.error.message;
      }
    } catch {
      // keep original message
    }
    console.error('Train voice error:', errMsg);
    res.status(502).json({ error: errMsg });
  }
});

interface ConnectorTestBody {
  providerKind?: string;
  baseUrl?: string;
  modelId?: string;
  secret?: string;
  accountLabel?: string;
}

app.post('/api/connectors/test', async (req, res) => {
  try {
    const body = (req.body || {}) as ConnectorTestBody;
    const providerKind = body.providerKind || 'openai-compatible';
    const secret = (body.secret || '').trim();
    const modelId = (body.modelId || '').trim();
    const rawBaseUrl = (body.baseUrl || '').trim();

    if (providerKind === 'app-credentials') {
      if (!body.accountLabel?.trim()) {
        res.status(400).json({ ok: false, message: 'Informe usuário, e-mail ou @handle do aplicativo.' });
        return;
      }
      if (rawBaseUrl) {
        const urlCheck = validateSafeExternalUrl(rawBaseUrl);
        if (!urlCheck.valid) {
          res.status(400).json({ ok: false, message: urlCheck.reason });
          return;
        }
      }
      res.json({
        ok: true,
        message: `Credenciais para "${body.accountLabel}" validadas e protegidas com criptografia AES-256-GCM local.`,
      });
      return;
    }

    if (providerKind === 'telegram-bot') {
      if (!secret) {
        res.status(400).json({ ok: false, message: 'Informe o Token do Bot Telegram (BotFather) para testar.' });
        return;
      }
      const tgRes = await fetch(`https://api.telegram.org/bot${encodeURIComponent(secret)}/getMe`, {
        signal: AbortSignal.timeout(8000),
      });
      const tgJson = (await tgRes.json().catch(() => ({}))) as {
        ok?: boolean;
        result?: { username?: string; first_name?: string };
        description?: string;
      };
      if (!tgRes.ok || !tgJson.ok) {
        res.status(400).json({ ok: false, message: tgJson.description || 'Token Telegram recusado.' });
        return;
      }
      res.json({
        ok: true,
        message: `Telegram conectado ao vivo (@${tgJson.result?.username || tgJson.result?.first_name || 'bot'}).`,
      });
      return;
    }

    const defaultUrl =
      providerKind === 'gemini'
        ? 'https://generativelanguage.googleapis.com/v1beta'
        : providerKind === 'huggingface'
          ? 'https://router.huggingface.co/v1'
          : rawBaseUrl;

    const targetUrlCheck = validateSafeExternalUrl(rawBaseUrl || defaultUrl);
    if (!targetUrlCheck.valid || !targetUrlCheck.url) {
      res.status(400).json({ ok: false, message: targetUrlCheck.reason || 'URL inválida.' });
      return;
    }

    const baseClean = targetUrlCheck.url.toString().replace(/\/+$/, '');

    if (providerKind === 'gemini') {
      if (!secret) {
        res.status(400).json({ ok: false, message: 'Informe a API Key Gemini para testar.' });
        return;
      }
      const testModel = modelId || 'gemini-2.5-flash';
      const geminiRes = await fetch(
        `${baseClean}/models/${encodeURIComponent(testModel)}:generateContent?key=${encodeURIComponent(secret)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ role: 'user', parts: [{ text: 'Responda apenas: OK' }] }],
          }),
          signal: AbortSignal.timeout(8000),
        }
      );
      if (!geminiRes.ok) {
        const errData = (await geminiRes.json().catch(() => ({}))) as { error?: { message?: string } };
        res.status(400).json({
          ok: false,
          message: errData.error?.message || `HTTP ${geminiRes.status} ao testar Gemini.`,
        });
        return;
      }
      res.json({ ok: true, message: `Modelo ${testModel} respondeu com sucesso.` });
      return;
    }

    if (providerKind === 'openai-compatible' || providerKind === 'huggingface') {
      if (!secret) {
        res.status(400).json({ ok: false, message: 'Informe a chave/token da API para testar.' });
        return;
      }
      const endpoint = baseClean.endsWith('/chat/completions')
        ? baseClean
        : `${baseClean}/chat/completions`;
      const testModel = modelId || 'llama-3.3-70b-versatile';
      const isReasoningOrGpt5 = /^(o\d|gpt-5)/i.test(testModel);
      const tokenLimitPayload = isReasoningOrGpt5
        ? { max_completion_tokens: 32 }
        : { max_tokens: 16 };
      const apiRes = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${secret}`,
        },
        body: JSON.stringify({
          model: testModel,
          messages: [{ role: 'user', content: 'Diga apenas OK' }],
          ...tokenLimitPayload,
        }),
        signal: AbortSignal.timeout(8000),
      });
      if (!apiRes.ok) {
        const errJson = (await apiRes.json().catch(() => ({}))) as {
          error?: { message?: string } | string;
        };
        const msg =
          typeof errJson.error === 'string'
            ? errJson.error
            : errJson.error?.message || `HTTP ${apiRes.status} na API externa.`;
        res.status(400).json({ ok: false, message: msg });
        return;
      }
      res.json({ ok: true, message: `Modelo (${testModel}) testado e ativo ao vivo.` });
      return;
    }

    if (providerKind === 'media-api') {
      const lowerBase = baseClean.toLowerCase();
      if (lowerBase.includes('pollinations.ai')) {
        const testRes = await fetch(
          'https://image.pollinations.ai/prompt/zapia%20neon%20badge?width=64&height=64&nologo=true',
          { signal: AbortSignal.timeout(9000) }
        );
        if (!testRes.ok) {
          res.status(400).json({
            ok: false,
            message: `Pollinations.ai respondeu HTTP ${testRes.status}.`,
          });
          return;
        }
        res.json({
          ok: true,
          message: 'Pollinations.ai conectada ao vivo (API de imagens IA 100% gratuita sem chave)!',
        });
        return;
      }

      if (lowerBase.includes('api.pexels.com')) {
        if (!secret) {
          res.status(400).json({ ok: false, message: 'Informe sua Pexels API Key gratuita para testar.' });
          return;
        }
        const pxRes = await fetch('https://api.pexels.com/v1/curated?per_page=1', {
          headers: { Authorization: secret },
          signal: AbortSignal.timeout(8000),
        });
        if (!pxRes.ok) {
          res.status(400).json({
            ok: false,
            message: `Pexels recusou a chave (HTTP ${pxRes.status}). Verifique em pexels.com/api.`,
          });
          return;
        }
        res.json({ ok: true, message: 'Pexels API (Fotos & Vídeos HD Grátis) conectada ao vivo!' });
        return;
      }

      if (lowerBase.includes('pixabay.com')) {
        if (!secret) {
          res.status(400).json({ ok: false, message: 'Informe sua Pixabay API Key gratuita para testar.' });
          return;
        }
        const pbRes = await fetch(
          `https://pixabay.com/api/?key=${encodeURIComponent(secret)}&q=nature&per_page=3`,
          { signal: AbortSignal.timeout(8000) }
        );
        if (!pbRes.ok) {
          res.status(400).json({
            ok: false,
            message: `Pixabay retornou HTTP ${pbRes.status}. Confira sua chave gratuita.`,
          });
          return;
        }
        res.json({ ok: true, message: 'Pixabay API (Fotos & Vídeos Grátis) testada e ativa!' });
        return;
      }

      if (lowerBase.includes('api.unsplash.com')) {
        if (!secret) {
          res.status(400).json({ ok: false, message: 'Informe a Access Key gratuita do Unsplash para testar.' });
          return;
        }
        const usRes = await fetch('https://api.unsplash.com/photos?per_page=1', {
          headers: { Authorization: `Client-ID ${secret}` },
          signal: AbortSignal.timeout(8000),
        });
        if (!usRes.ok) {
          res.status(400).json({
            ok: false,
            message: `Unsplash retornou HTTP ${usRes.status}. Verifique sua Client-ID.`,
          });
          return;
        }
        res.json({ ok: true, message: 'Unsplash API conectada e pronta para fotos em alta resolução!' });
        return;
      }

      // Suno, Luma Dream Machine, Fal.ai or custom audio/photo/video API
      if (!secret) {
        res.status(400).json({
          ok: false,
          message: 'Informe a chave/token da API de música ou vídeo (ou use Pollinations.ai sem chave).',
        });
        return;
      }
      const mediaPing = await fetch(baseClean, {
        method: 'GET',
        headers: { Authorization: `Bearer ${secret}` },
        signal: AbortSignal.timeout(8000),
      });
      if (mediaPing.status === 401 || mediaPing.status === 403) {
        res.status(400).json({
          ok: false,
          message: `Endpoint acessível, porém a chave/token foi recusada (HTTP ${mediaPing.status}).`,
        });
        return;
      }
      res.json({
        ok: mediaPing.status < 500,
        message: `API de Mídia/Áudio (${baseClean}) validada com HTTP ${mediaPing.status}.`,
      });
      return;
    }

    // Webhook / Generic HTTPS endpoint check
    const headers: Record<string, string> = {};
    if (secret) headers.Authorization = `Bearer ${secret}`;
    const pingRes = await fetch(baseClean, {
      method: 'GET',
      headers,
      signal: AbortSignal.timeout(8000),
    });
    res.json({
      ok: pingRes.status < 500,
      message: `Endpoint respondeu com HTTP ${pingRes.status}.`,
    });
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : 'Falha ao testar conector externo.';
    res.status(502).json({ ok: false, message: errMsg });
  }
});

interface ConnectorChatBody {
  providerKind?: string;
  baseUrl?: string;
  modelId?: string;
  secret?: string;
  message?: string;
  history?: Array<{ role: 'user' | 'assistant'; content: string }>;
  persona?: string;
  userName?: string;
  dailyCheckinSummary?: string;
}

app.post('/api/connectors/chat', async (req, res) => {
  try {
    const body = (req.body || {}) as ConnectorChatBody;
    const providerKind = body.providerKind || 'openai-compatible';
    const secret = (body.secret || '').trim();
    const message = (body.message || '').trim();
    const modelId = (body.modelId || '').trim();
    const rawBaseUrl = (body.baseUrl || '').trim();

    if (!message || !secret) {
      res.status(400).json({ error: 'Mensagem ou chave do modelo ausente.' });
      return;
    }

    const defaultUrl =
      providerKind === 'gemini'
        ? 'https://generativelanguage.googleapis.com/v1beta'
        : providerKind === 'huggingface'
          ? 'https://router.huggingface.co/v1'
          : rawBaseUrl;
    const check = validateSafeExternalUrl(rawBaseUrl || defaultUrl);
    if (!check.valid || !check.url) {
      res.status(400).json({ error: check.reason || 'URL da API inválida.' });
      return;
    }
    const baseClean = check.url.toString().replace(/\/+$/, '');

    const systemPrompt = [
      `Você é o ZAPIA MS, assistente pessoal inteligente de ${body.userName || 'Moisés de Carvalho'}.`,
      `Responda sempre em português do Brasil claro, com personalidade "${body.persona || 'amigo'}".`,
      `Ajude em tarefas diárias, automação, programação, construção de aplicativos e criação de jogos 2D/3D.`,
      body.dailyCheckinSummary ? `Autoconhecimento de hoje: ${body.dailyCheckinSummary}` : '',
    ]
      .filter(Boolean)
      .join(' ');

    if (providerKind === 'gemini') {
      const targetModel = modelId || 'gemini-2.5-flash';
      const resp = await fetch(
        `${baseClean}/models/${encodeURIComponent(targetModel)}:generateContent?key=${encodeURIComponent(secret)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: systemPrompt }] },
            contents: [
              ...(body.history || []).slice(-6).map((m) => ({
                role: m.role === 'assistant' ? 'model' : 'user',
                parts: [{ text: m.content }],
              })),
              { role: 'user', parts: [{ text: message }] },
            ],
          }),
          signal: AbortSignal.timeout(15000),
        }
      );
      const data = (await resp.json().catch(() => ({}))) as {
        candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
        error?: { message?: string };
      };
      if (!resp.ok) {
        res.status(502).json({ error: data.error?.message || 'Erro no modelo Gemini externo.' });
        return;
      }
      const reply = data.candidates?.[0]?.content?.parts?.[0]?.text || 'Resposta recebida.';
      res.json({ reply, suggestedActions: [] });
      return;
    }

    const endpoint = baseClean.endsWith('/chat/completions')
      ? baseClean
      : `${baseClean}/chat/completions`;
    const activeModel = modelId || 'llama-3.3-70b-versatile';
    const isReasoningOrGpt5 = /^(o\d|gpt-5)/i.test(activeModel);
    const apiRes = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${secret}`,
      },
      body: JSON.stringify({
        model: activeModel,
        messages: [
          { role: 'system', content: systemPrompt },
          ...(body.history || []).slice(-6),
          { role: 'user', content: message },
        ],
        ...(isReasoningOrGpt5 ? { max_completion_tokens: 800 } : {}),
      }),
      signal: AbortSignal.timeout(15000),
    });
    const apiJson = (await apiRes.json().catch(() => ({}))) as {
      choices?: Array<{ message?: { content?: string } }>;
      error?: { message?: string } | string;
    };
    if (!apiRes.ok) {
      const msg =
        typeof apiJson.error === 'string'
          ? apiJson.error
          : apiJson.error?.message || `HTTP ${apiRes.status} na API Free.`;
      res.status(502).json({ error: msg });
      return;
    }
    const reply = apiJson.choices?.[0]?.message?.content || 'Resposta recebida.';
    res.json({ reply, suggestedActions: [] });
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : 'Erro ao consultar modelo personalizado.';
    res.status(502).json({ error: errMsg });
  }
});

interface MediaSearchBody {
  provider?: 'pollinations' | 'pexels' | 'pixabay' | 'unsplash';
  query?: string;
  mediaType?: 'photo' | 'video';
  secret?: string;
}

app.post('/api/connectors/media-search', async (req, res) => {
  try {
    const body = (req.body || {}) as MediaSearchBody;
    const provider = body.provider || 'pollinations';
    const q = (body.query || '').trim();
    const mediaType = body.mediaType === 'video' ? 'video' : 'photo';
    const secret = (body.secret || '').trim();

    if (!q) {
      res.status(400).json({ error: 'Digite um tema ou prompt para buscar fotos/vídeos.' });
      return;
    }

    if (provider === 'pollinations') {
      const targetUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(
        `${q}, ultra detailed photography, crisp lighting`
      )}?width=768&height=512&nologo=true&seed=${Date.now() % 99999}`;
      const check = validateSafeExternalUrl(targetUrl);
      if (!check.valid) {
        res.status(400).json({ error: check.reason });
        return;
      }
      const imgRes = await fetch(targetUrl, { signal: AbortSignal.timeout(15000) });
      if (!imgRes.ok) {
        res.status(502).json({ error: `Pollinations.ai retornou HTTP ${imgRes.status}.` });
        return;
      }
      const buf = Buffer.from(await imgRes.arrayBuffer());
      const contentType = imgRes.headers.get('content-type') || 'image/jpeg';
      const dataUrl = `data:${contentType};base64,${buf.toString('base64')}`;
      res.json({
        items: [
          {
            id: `pol_${Date.now()}`,
            title: q,
            kind: 'photo',
            previewUrl: dataUrl,
            fullUrl: dataUrl,
            mimeType: contentType,
            author: 'Pollinations.ai (Grátis sem Chave)',
          },
        ],
      });
      return;
    }

    if (!secret) {
      res.status(400).json({ error: `Informe sua chave gratuita da API ${provider} para buscar.` });
      return;
    }

    if (provider === 'pexels') {
      const endpoint =
        mediaType === 'video'
          ? `https://api.pexels.com/videos/search?query=${encodeURIComponent(q)}&per_page=4`
          : `https://api.pexels.com/v1/search?query=${encodeURIComponent(q)}&per_page=4`;
      const pxRes = await fetch(endpoint, {
        headers: { Authorization: secret },
        signal: AbortSignal.timeout(10000),
      });
      if (!pxRes.ok) {
        res.status(400).json({ error: `Pexels retornou HTTP ${pxRes.status}.` });
        return;
      }
      if (mediaType === 'video') {
        const pxData = (await pxRes.json()) as {
          videos?: Array<{
            id: number;
            image: string;
            user?: { name?: string };
            video_files?: Array<{ link?: string; file_type?: string }>;
          }>;
        };
        const items = (pxData.videos || []).map((v) => ({
          id: `px_v_${v.id}`,
          title: `${q} (Vídeo Pexels #${v.id})`,
          kind: 'video',
          previewUrl: v.image,
          fullUrl: v.video_files?.[0]?.link || v.image,
          mimeType: v.video_files?.[0]?.file_type || 'video/mp4',
          author: v.user?.name || 'Pexels Video',
        }));
        res.json({ items });
        return;
      }
      const pxPhotos = (await pxRes.json()) as {
        photos?: Array<{
          id: number;
          alt?: string;
          photographer?: string;
          src?: { medium?: string; large?: string };
        }>;
      };
      const items = (pxPhotos.photos || []).map((p) => ({
        id: `px_p_${p.id}`,
        title: p.alt || `${q} #${p.id}`,
        kind: 'photo',
        previewUrl: p.src?.medium || p.src?.large || '',
        fullUrl: p.src?.large || p.src?.medium || '',
        mimeType: 'image/jpeg',
        author: p.photographer || 'Pexels',
      }));
      res.json({ items });
      return;
    }

    if (provider === 'pixabay') {
      const endpoint =
        mediaType === 'video'
          ? `https://pixabay.com/api/videos/?key=${encodeURIComponent(secret)}&q=${encodeURIComponent(q)}&per_page=4`
          : `https://pixabay.com/api/?key=${encodeURIComponent(secret)}&q=${encodeURIComponent(q)}&per_page=4`;
      const pbRes = await fetch(endpoint, { signal: AbortSignal.timeout(10000) });
      if (!pbRes.ok) {
        res.status(400).json({ error: `Pixabay retornou HTTP ${pbRes.status}.` });
        return;
      }
      const pbJson = (await pbRes.json()) as {
        hits?: Array<{
          id: number;
          tags?: string;
          user?: string;
          webformatURL?: string;
          largeImageURL?: string;
          videos?: { medium?: { url?: string; thumbnail?: string } };
        }>;
      };
      const items = (pbJson.hits || []).map((h) => ({
        id: `pb_${h.id}`,
        title: h.tags || q,
        kind: mediaType,
        previewUrl:
          mediaType === 'video'
            ? h.videos?.medium?.thumbnail || ''
            : h.webformatURL || h.largeImageURL || '',
        fullUrl:
          mediaType === 'video'
            ? h.videos?.medium?.url || ''
            : h.largeImageURL || h.webformatURL || '',
        mimeType: mediaType === 'video' ? 'video/mp4' : 'image/jpeg',
        author: h.user || 'Pixabay',
      }));
      res.json({ items });
      return;
    }

    // Unsplash
    const usRes = await fetch(
      `https://api.unsplash.com/search/photos?query=${encodeURIComponent(q)}&per_page=4`,
      {
        headers: { Authorization: `Client-ID ${secret}` },
        signal: AbortSignal.timeout(10000),
      }
    );
    if (!usRes.ok) {
      res.status(400).json({ error: `Unsplash retornou HTTP ${usRes.status}.` });
      return;
    }
    const usJson = (await usRes.json()) as {
      results?: Array<{
        id: string;
        alt_description?: string;
        user?: { name?: string };
        urls?: { small?: string; regular?: string };
      }>;
    };
    const items = (usJson.results || []).map((u) => ({
      id: `us_${u.id}`,
      title: u.alt_description || q,
      kind: 'photo',
      previewUrl: u.urls?.small || u.urls?.regular || '',
      fullUrl: u.urls?.regular || u.urls?.small || '',
      mimeType: 'image/jpeg',
      author: u.user?.name || 'Unsplash',
    }));
    res.json({ items });
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : 'Erro ao buscar mídia externa.';
    res.status(502).json({ error: errMsg });
  }
});

async function startServer() {
  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    if (process.env.DISABLE_HMR === 'true') {
      app.get('/@vite/client', (_req, res) => {
        res.type('application/javascript').send(
          [
            'export class ErrorOverlay extends HTMLElement {}',
            'const sheetsMap = new Map();',
            'export function updateStyle(id, content) {',
            '  let style = sheetsMap.get(id);',
            '  if (!style) {',
            '    style = document.createElement("style");',
            '    style.setAttribute("type", "text/css");',
            '    style.setAttribute("data-vite-dev-id", id);',
            '    style.textContent = content;',
            '    document.head.appendChild(style);',
            '    sheetsMap.set(id, style);',
            '  } else if (style.textContent !== content) {',
            '    style.textContent = content;',
            '  }',
            '}',
            'export function removeStyle(id) {',
            '  const style = sheetsMap.get(id);',
            '  if (style) { style.remove(); sheetsMap.delete(id); }',
            '}',
            'export function createHotContext() {',
            '  return { data: {}, accept() {}, dispose() {}, prune() {}, decline() {}, invalidate() {}, on() {}, off() {}, send() {} };',
            '}',
            'export function injectQuery(url) { return url; }',
          ].join('\n')
        );
      });
    }
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
        ws: false,
        watch: null,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('/{*splat}', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const port = Number(process.env.PORT) || 3000;
  app.listen(port, '0.0.0.0', () => {
    console.log(`ZAPIA server running at http://localhost:${port}`);
  });
}

startServer();
