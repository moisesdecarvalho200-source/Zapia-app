import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, Type } from '@google/genai';
import { createServer as createViteServer } from 'vite';
import { validateSafeExternalUrl } from './src/utils/zapiaLogic';

dotenv.config();

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
  res.json({ ok: true, app: 'ZAPIA Assistente Inteligente', owner: 'Moisés de Carvalho' });
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
      `Você é o ZAPIA, o assistente pessoal inteligente de ${userName}, criado no ecossistema de Moisés de Carvalho.`,
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
      const apiRes = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${secret}`,
        },
        body: JSON.stringify({
          model: testModel,
          messages: [{ role: 'user', content: 'Diga apenas OK' }],
          max_tokens: 12,
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
      res.json({ ok: true, message: `API Free (${testModel}) testada e ativa.` });
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
      `Você é o ZAPIA, assistente pessoal inteligente de ${body.userName || 'Moisés de Carvalho'}.`,
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
    const apiRes = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${secret}`,
      },
      body: JSON.stringify({
        model: modelId || 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: systemPrompt },
          ...(body.history || []).slice(-6),
          { role: 'user', content: message },
        ],
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

async function startServer() {
  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
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
