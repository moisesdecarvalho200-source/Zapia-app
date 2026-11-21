export type PersonaId = 'amigo' | 'colega' | 'executivo' | 'criativo';
export type VoiceGenderMode = 'masculina' | 'feminina' | 'alternada';
export type ThemeId = 'obsidian-crimson' | 'platinum-light' | 'cobalt-pro' | 'royal-gold';
export type ScanVerdict = 'limpo' | 'alerta' | 'quarentena';

export interface PersonaProfile {
  id: PersonaId;
  label: string;
  roleDescription: string;
  defaultTone: string;
}

export const PERSONA_PROFILES: Record<PersonaId, PersonaProfile> = {
  amigo: {
    id: 'amigo',
    label: 'Amigo Próximo',
    roleDescription: 'Conversa leve, acolhedora, proativa e motivadora no dia a dia.',
    defaultTone: 'Caloroso, natural em português do Brasil, empático e prestativo',
  },
  colega: {
    id: 'colega',
    label: 'Colega de Trabalho',
    roleDescription: 'Colaborativo, organizado e ágil para resolver tarefas e rascunhos.',
    defaultTone: 'Profissional acessível, direto ao ponto, colaborativo e claro',
  },
  executivo: {
    id: 'executivo',
    label: 'Secretário Executivo',
    roleDescription: 'Alta precisão para agenda, e-mails, prioridades e decisões rápidas.',
    defaultTone: 'Executivo, objetivo, formal na medida certa e orientado a resultados',
  },
  criativo: {
    id: 'criativo',
    label: 'Diretor Criativo',
    roleDescription: 'Ideias para fotos, vídeos, roteiros, cores e experiências visuais.',
    defaultTone: 'Inspirador, visual, detalhista e articulado',
  },
};

export interface ThemeConfig {
  id: ThemeId;
  name: string;
  isDark: boolean;
  swatchHex: string;
  description: string;
}

export const ZAPIA_THEMES: ThemeConfig[] = [
  {
    id: 'obsidian-crimson',
    name: 'Obsidian Crimson',
    isDark: true,
    swatchHex: '#dc2626',
    description: 'Assinatura ZAPIA em grafite escuro e vermelho carmesim',
  },
  {
    id: 'platinum-light',
    name: 'Platinum Claro',
    isDark: false,
    swatchHex: '#f1f5f9',
    description: 'Superfície clara de alto contraste para uso diurno',
  },
  {
    id: 'cobalt-pro',
    name: 'Cobalt Pro',
    isDark: true,
    swatchHex: '#2563eb',
    description: 'Azul cobalto profissional para foco prolongado',
  },
  {
    id: 'royal-gold',
    name: 'Royal Gold',
    isDark: true,
    swatchHex: '#d97706',
    description: 'Obsidiana profunda com destaque dourado real',
  },
];

export const MALE_VOICES = ['Fenrir', 'Charon', 'Puck'] as const;
export const FEMALE_VOICES = ['Kore', 'Zephyr'] as const;

export interface VoiceModelOption {
  id: string;
  label: string;
  gender: 'masculina' | 'feminina';
  timbre: string;
  recommendedFor: string;
}

export const VOICE_MODEL_CATALOG: VoiceModelOption[] = [
  {
    id: 'Fenrir',
    label: 'Fenrir',
    gender: 'masculina',
    timbre: 'Grave, firme e natural',
    recommendedFor: 'Comandos diretos e resumos executivos',
  },
  {
    id: 'Charon',
    label: 'Charon',
    gender: 'masculina',
    timbre: 'Calmo, profundo e narrativo',
    recommendedFor: 'Leituras longas e explicações detalhadas',
  },
  {
    id: 'Puck',
    label: 'Puck',
    gender: 'masculina',
    timbre: 'Ágil, jovial e expressivo',
    recommendedFor: 'Conversas rápidas e ideias criativas',
  },
  {
    id: 'Kore',
    label: 'Kore',
    gender: 'feminina',
    timbre: 'Clara, equilibrada e acolhedora',
    recommendedFor: 'Assistente diário, agenda e e-mails',
  },
  {
    id: 'Zephyr',
    label: 'Zephyr',
    gender: 'feminina',
    timbre: 'Suave, empática e fluida',
    recommendedFor: 'Diálogos amigáveis e notificações',
  },
];

export function speedToPlaybackRate(speed: number): number {
  const clamped = Math.max(0, Math.min(100, speed));
  return Number((0.75 + (clamped / 100) * 0.6).toFixed(2));
}

export function toneToPitchRatio(tonePitch: number): number {
  const clamped = Math.max(0, Math.min(100, tonePitch));
  return Number((0.8 + (clamped / 100) * 0.4).toFixed(2));
}

export function selectNextVoice(
  mode: VoiceGenderMode,
  turnIndex: number,
  preferredMale: string = 'Fenrir',
  preferredFemale: string = 'Kore'
): { voiceName: string; genderLabel: 'Masculina' | 'Feminina' } {
  const safeMale = MALE_VOICES.includes(preferredMale as (typeof MALE_VOICES)[number])
    ? preferredMale
    : 'Fenrir';
  const safeFemale = FEMALE_VOICES.includes(preferredFemale as (typeof FEMALE_VOICES)[number])
    ? preferredFemale
    : 'Kore';

  if (mode === 'masculina') {
    return { voiceName: safeMale, genderLabel: 'Masculina' };
  }
  if (mode === 'feminina') {
    return { voiceName: safeFemale, genderLabel: 'Feminina' };
  }
  const useFemale = Math.abs(turnIndex) % 2 === 1;
  return useFemale
    ? { voiceName: safeFemale, genderLabel: 'Feminina' }
    : { voiceName: safeMale, genderLabel: 'Masculina' };
}

export function buildVoiceStylePrompt(
  persona: PersonaId,
  warmth: number,
  speed: number,
  tonePitch: number = 50
): string {
  const base = PERSONA_PROFILES[persona]?.defaultTone ?? PERSONA_PROFILES.amigo.defaultTone;
  const paceDesc = speed > 65 ? 'cadência ágil e dinâmica' : speed < 35 ? 'cadência calma e pausada' : 'ritmo natural equilibrado';
  const warmthDesc = warmth > 65 ? 'tom expressivo e caloroso' : warmth < 35 ? 'tom sóbrio e analítico' : 'tom amigável e claro';
  const pitchDesc = tonePitch > 62 ? 'registro vocal levemente mais agudo e brilhante' : tonePitch < 38 ? 'registro vocal mais grave e encorpado' : 'altura vocal natural';
  return `${base}, com ${paceDesc}, ${warmthDesc} e ${pitchDesc}, em português do Brasil.`;
}

export interface FileScanResult {
  status: ScanVerdict;
  findings: string[];
  riskScore: number;
}

const EXECUTABLE_EXTENSIONS = ['.exe', '.bat', '.cmd', '.msi', '.scr', '.vbs', '.ps1', '.sh', '.apk', '.dll'];
const SUSPICIOUS_PATTERNS: Array<{ regex: RegExp; reason: string; severity: 'high' | 'medium' }> = [
  { regex: /<script[\s>][\s\S]*?<\/script>/i, reason: 'Bloco <script> incorporado detectado no conteúdo', severity: 'high' },
  { regex: /powershell\s+-enc/i, reason: 'Comando PowerShell ofuscado detectado', severity: 'high' },
  { regex: /eval\s*\(\s*atob\s*\(/i, reason: 'Execução dinâmica eval(atob(...)) suspeita', severity: 'high' },
  { regex: /rm\s+-rf\s+\//i, reason: 'Instrução destrutiva de shell detectada', severity: 'high' },
  { regex: /ActiveXObject|WScript\.Shell/i, reason: 'Chamada de macro WScript/ActiveX detectada', severity: 'high' },
  { regex: /javascript:/i, reason: 'URI javascript: potencialmente insegura', severity: 'medium' },
];

export function scanFileContent(
  fileName: string,
  mimeType: string,
  bytes: Uint8Array,
  textPreview?: string
): FileScanResult {
  const findings: string[] = [];
  let riskScore = 0;
  const lowerName = fileName.toLowerCase();

  for (const ext of EXECUTABLE_EXTENSIONS) {
    if (lowerName.endsWith(ext)) {
      findings.push(`Extensão executável ou de script (${ext}) bloqueada pela política do cofre.`);
      riskScore += 75;
      break;
    }
  }

  // Magic-bytes check for PE (MZ) or ELF executables disguised with another extension
  if (bytes.length >= 4) {
    const isMZ = bytes[0] === 0x4d && bytes[1] === 0x5a;
    const isELF = bytes[0] === 0x7f && bytes[1] === 0x45 && bytes[2] === 0x4c && bytes[3] === 0x46;
    if (isMZ || isELF) {
      findings.push('Assinatura binária executável (MZ/ELF) encontrada no cabeçalho do arquivo.');
      riskScore += 90;
    }
    // Check PNG signature if declared image/png
    if (mimeType === 'image/png' && !(bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47)) {
      findings.push('Cabeçalho binário não corresponde ao formato PNG declarado.');
      riskScore += 30;
    }
  }

  if (textPreview) {
    for (const pattern of SUSPICIOUS_PATTERNS) {
      if (pattern.regex.test(textPreview)) {
        findings.push(pattern.reason);
        riskScore += pattern.severity === 'high' ? 60 : 25;
      }
    }
  }

  const boundedScore = Math.min(100, riskScore);
  let status: ScanVerdict = 'limpo';
  if (boundedScore >= 60) {
    status = 'quarentena';
  } else if (boundedScore >= 25) {
    status = 'alerta';
  }

  if (findings.length === 0) {
    findings.push('Assinatura MIME íntegra e nenhum padrão malicioso identificado.');
  }

  return { status, findings, riskScore: boundedScore };
}

export function sanitizeFirestoreId(raw: string): string {
  const cleaned = raw.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 128);
  return cleaned || `item_${Date.now()}`;
}

export function validateVaultDocumentBounds(doc: {
  id: string;
  ownerId: string;
  title: string;
  mimeType: string;
  sizeBytes: number;
  sha256: string;
  encryptedPayload: string;
  iv: string;
}): { valid: boolean; reason?: string } {
  if (!/^[a-zA-Z0-9_-]{1,128}$/.test(doc.id)) {
    return { valid: false, reason: 'ID inválido para Firestore.' };
  }
  if (!/^[a-zA-Z0-9_-]{1,128}$/.test(doc.ownerId)) {
    return { valid: false, reason: 'ownerId inválido.' };
  }
  if (doc.title.length < 1 || doc.title.length > 180) {
    return { valid: false, reason: 'Título deve ter entre 1 e 180 caracteres.' };
  }
  if (doc.mimeType.length < 1 || doc.mimeType.length > 120) {
    return { valid: false, reason: 'MIME type inválido.' };
  }
  if (doc.sizeBytes < 0 || doc.sizeBytes > 52428800) {
    return { valid: false, reason: 'Arquivo excede o limite de 50 MB.' };
  }
  if (!/^[a-f0-9]{64}$/.test(doc.sha256)) {
    return { valid: false, reason: 'Hash SHA-256 inválido.' };
  }
  if (doc.encryptedPayload.length < 1 || doc.encryptedPayload.length > 250000) {
    return { valid: false, reason: 'Payload criptografado excede o limite seguro do documento.' };
  }
  if (doc.iv.length < 8 || doc.iv.length > 64) {
    return { valid: false, reason: 'Vetor IV inválido.' };
  }
  return { valid: true };
}

export interface OfflineActionResult {
  reply: string;
  actionType?: 'reminder' | 'vault_note' | 'optimize' | 'theme';
  actionPayload?: string;
}

export function processOfflineCommand(input: string, userName = 'Moisés de Carvalho'): OfflineActionResult {
  const trimmed = input.trim();
  const lower = trimmed.toLowerCase();

  if (lower.startsWith('lembrar ') || lower.includes('lembrete') || lower.includes('agenda')) {
    const title = trimmed.replace(/^lembrar\s+(de\s+)?/i, '').trim() || 'Compromisso importante';
    return {
      reply: `Modo offline ativo, ${userName}. Registrei o lembrete local "${title}" no seu cofre offline e ele será sincronizado quando a rede voltar.`,
      actionType: 'reminder',
      actionPayload: title,
    };
  }

  if (lower.startsWith('anotar ') || lower.includes('salvar nota') || lower.includes('arquivo')) {
    const note = trimmed.replace(/^anotar\s+/i, '').trim() || 'Anotação rápida';
    return {
      reply: `Nota criptografada localmente com AES-GCM e salva no Cofre Offline para ${userName}.`,
      actionType: 'vault_note',
      actionPayload: note,
    };
  }

  if (lower.includes('otimizar') || lower.includes('limpar') || lower.includes('memória') || lower.includes('bateria')) {
    return {
      reply: `Diagnóstico offline concluído: recomendo executar a limpeza de cache temporário e verificar os itens em quarentena na aba Otimizador.`,
      actionType: 'optimize',
      actionPayload: 'run_diagnostics',
    };
  }

  if (lower.includes('cor') || lower.includes('tema') || lower.includes('claro') || lower.includes('escuro')) {
    return {
      reply: `Você pode alternar entre Obsidian Crimson, Platinum Claro, Cobalt Pro e Royal Gold a qualquer momento sem perder seus dados offline.`,
      actionType: 'theme',
      actionPayload: 'toggle',
    };
  }

  return {
    reply: `Estou operando em modo 100% offline para proteger sua privacidade, ${userName}. Posso criar notas criptografadas ("anotar ..."), salvar lembretes locais ("lembrar ..."), gerenciar sua galeria local e auditar arquivos sem enviar dados para a internet.`,
  };
}

export function getPortugueseGreeting(fullName = 'Moisés', hour = new Date().getHours()): string {
  const firstName = (fullName || 'Moisés').trim().split(/\s+/)[0] || 'Moisés';
  if (hour >= 5 && hour < 12) {
    return `Bom dia, ${firstName}!`;
  }
  if (hour >= 12 && hour < 18) {
    return `Boa tarde, ${firstName}!`;
  }
  return `Boa noite, ${firstName}!`;
}

export const THREAD_GLYPH_PALETTE = [
  '#C4F16E', // Acid Lime
  '#F29BD4', // Orchid Pink
  '#EFE5CE', // Warm Cream
  '#E5C267', // Warm Ochre
  '#EE966C', // Coral Peach
  '#6CD4D8', // Aqua Cyan
] as const;

export function getThreadColorHex(index: number): string {
  const idx = Math.abs(index) % THREAD_GLYPH_PALETTE.length;
  return THREAD_GLYPH_PALETTE[idx];
}

export function buildThreadTitleFromMessage(text: string): string {
  const cleaned = text.trim().replace(/\s+/g, ' ');
  if (!cleaned) return 'Nova conversa';
  return cleaned.length > 42 ? `${cleaned.slice(0, 42).trim()}...` : cleaned;
}

export interface ProactiveRadarCard {
  id: string;
  headline: string;
  cardBg: string;
  targetTab?: 'assistant' | 'vault' | 'gallery' | 'schedule' | 'system';
  suggestions: Array<{
    label: string;
    prompt?: string;
    dismissOnly?: boolean;
    openTab?: 'vault' | 'gallery' | 'schedule' | 'system';
  }>;
}

export function generateProactiveRadarCards(ctx: {
  pendingRemindersCount: number;
  nextReminderTitle?: string;
  vaultCount: number;
  quarantinedCount: number;
  hasGoogleConnected: boolean;
  isOnline: boolean;
}): ProactiveRadarCard[] {
  const cards: ProactiveRadarCard[] = [];

  if (ctx.quarantinedCount > 0) {
    cards.push({
      id: 'radar_quarantine',
      headline: `${ctx.quarantinedCount} arquivo(s) isolados na quarentena E2EE`,
      cardBg: '#F3E9D2',
      targetTab: 'vault',
      suggestions: [
        { label: 'Como resolvo esse alerta?', prompt: 'Explique os arquivos em quarentena e como manter o sistema seguro.' },
        { label: 'Abrir Cofre Seguro', openTab: 'vault' },
        { label: 'Agora não', dismissOnly: true },
      ],
    });
  }

  cards.push({
    id: 'radar_reminder',
    headline: ctx.nextReminderTitle
      ? `Lembrete ativo: ${ctx.nextReminderTitle}`
      : 'Organize sua rotina e backup semanal com o ZAPIA',
    cardBg: '#F3E9D2',
    targetTab: 'schedule',
    suggestions: [
      { label: 'Como evito atrasos hoje?', prompt: 'Organize minhas prioridades de hoje e crie um plano rápido.' },
      { label: 'Explique melhor esse aviso', prompt: 'Detalhe minhas rotinas, lembretes pendentes e próximos passos.' },
      { label: 'Agora não', dismissOnly: true },
    ],
  });

  if (!ctx.hasGoogleConnected) {
    cards.push({
      id: 'radar_google',
      headline: 'Conecte várias contas Gmail, Drive e Agenda no ZAPIA',
      cardBg: '#E5C267',
      targetTab: 'schedule',
      suggestions: [
        { label: 'O que o Google Workspace libera?', prompt: 'Quais tarefas você faz conectado ao meu Gmail, Drive e Agenda?' },
        { label: 'Conectar conta agora', openTab: 'schedule' },
        { label: 'Agora não', dismissOnly: true },
      ],
    });
  }

  cards.push({
    id: 'radar_studio_vault',
    headline: ctx.isOnline
      ? `Cofre AES-256-GCM com ${ctx.vaultCount} item(ns) e Estúdio HD pronto`
      : 'Modo Offline ativo: dados criptografados e protegidos localmente',
    cardBg: '#EE966C',
    targetTab: 'vault',
    suggestions: [
      { label: 'Auditar segurança do aparelho', openTab: 'system' },
      { label: 'Criar foto ou vídeo no Estúdio', openTab: 'gallery' },
      { label: 'Agora não', dismissOnly: true },
    ],
  });

  return cards;
}

export type VoiceEffectId = 'natural' | 'studio' | 'radio' | 'robot' | 'echo';

export interface VoiceEffectPreset {
  id: VoiceEffectId;
  label: string;
  description: string;
}

export const VOICE_EFFECT_PRESETS: VoiceEffectPreset[] = [
  { id: 'natural', label: 'Natural', description: 'Voz limpa e realista sem filtros' },
  { id: 'studio', label: 'Estúdio Pro', description: 'Clareza de locução e presença vocal' },
  { id: 'radio', label: 'Rádio / Comunicador', description: 'Filtro vocal nítido estilo rádio' },
  { id: 'robot', label: 'Robô ZAPIA', description: 'Modulação futurista com eco curto' },
  { id: 'echo', label: 'Eco / Palco', description: 'Ambiência espacial com reverberação' },
];

export type ApiProviderKind =
  | 'openai-compatible'
  | 'gemini'
  | 'huggingface'
  | 'media-api'
  | 'telegram-bot'
  | 'app-credentials'
  | 'webhook';

export interface ConnectorCatalogItem {
  id: string;
  name: string;
  description: string;
  category: 'mensagens' | 'redes' | 'produtividade' | 'ia-free' | 'fotos-videos' | 'dev-jogos' | 'servicos';
  brandColor: string;
  shortGlyph: string;
  authMode: 'oauth-google' | 'token-or-login' | 'api-free';
  defaultBaseUrl?: string;
  defaultModel?: string;
  placeholderHandle?: string;
}

export const CONNECTOR_CATALOG: ConnectorCatalogItem[] = [
  {
    id: 'openai_gpt',
    name: 'ChatGPT / OpenAI (GPT)',
    description: 'Conecte modelos GPT (gpt-4o-mini, gpt-4.1-mini, o3-mini) direto no ZAPIA.',
    category: 'ia-free',
    brandColor: '#10A37F',
    shortGlyph: 'GPT',
    authMode: 'api-free',
    defaultBaseUrl: 'https://api.openai.com/v1',
    defaultModel: 'gpt-4o-mini',
  },
  {
    id: 'google_gemini',
    name: 'Google Gemini API',
    description: 'Conecte sua chave externa Google AI Studio (gemini-2.5-flash) além do motor nativo.',
    category: 'ia-free',
    brandColor: '#1A73E8',
    shortGlyph: 'GM',
    authMode: 'api-free',
    defaultBaseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    defaultModel: 'gemini-2.5-flash',
  },
  {
    id: 'dola_ai',
    name: 'Dola AI (Assistente & Rotinas)',
    description: 'Conecte sua conta, token ou webhook Dola AI para cruzar notas e lembretes.',
    category: 'ia-free',
    brandColor: '#5B6CFF',
    shortGlyph: 'DL',
    authMode: 'token-or-login',
    defaultBaseUrl: 'https://www.dola.com',
    placeholderHandle: 'Conta ou Token Dola AI',
  },
  {
    id: 'suno_ai',
    name: 'Suno AI (Música & Áudio Grátis)',
    description: 'Conecte API compatível Suno para gerar trilhas musicais e vocais gratuitos.',
    category: 'fotos-videos',
    brandColor: '#EA580C',
    shortGlyph: 'SN',
    authMode: 'api-free',
    defaultBaseUrl: 'https://studio-api.prod.suno.com/api',
    defaultModel: 'chirp-v3-5',
  },
  {
    id: 'pollinations_media',
    name: 'Pollinations.ai (Fotos IA Grátis sem Chave)',
    description: 'Gere fotos e ilustrações em HD grátis na hora sem precisar de chave API.',
    category: 'fotos-videos',
    brandColor: '#7C3AED',
    shortGlyph: 'PL',
    authMode: 'api-free',
    defaultBaseUrl: 'https://image.pollinations.ai',
    defaultModel: 'flux',
  },
  {
    id: 'pexels_media',
    name: 'Pexels (Fotos e Vídeos HD Grátis API)',
    description: 'Busque e importe fotos e vídeos 4K/HD gratuitos para sua Galeria ZAPIA.',
    category: 'fotos-videos',
    brandColor: '#05A081',
    shortGlyph: 'PX',
    authMode: 'api-free',
    defaultBaseUrl: 'https://api.pexels.com/v1',
    defaultModel: 'photos-videos-hd',
  },
  {
    id: 'pixabay_media',
    name: 'Pixabay (Fotos e Vídeos Grátis API)',
    description: 'Banco gratuito de fotos, vetores e vídeos livres para projetos e redes.',
    category: 'fotos-videos',
    brandColor: '#2EC66D',
    shortGlyph: 'PB',
    authMode: 'api-free',
    defaultBaseUrl: 'https://pixabay.com/api/',
    defaultModel: 'photo-video-free',
  },
  {
    id: 'unsplash_media',
    name: 'Unsplash (Fotos Alta Resolução Grátis API)',
    description: 'Fotografias profissionais gratuitas prontas para usar no Estúdio ZAPIA.',
    category: 'fotos-videos',
    brandColor: '#111111',
    shortGlyph: 'US',
    authMode: 'api-free',
    defaultBaseUrl: 'https://api.unsplash.com',
    defaultModel: 'photos-hd',
  },
  {
    id: 'luma_video',
    name: 'Luma Dream Machine (Vídeos IA API)',
    description: 'Conecte geração de vídeos cinematográficos via Luma Labs API.',
    category: 'fotos-videos',
    brandColor: '#0EA5E9',
    shortGlyph: 'LM',
    authMode: 'api-free',
    defaultBaseUrl: 'https://api.lumalabs.ai/dream-machine/v1',
    defaultModel: 'ray-2',
  },
  {
    id: 'fal_media',
    name: 'Fal.ai Free Tier (Imagens & Vídeos IA)',
    description: 'Inferência rápida para Flux, vídeos curtos e mídia criativa com free tier.',
    category: 'fotos-videos',
    brandColor: '#8B5CF6',
    shortGlyph: 'FL',
    authMode: 'api-free',
    defaultBaseUrl: 'https://queue.fal.run',
    defaultModel: 'fal-ai/flux/schnell',
  },
  {
    id: 'whatsapp',
    name: 'WhatsApp',
    description: 'Agende mensagens, escreva respostas e resuma conversas.',
    category: 'mensagens',
    brandColor: '#25D366',
    shortGlyph: 'WA',
    authMode: 'token-or-login',
    defaultBaseUrl: 'https://graph.facebook.com/v20.0',
    placeholderHandle: '+55 (seu número ou ID Cloud API)',
  },
  {
    id: 'telegram',
    name: 'Telegram',
    description: 'Conecte bot ou @usuario para automações e alertas instantâneos.',
    category: 'mensagens',
    brandColor: '#229ED9',
    shortGlyph: 'TG',
    authMode: 'token-or-login',
    defaultBaseUrl: 'https://api.telegram.org',
    placeholderHandle: '@FFMoises29',
  },
  {
    id: 'instagram',
    name: 'Instagram',
    description: 'Crie roteiros, legendas, responda directs e analise alcance.',
    category: 'redes',
    brandColor: '#E1306C',
    shortGlyph: 'IG',
    authMode: 'token-or-login',
    defaultBaseUrl: 'https://graph.instagram.com',
    placeholderHandle: '@seu_instagram',
  },
  {
    id: 'facebook',
    name: 'Facebook',
    description: 'Gerencie páginas, publicações agendadas e mensagens.',
    category: 'redes',
    brandColor: '#1877F2',
    shortGlyph: 'FB',
    authMode: 'token-or-login',
    defaultBaseUrl: 'https://graph.facebook.com',
    placeholderHandle: 'Página ou perfil Facebook',
  },
  {
    id: 'youtube',
    name: 'YouTube',
    description: 'Pesquise vídeos, gere títulos SEO, descrições e roteiros.',
    category: 'redes',
    brandColor: '#FF0000',
    shortGlyph: 'YT',
    authMode: 'token-or-login',
    defaultBaseUrl: 'https://www.googleapis.com/youtube/v3',
    placeholderHandle: 'Canal YouTube ou API Key',
  },
  {
    id: 'outlook',
    name: 'Outlook',
    description: 'Escreva respostas, resuma e-mails e pesquise caixa de entrada.',
    category: 'produtividade',
    brandColor: '#0078D4',
    shortGlyph: 'OL',
    authMode: 'token-or-login',
    placeholderHandle: 'seu.email@outlook.com',
  },
  {
    id: 'notion',
    name: 'Notion',
    description: 'Pesquise, leia e atualize suas páginas e bancos de dados.',
    category: 'produtividade',
    brandColor: '#191919',
    shortGlyph: 'N',
    authMode: 'token-or-login',
    defaultBaseUrl: 'https://api.notion.com/v1',
    placeholderHandle: 'Workspace Notion',
  },
  {
    id: 'slack',
    name: 'Slack',
    description: 'Envie mensagens, resuma canais e priorize avisos da equipe.',
    category: 'produtividade',
    brandColor: '#4A154B',
    shortGlyph: 'SL',
    authMode: 'token-or-login',
    defaultBaseUrl: 'https://slack.com/api',
    placeholderHandle: 'Canal #geral',
  },
  {
    id: 'ifood',
    name: 'iFood',
    description: 'Encontre ofertas, acompanhe pedidos e monte sua lista.',
    category: 'servicos',
    brandColor: '#EA1D2C',
    shortGlyph: 'iF',
    authMode: 'token-or-login',
    placeholderHandle: 'Conta iFood',
  },
  {
    id: 'splitwise',
    name: 'Splitwise',
    description: 'Conecte o Splitwise para gerenciar seus saldos e despesas.',
    category: 'servicos',
    brandColor: '#1CC29F',
    shortGlyph: 'SW',
    authMode: 'token-or-login',
    placeholderHandle: 'Conta Splitwise',
  },
  {
    id: 'groq_free',
    name: 'Groq Free API (Llama / Mixtral)',
    description: 'Modelos gratuitos ultrarrápidos compatíveis com OpenAI API.',
    category: 'ia-free',
    brandColor: '#F55036',
    shortGlyph: 'GQ',
    authMode: 'api-free',
    defaultBaseUrl: 'https://api.groq.com/openai/v1',
    defaultModel: 'llama-3.3-70b-versatile',
  },
  {
    id: 'openrouter_free',
    name: 'OpenRouter Free Models',
    description: 'Acesse dezenas de modelos gratuitos (:free) com uma chave.',
    category: 'ia-free',
    brandColor: '#6366F1',
    shortGlyph: 'OR',
    authMode: 'api-free',
    defaultBaseUrl: 'https://openrouter.ai/api/v1',
    defaultModel: 'meta-llama/llama-3.3-70b-instruct:free',
  },
  {
    id: 'huggingface_free',
    name: 'Hugging Face Inference Free',
    description: 'Teste e conecte modelos abertos gratuitos via Inference API.',
    category: 'ia-free',
    brandColor: '#FFD21E',
    shortGlyph: 'HF',
    authMode: 'api-free',
    defaultBaseUrl: 'https://router.huggingface.co/v1',
    defaultModel: 'Qwen/Qwen2.5-72B-Instruct',
  },
  {
    id: 'github_dev',
    name: 'GitHub & Criação de Apps/Jogos',
    description: 'Conecte seu usuário ou token para criar apps, jogos e código.',
    category: 'dev-jogos',
    brandColor: '#24292F',
    shortGlyph: 'GH',
    authMode: 'token-or-login',
    defaultBaseUrl: 'https://api.github.com',
    placeholderHandle: '@usuario-github',
  },
];

export function filterConnectorCatalog(
  items: ConnectorCatalogItem[],
  query: string
): ConnectorCatalogItem[] {
  const q = query.trim().toLowerCase();
  if (!q) return items;
  return items.filter(
    (item) =>
      item.name.toLowerCase().includes(q) ||
      item.description.toLowerCase().includes(q) ||
      item.category.toLowerCase().includes(q) ||
      item.id.toLowerCase().includes(q)
  );
}

const PRIVATE_IP_PATTERNS = [
  /^localhost$/i,
  /\.local$/i,
  /\.internal$/i,
  /^127\./,
  /^10\./,
  /^0\./,
  /^169\.254\./,
  /^192\.168\./,
  /^172\.(1[6-9]|2\d|3[0-1])\./,
  /^\[?::1\]?$/,
  /^\[?fe80:/i,
  /^\[?fc00:/i,
  /^\[?fd/i,
];

export function validateSafeExternalUrl(rawUrl: string): { valid: boolean; url?: URL; reason?: string } {
  const trimmed = (rawUrl || '').trim();
  if (!trimmed) {
    return { valid: false, reason: 'URL da API vazia.' };
  }
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      return { valid: false, reason: 'Apenas URLs http ou https são permitidas.' };
    }
    const host = parsed.hostname.toLowerCase();
    for (const pat of PRIVATE_IP_PATTERNS) {
      if (pat.test(host)) {
        return { valid: false, reason: 'Endereços locais ou privados não são permitidos pelo proxy.' };
      }
    }
    return { valid: true, url: parsed };
  } catch {
    return { valid: false, reason: 'Formato de URL inválido.' };
  }
}

export interface VoiceSampleItem {
  id: string;
  title: string;
  mimeType: string;
  sizeBytes: number;
  durationSec: number;
  dataUrl: string;
  createdAtIso: string;
}

export interface TrainedVoiceProfile {
  id: string;
  name: string;
  baseModelId: string;
  gender: 'masculina' | 'feminina';
  vocalStylePrompt: string;
  recommendedSpeed: number;
  recommendedPitch: number;
  recommendedWarmth: number;
  timbreNotes: string;
  sampleCount: number;
  trainedAtIso: string;
  active: boolean;
}

function clampSlider(val: unknown, fallback: number): number {
  const n = typeof val === 'number' && Number.isFinite(val) ? val : fallback;
  return Math.max(0, Math.min(100, Math.round(n)));
}

export function normalizeTrainedVoiceAnalysis(input: {
  id?: string;
  profileName: string;
  gender?: string;
  recommendedBaseVoice?: string;
  recommendedSpeed?: number;
  recommendedPitch?: number;
  recommendedWarmth?: number;
  vocalStylePrompt?: string;
  timbreNotes?: string;
  sampleCount?: number;
}): TrainedVoiceProfile {
  const cleanName = (input.profileName || '').trim() || 'Voz Personalizada ZAPIA';
  const isFemale = input.gender === 'feminina';
  const validGender: 'masculina' | 'feminina' = isFemale ? 'feminina' : 'masculina';

  const allAllowed = [...MALE_VOICES, ...FEMALE_VOICES] as readonly string[];
  const requestedVoice = (input.recommendedBaseVoice || '').trim();
  let baseModelId = allAllowed.includes(requestedVoice)
    ? requestedVoice
    : isFemale
      ? 'Kore'
      : 'Fenrir';

  if (validGender === 'feminina' && !(FEMALE_VOICES as readonly string[]).includes(baseModelId)) {
    baseModelId = 'Kore';
  } else if (validGender === 'masculina' && !(MALE_VOICES as readonly string[]).includes(baseModelId)) {
    baseModelId = 'Fenrir';
  }

  return {
    id: input.id || sanitizeFirestoreId(`voice_prof_${cleanName}_${Date.now()}`),
    name: cleanName.slice(0, 60),
    baseModelId,
    gender: validGender,
    vocalStylePrompt:
      (input.vocalStylePrompt || '').trim() ||
      'Natural Brazilian Portuguese conversational timbre calibrated to user voice sample',
    recommendedSpeed: clampSlider(input.recommendedSpeed, 48),
    recommendedPitch: clampSlider(input.recommendedPitch, 50),
    recommendedWarmth: clampSlider(input.recommendedWarmth, 72),
    timbreNotes:
      (input.timbreNotes || '').trim() ||
      'Perfil acústico calibrado a partir das amostras enviadas pelo usuário.',
    sampleCount: Math.max(1, Number(input.sampleCount || 1)),
    trainedAtIso: new Date().toISOString(),
    active: true,
  };
}

export function buildTrainedVoiceStylePrompt(
  baseStyle: string,
  trained?: Pick<TrainedVoiceProfile, 'active' | 'name' | 'vocalStylePrompt'> | null
): string {
  if (!trained || !trained.active || !trained.vocalStylePrompt.trim()) {
    return baseStyle;
  }
  return `Emular a voz treinada "${trained.name}": ${trained.vocalStylePrompt}. Complemento atual: ${baseStyle}`;
}

export type DevicePlatform = 'android' | 'ios' | 'windows' | 'macos' | 'linux' | 'web';
export type DeviceE2EEStatus =
  | 'sincronizado'
  | 'sincronizando'
  | 'pendente_offline'
  | 'chave_divergente';

export interface DeviceSessionRecord {
  id: string;
  ownerId: string;
  deviceName: string;
  platform: DevicePlatform;
  e2eeFingerprint: string;
  e2eeStatus: DeviceE2EEStatus;
  syncedVaultCount: number;
  syncedRemindersCount: number;
  syncedPreferencesCount: number;
  lastSyncIso: string;
  isCurrentDevice?: boolean;
  createdAtIso?: string;
  updatedAtIso?: string;
}

export interface EncryptedExportEnvelope {
  format: 'zapia-e2ee-backup-v1';
  exportedAtIso: string;
  ownerEmail: string;
  deviceId: string;
  e2eeFingerprint: string;
  kdf: 'PBKDF2-SHA256-120000';
  cipher: 'AES-256-GCM';
  saltBase64: string;
  ivBase64: string;
  ciphertextBase64: string;
  payloadSha256: string;
  summary: {
    vaultCount: number;
    galleryCount: number;
    remindersCount: number;
    preferencesCount: number;
    connectorsCount: number;
  };
}

export function detectDeviceMetadata(
  userAgent: string = '',
  platformStr: string = ''
): { platform: DevicePlatform; deviceName: string } {
  const ua = (userAgent || '').toLowerCase();
  const plat = (platformStr || '').toLowerCase();

  let platform: DevicePlatform = 'web';
  let osLabel = 'Navegador Web';

  if (/android/.test(ua)) {
    platform = 'android';
    osLabel = 'Smartphone Android';
  } else if (/iphone|ipad|ipod/.test(ua)) {
    platform = 'ios';
    osLabel = /ipad/.test(ua) ? 'iPad (iOS)' : 'iPhone (iOS)';
  } else if (/win/.test(plat) || /windows/.test(ua)) {
    platform = 'windows';
    osLabel = 'PC Windows';
  } else if (/mac/.test(plat) || /macintosh|mac os/.test(ua)) {
    platform = 'macos';
    osLabel = 'Mac (macOS)';
  } else if (/linux/.test(plat) || /linux/.test(ua)) {
    platform = 'linux';
    osLabel = 'Desktop Linux';
  }

  let browserLabel = 'PWA';
  if (/edg\//.test(ua)) {
    browserLabel = 'Edge';
  } else if (/chrome|crios/.test(ua) && !/edg\//.test(ua)) {
    browserLabel = 'Chrome';
  } else if (/firefox|fxios/.test(ua)) {
    browserLabel = 'Firefox';
  } else if (/safari/.test(ua) && !/chrome|crios/.test(ua)) {
    browserLabel = 'Safari';
  }

  return {
    platform,
    deviceName: `${osLabel} · ${browserLabel}`.slice(0, 120),
  };
}

export function formatE2EEFingerprint(sha256Hex: string): string {
  const cleaned = (sha256Hex || '')
    .toUpperCase()
    .replace(/[^A-F0-9]/g, '')
    .padEnd(16, '0')
    .slice(0, 16);
  return `${cleaned.slice(0, 4)}:${cleaned.slice(4, 8)}:${cleaned.slice(8, 12)}:${cleaned.slice(12, 16)}`;
}

export function mergeDeviceSessions(
  localCurrent: DeviceSessionRecord,
  cloudDevices: DeviceSessionRecord[]
): DeviceSessionRecord[] {
  const map = new Map<string, DeviceSessionRecord>();
  map.set(localCurrent.id, { ...localCurrent, isCurrentDevice: true });

  for (const remote of cloudDevices) {
    if (!remote?.id) continue;
    const isCurrent = remote.id === localCurrent.id;
    const hasDivergentKey =
      !isCurrent &&
      Boolean(remote.e2eeFingerprint) &&
      Boolean(localCurrent.e2eeFingerprint) &&
      remote.e2eeFingerprint !== localCurrent.e2eeFingerprint;

    if (isCurrent) {
      map.set(remote.id, {
        ...remote,
        ...localCurrent,
        lastSyncIso:
          localCurrent.lastSyncIso >= remote.lastSyncIso
            ? localCurrent.lastSyncIso
            : remote.lastSyncIso,
        isCurrentDevice: true,
      });
    } else {
      map.set(remote.id, {
        ...remote,
        e2eeStatus: hasDivergentKey ? 'chave_divergente' : remote.e2eeStatus,
        isCurrentDevice: false,
      });
    }
  }

  return Array.from(map.values()).sort((a, b) => {
    if (a.isCurrentDevice && !b.isCurrentDevice) return -1;
    if (!a.isCurrentDevice && b.isCurrentDevice) return 1;
    return (b.lastSyncIso || '').localeCompare(a.lastSyncIso || '');
  });
}

export function validateExportPassphrase(passphrase: string): {
  valid: boolean;
  reason?: string;
  strength: 'fraca' | 'media' | 'forte';
} {
  const raw = passphrase || '';
  if (raw.trim().length < 8) {
    return {
      valid: false,
      reason: 'A senha de exportação precisa ter pelo menos 8 caracteres.',
      strength: 'fraca',
    };
  }
  const hasUpper = /[A-Z]/.test(raw);
  const hasLower = /[a-z]/.test(raw);
  const hasDigit = /\d/.test(raw);
  const hasSymbol = /[^A-Za-z0-9\s]/.test(raw);
  const score = [hasUpper, hasLower, hasDigit, hasSymbol].filter(Boolean).length;

  if (raw.length >= 12 && score >= 3) {
    return { valid: true, strength: 'forte' };
  }
  return { valid: true, strength: 'media' };
}

export type SensitiveCategory =
  | 'api_key'
  | 'private_key'
  | 'password'
  | 'cpf'
  | 'cnpj'
  | 'credit_card'
  | 'cvv'
  | 'bank_pix'
  | 'rg'
  | 'seed_phrase';

export interface SensitiveFinding {
  category: SensitiveCategory;
  label: string;
  severity: 'medio' | 'alto';
  previewMasked: string;
  replacementTag: string;
}

export interface SensitiveContentAnalysis {
  hasSensitiveData: boolean;
  riskLevel: 'nenhum' | 'medio' | 'alto';
  findings: SensitiveFinding[];
  maskedText: string;
  suggestedTitle: string;
}

function passesLuhnCheck(digitsOnly: string): boolean {
  if (digitsOnly.length < 13 || digitsOnly.length > 19) return false;
  if (/^(\d)\1+$/.test(digitsOnly)) return false;
  let sum = 0;
  let shouldDouble = false;
  for (let i = digitsOnly.length - 1; i >= 0; i--) {
    let digit = digitsOnly.charCodeAt(i) - 48;
    if (digit < 0 || digit > 9) return false;
    if (shouldDouble) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
    shouldDouble = !shouldDouble;
  }
  return sum % 10 === 0;
}

function maskPreviewString(raw: string): string {
  const clean = raw.trim();
  if (clean.length <= 6) return '••••••';
  return `${clean.slice(0, 4)}••••${clean.slice(-3)}`;
}

interface MatchSpan {
  start: number;
  end: number;
  finding: SensitiveFinding;
}

export function analyzeSensitiveContent(text: string): SensitiveContentAnalysis {
  const raw = text || '';
  if (!raw.trim()) {
    return {
      hasSensitiveData: false,
      riskLevel: 'nenhum',
      findings: [],
      maskedText: raw,
      suggestedTitle: 'Nota_Protegida_ZAPIA.txt',
    };
  }

  const spans: MatchSpan[] = [];

  const collectMatches = (
    regex: RegExp,
    build: (m: RegExpExecArray) => { start: number; end: number; finding: SensitiveFinding } | null
  ) => {
    const flags = regex.flags.includes('g') ? regex.flags : `${regex.flags}g`;
    const re = new RegExp(regex.source, flags);
    let m: RegExpExecArray | null;
    while ((m = re.exec(raw)) !== null) {
      const built = build(m);
      if (built && built.end > built.start) {
        spans.push(built);
      }
      if (m.index === re.lastIndex) {
        re.lastIndex += 1;
      }
    }
  };

  // 1. PEM Private Keys
  collectMatches(
    /-----BEGIN (?:RSA |EC |DSA |OPENSSH |PGP )?PRIVATE KEY-----[\s\S]*?(?:-----END [^\n-]+-----|$)/,
    (m) => ({
      start: m.index,
      end: m.index + m[0].length,
      finding: {
        category: 'private_key',
        label: 'Chave Privada / Certificado',
        severity: 'alto',
        previewMasked: '-----BEGIN PRIVATE KEY----- ••••',
        replacementTag: '[CHAVE PRIVADA PROTEGIDA]',
      },
    })
  );

  // 2. Provider API Keys, Bot Tokens & JWTs
  const apiKeyPatterns: Array<{ regex: RegExp; label: string }> = [
    { regex: /\bAIza[0-9A-Za-z_-]{24,}\b/, label: 'Chave API Google/Gemini' },
    { regex: /\bsk-(?:proj-|live-|test-)?[0-9A-Za-z_-]{18,}\b/, label: 'Chave Secreta OpenAI/Stripe' },
    { regex: /\bgsk_[0-9A-Za-z_-]{18,}\b/, label: 'Chave API Groq' },
    { regex: /\bhf_[0-9A-Za-z_-]{18,}\b/, label: 'Token Hugging Face' },
    { regex: /\b(?:ghp|gho|ghu|ghs)_[0-9A-Za-z]{20,}|github_pat_[0-9A-Za-z_]{24,}\b/, label: 'Token GitHub' },
    { regex: /\bAKIA[0-9A-Z]{16}\b/, label: 'Chave AWS Access Key' },
    { regex: /\bxox[baprs]-[0-9A-Za-z-]{14,}\b/, label: 'Token Slack' },
    { regex: /\b\d{8,11}:[A-Za-z0-9_-]{28,}\b/, label: 'Token Bot Telegram' },
    { regex: /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{8,}\b/, label: 'Token JWT / Bearer' },
  ];

  for (const item of apiKeyPatterns) {
    collectMatches(item.regex, (m) => ({
      start: m.index,
      end: m.index + m[0].length,
      finding: {
        category: 'api_key',
        label: item.label,
        severity: 'alto',
        previewMasked: maskPreviewString(m[0]),
        replacementTag: '[CHAVE API PROTEGIDA]',
      },
    }));
  }

  // Generic labeled API key / secret / token assignments
  collectMatches(
    /\b(?:api[_-]?key|access[_-]?token|client[_-]?secret|bearer)\s*(?::|=|\bé\b)\s*["']?([A-Za-z0-9_.-]{14,})["']?/i,
    (m) => {
      const secretVal = m[1] || m[0];
      const offset = m[0].lastIndexOf(secretVal);
      const start = offset >= 0 ? m.index + offset : m.index;
      return {
        start,
        end: start + secretVal.length,
        finding: {
          category: 'api_key',
          label: 'Credencial / Token de API',
          severity: 'alto',
          previewMasked: maskPreviewString(secretVal),
          replacementTag: '[CHAVE API PROTEGIDA]',
        },
      };
    }
  );

  // 3. Explicit Passwords & PINs (supports Portuguese context like "senha do banco: ...")
  collectMatches(
    /\b(?:senha|password|pwd|pin|c[oó]digo\s+secreto)(?:\s+(?:d[aeo]s?\s+[^\s:=]{2,20})){0,2}\s*(?::|=|\bé\b|\beh\b)\s*["']?([^\s"',;]{4,})["']?/i,
    (m) => {
      const secretVal = m[1] || '';
      const lowerVal = secretVal.toLowerCase();
      if (!secretVal || ['aqui', 'nova', 'forte', 'fraca', 'atual'].includes(lowerVal)) {
        return null;
      }
      const offset = m[0].lastIndexOf(secretVal);
      const start = offset >= 0 ? m.index + offset : m.index;
      return {
        start,
        end: start + secretVal.length,
        finding: {
          category: 'password',
          label: 'Senha ou PIN de Acesso',
          severity: 'alto',
          previewMasked: '••••••••',
          replacementTag: '[SENHA PROTEGIDA]',
        },
      };
    }
  );

  // 4. CPF (formatted XXX.XXX.XXX-XX or labeled CPF + 11 digits)
  collectMatches(/\b\d{3}\.\d{3}\.\d{3}-\d{2}\b/, (m) => ({
    start: m.index,
    end: m.index + m[0].length,
    finding: {
      category: 'cpf',
      label: 'CPF',
      severity: 'alto',
      previewMasked: `${m[0].slice(0, 3)}.•••.•••-${m[0].slice(-2)}`,
      replacementTag: '[CPF PROTEGIDO]',
    },
  }));

  collectMatches(/\bcpf\s*(?::|=|\bn[úu]mero\b|\bé\b)?\s*(\d{11})\b/i, (m) => {
    const digits = m[1];
    const offset = m[0].lastIndexOf(digits);
    const start = offset >= 0 ? m.index + offset : m.index;
    return {
      start,
      end: start + digits.length,
      finding: {
        category: 'cpf',
        label: 'CPF',
        severity: 'alto',
        previewMasked: `${digits.slice(0, 3)}••••••${digits.slice(-2)}`,
        replacementTag: '[CPF PROTEGIDO]',
      },
    };
  });

  // 5. CNPJ
  collectMatches(/\b\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}\b/, (m) => ({
    start: m.index,
    end: m.index + m[0].length,
    finding: {
      category: 'cnpj',
      label: 'CNPJ',
      severity: 'medio',
      previewMasked: `${m[0].slice(0, 2)}.•••.•••/${m[0].slice(-7)}`,
      replacementTag: '[CNPJ PROTEGIDO]',
    },
  }));

  // 6. Credit/Debit Card numbers validated with Luhn
  collectMatches(/(?<!\d)(?:\d[ -]?){12,18}\d(?!\d)/, (m) => {
    const digits = m[0].replace(/\D/g, '');
    if (!passesLuhnCheck(digits)) return null;
    return {
      start: m.index,
      end: m.index + m[0].length,
      finding: {
        category: 'credit_card',
        label: 'Número de Cartão (Financeiro)',
        severity: 'alto',
        previewMasked: `•••• •••• •••• ${digits.slice(-4)}`,
        replacementTag: '[CARTÃO PROTEGIDO]',
      },
    };
  });

  // CVV
  collectMatches(/\bcvv\s*(?::|=|\bé\b)\s*(\d{3,4})\b/i, (m) => {
    const code = m[1];
    const offset = m[0].lastIndexOf(code);
    const start = offset >= 0 ? m.index + offset : m.index;
    return {
      start,
      end: start + code.length,
      finding: {
        category: 'cvv',
        label: 'Código de Segurança (CVV)',
        severity: 'alto',
        previewMasked: '•••',
        replacementTag: '[CVV PROTEGIDO]',
      },
    };
  });

  // 7. Labeled RG / Bank & Pix credentials
  collectMatches(/\brg\s*(?::|=|\bé\b)\s*([0-9A-Za-z.-]{6,14})\b/i, (m) => {
    const val = m[1];
    const offset = m[0].lastIndexOf(val);
    const start = offset >= 0 ? m.index + offset : m.index;
    return {
      start,
      end: start + val.length,
      finding: {
        category: 'rg',
        label: 'Documento RG',
        severity: 'medio',
        previewMasked: maskPreviewString(val),
        replacementTag: '[RG PROTEGIDO]',
      },
    };
  });

  collectMatches(
    /\b(?:ag[êe]ncia|conta\s*(?:corrente|poupan[çc]a)?|chave\s*pix)\s*(?::|=|\bé\b)\s*([^\s,;]{5,})/i,
    (m) => {
      const val = m[1];
      const offset = m[0].lastIndexOf(val);
      const start = offset >= 0 ? m.index + offset : m.index;
      return {
        start,
        end: start + val.length,
        finding: {
          category: 'bank_pix',
          label: 'Dados Bancários / Chave Pix',
          severity: 'medio',
          previewMasked: maskPreviewString(val),
          replacementTag: '[DADO BANCÁRIO PROTEGIDO]',
        },
      };
    }
  );

  // 8. Crypto Seed Phrases
  collectMatches(
    /\b(?:seed\s*phrase|frase\s*(?:semente|secreta|de\s*recupera[çc][ãa]o)|mnem[ôo]nic[oa]?)\s*(?::|=|\bé\b)?\s*((?:[a-z]{3,12}\s+){11,23}[a-z]{3,12})\b/i,
    (m) => {
      const words = m[1];
      const offset = m[0].lastIndexOf(words);
      const start = offset >= 0 ? m.index + offset : m.index;
      return {
        start,
        end: start + words.length,
        finding: {
          category: 'seed_phrase',
          label: 'Frase Semente Cripto (Seed Phrase)',
          severity: 'alto',
          previewMasked: '12+ palavras secretas',
          replacementTag: '[FRASE SECRETA PROTEGIDA]',
        },
      };
    }
  );

  if (spans.length === 0) {
    return {
      hasSensitiveData: false,
      riskLevel: 'nenhum',
      findings: [],
      maskedText: raw,
      suggestedTitle: 'Nota_Protegida_ZAPIA.txt',
    };
  }

  // Sort by start index, longest match first on ties, and merge/drop overlaps
  spans.sort((a, b) => (a.start !== b.start ? a.start - b.start : b.end - a.end));
  const nonOverlapping: MatchSpan[] = [];
  let cursorEnd = -1;
  for (const sp of spans) {
    if (sp.start >= cursorEnd) {
      nonOverlapping.push(sp);
      cursorEnd = sp.end;
    }
  }

  let maskedText = '';
  let lastIdx = 0;
  for (const sp of nonOverlapping) {
    maskedText += raw.slice(lastIdx, sp.start) + sp.finding.replacementTag;
    lastIdx = sp.end;
  }
  maskedText += raw.slice(lastIdx);

  const findings = nonOverlapping.map((sp) => sp.finding);
  const hasHigh = findings.some((f) => f.severity === 'alto');
  const primaryTag = findings[0]?.category.toUpperCase() || 'SEGREDO';
  const dateStamp = new Date().toISOString().slice(0, 10);

  return {
    hasSensitiveData: true,
    riskLevel: hasHigh ? 'alto' : 'medio',
    findings,
    maskedText,
    suggestedTitle: sanitizeFirestoreId(`Cofre_${primaryTag}_${dateStamp}`).concat('.txt'),
  };
}

export interface SelfKnowledgeSummary {
  totalCheckins: number;
  averageEnergy: number;
  dominantMood: string;
  latestFocusGoal: string;
  suggestedCoachPrompt: string;
  summaryText: string;
}

export function summarizeSelfKnowledgeInsights(
  checkins: Array<{
    dateIso: string;
    mood: string;
    energy: number;
    focusGoal: string;
    reflection: string;
  }>
): SelfKnowledgeSummary {
  if (!checkins || checkins.length === 0) {
    return {
      totalCheckins: 0,
      averageEnergy: 0,
      dominantMood: 'sem registros',
      latestFocusGoal: 'Definir prioridade do dia',
      suggestedCoachPrompt:
        'Quero começar meu treinamento diário de autoconhecimento hoje. Faça 3 perguntas rápidas para mapear meu foco, energia e próximos passos.',
      summaryText:
        'Nenhum check-in registrado ainda. Registre seu humor e foco diário para o ZAPIA calibrar sua rotina e produtividade.',
    };
  }

  const totalCheckins = checkins.length;
  const sumEnergy = checkins.reduce((acc, c) => acc + (Number(c.energy) || 0), 0);
  const averageEnergy = Number((sumEnergy / totalCheckins).toFixed(1));

  const moodCounts = new Map<string, number>();
  for (const c of checkins) {
    const mood = (c.mood || 'focado').toLowerCase();
    moodCounts.set(mood, (moodCounts.get(mood) || 0) + 1);
  }
  let dominantMood = checkins[0].mood || 'focado';
  let topCount = 0;
  for (const [m, cnt] of moodCounts.entries()) {
    if (cnt > topCount) {
      topCount = cnt;
      dominantMood = m;
    }
  }

  const latest = checkins[0];
  const latestFocusGoal = latest.focusGoal || 'Manter clareza e constância';
  const recentSnippet = checkins
    .slice(0, 3)
    .map((c) => `${c.dateIso}: humor ${c.mood}, energia ${c.energy}/10, foco "${c.focusGoal}"`)
    .join('; ');

  return {
    totalCheckins,
    averageEnergy,
    dominantMood,
    latestFocusGoal,
    suggestedCoachPrompt: `Analise meu histórico recente de autoconhecimento (${recentSnippet}) e sugira um plano prático de foco, ritmo e bem-estar para hoje.`,
    summaryText: `${totalCheckins} registro(s) · Energia média ${averageEnergy}/10 · Humor predominante: ${dominantMood} · Foco atual: "${latestFocusGoal}".`,
  };
}

export type SentimentPolarity = 'positivo' | 'neutro' | 'negativo' | 'misto';

export interface SentimentResult {
  polarity: SentimentPolarity;
  score: number;
  label: string;
  toneHint: string;
  positiveMatches: string[];
  negativeMatches: string[];
}

const POSITIVE_SENTIMENT_WORDS = new Set([
  'feliz',
  'otimo',
  'otima',
  'excelente',
  'maravilhoso',
  'maravilhosa',
  'bom',
  'boa',
  'bem',
  'focado',
  'focada',
  'motivado',
  'motivada',
  'inspirado',
  'inspirada',
  'grato',
  'grata',
  'gratidao',
  'produtivo',
  'produtiva',
  'alegre',
  'conquista',
  'conquistei',
  'sucesso',
  'orgulho',
  'leve',
  'tranquilo',
  'tranquila',
  'calmo',
  'calma',
  'confiante',
  'animado',
  'animada',
  'criativo',
  'criativa',
  'amei',
  'adorei',
  'gostei',
  'perfeito',
  'perfeita',
  'evoluindo',
  'evolucao',
  'consegui',
  'clareza',
  'satisfeito',
  'satisfeita',
  'avanco',
  'avancei',
  'paz',
  'vitoria',
  'disposto',
  'disposta',
]);

const NEGATIVE_SENTIMENT_WORDS = new Set([
  'triste',
  'cansado',
  'cansada',
  'exausto',
  'exausta',
  'estressado',
  'estressada',
  'estresse',
  'ansioso',
  'ansiosa',
  'ansiedade',
  'preocupado',
  'preocupada',
  'ruim',
  'pessimo',
  'pessima',
  'horrivel',
  'dificil',
  'frustrado',
  'frustrada',
  'raiva',
  'desanimado',
  'desanimada',
  'bloqueado',
  'atrasado',
  'atrasada',
  'perdido',
  'perdida',
  'dor',
  'medo',
  'sobrecarregado',
  'sobrecarregada',
  'esgotado',
  'esgotada',
  'odiei',
  'falha',
  'falhei',
  'erro',
  'problema',
  'tenso',
  'tensa',
  'angustiado',
  'chateado',
  'chateada',
  'insatisfeito',
  'desgastado',
  'prejuizo',
]);

const NEGATION_TOKENS = new Set(['nao', 'nem', 'nunca', 'jamais', 'sem']);
const INTENSIFIER_TOKENS = new Set(['muito', 'super', 'bem', 'bastante', 'extremamente', 'demais']);

function normalizePtTokens(text: string): string[] {
  return (text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

export function analyzeSentiment(text: string): SentimentResult {
  const tokens = normalizePtTokens(text);
  if (tokens.length === 0) {
    return {
      polarity: 'neutro',
      score: 0,
      label: 'Neutro',
      toneHint: 'Sem texto suficiente',
      positiveMatches: [],
      negativeMatches: [],
    };
  }

  let rawScore = 0;
  const positiveMatches: string[] = [];
  const negativeMatches: string[] = [];

  for (let i = 0; i < tokens.length; i++) {
    const tok = tokens[i];
    const prev1 = i > 0 ? tokens[i - 1] : '';
    const prev2 = i > 1 ? tokens[i - 2] : '';
    const isNegated = NEGATION_TOKENS.has(prev1) || NEGATION_TOKENS.has(prev2);
    const weight = INTENSIFIER_TOKENS.has(prev1) ? 1.5 : 1;

    if (POSITIVE_SENTIMENT_WORDS.has(tok)) {
      if (isNegated) {
        rawScore -= weight;
        negativeMatches.push(`não ${tok}`);
      } else {
        rawScore += weight;
        positiveMatches.push(tok);
      }
    } else if (NEGATIVE_SENTIMENT_WORDS.has(tok)) {
      if (isNegated) {
        rawScore += weight * 0.7;
        positiveMatches.push(`sem ${tok}`);
      } else {
        rawScore -= weight;
        negativeMatches.push(tok);
      }
    }
  }

  const totalHits = positiveMatches.length + negativeMatches.length;
  const normalizedScore =
    totalHits === 0 ? 0 : Math.max(-1, Math.min(1, Number((rawScore / (totalHits + 1)).toFixed(2))));

  let polarity: SentimentPolarity = 'neutro';
  let label = 'Neutro';
  let toneHint = 'Tom objetivo e equilibrado';

  if (positiveMatches.length > 0 && negativeMatches.length > 0 && Math.abs(normalizedScore) < 0.2) {
    polarity = 'misto';
    label = 'Misto';
    toneHint = 'Sinais positivos e pontos de atenção';
  } else if (normalizedScore >= 0.15) {
    polarity = 'positivo';
    label = 'Positivo';
    toneHint = normalizedScore >= 0.5 ? 'Alta motivação e confiança' : 'Estado construtivo e leve';
  } else if (normalizedScore <= -0.15) {
    polarity = 'negativo';
    label = 'Negativo';
    toneHint = normalizedScore <= -0.5 ? 'Sinal de desgaste ou tensão' : 'Ponto de atenção emocional';
  }

  return {
    polarity,
    score: normalizedScore,
    label,
    toneHint,
    positiveMatches: Array.from(new Set(positiveMatches)).slice(0, 5),
    negativeMatches: Array.from(new Set(negativeMatches)).slice(0, 5),
  };
}

export interface WeeklySummaryReport {
  periodLabel: string;
  checkinCount: number;
  averageEnergy: number;
  dominantMood: string;
  userMessageCount: number;
  assistantMessageCount: number;
  vaultSavedCount: number;
  completedReminders: number;
  pendingReminders: number;
  securityAlertsCount: number;
  overallSentiment: SentimentResult;
  highlights: string[];
  aiPrompt: string;
}

export function buildWeeklySummary(input: {
  checkins: Array<{
    dateIso?: string;
    mood: string;
    energy: number;
    focusGoal: string;
    reflection: string;
    createdAtIso: string;
  }>;
  messages: Array<{
    role: 'user' | 'assistant';
    content: string;
    createdAtIso: string;
  }>;
  vaultItems: Array<{
    scanStatus: string;
    createdAtIso: string;
  }>;
  reminders: Array<{
    status: string;
    createdAtIso: string;
  }>;
  auditLogs?: Array<{
    verdict: string;
    createdAtIso: string;
  }>;
  nowIso?: string;
}): WeeklySummaryReport {
  const nowMs = input.nowIso ? Date.parse(input.nowIso) : Date.now();
  const safeNowMs = Number.isFinite(nowMs) ? nowMs : Date.now();
  const weekStartMs = safeNowMs - 7 * 24 * 60 * 60 * 1000;

  const inLast7Days = (iso?: string): boolean => {
    if (!iso) return false;
    const t = Date.parse(iso);
    return Number.isFinite(t) && t >= weekStartMs && t <= safeNowMs + 60000;
  };

  const weekCheckins = (input.checkins || []).filter((c) => inLast7Days(c.createdAtIso));
  const weekMessages = (input.messages || []).filter((m) => inLast7Days(m.createdAtIso));
  const weekVault = (input.vaultItems || []).filter((v) => inLast7Days(v.createdAtIso));
  const weekReminders = (input.reminders || []).filter((r) => inLast7Days(r.createdAtIso));
  const weekAudits = (input.auditLogs || []).filter((a) => inLast7Days(a.createdAtIso));

  const checkinSummary = summarizeSelfKnowledgeInsights(
    weekCheckins.map((c) => ({
      dateIso: c.dateIso || c.createdAtIso.slice(0, 10),
      mood: c.mood,
      energy: c.energy,
      focusGoal: c.focusGoal,
      reflection: c.reflection,
    }))
  );

  const userMessages = weekMessages.filter((m) => m.role === 'user');
  const assistantMessages = weekMessages.filter((m) => m.role === 'assistant');

  const sentimentCorpus = [
    ...weekCheckins.map((c) => `${c.mood} ${c.focusGoal} ${c.reflection}`),
    ...userMessages.map((m) => m.content),
  ]
    .filter(Boolean)
    .join(' . ');

  const overallSentiment = analyzeSentiment(sentimentCorpus);

  const completedReminders = weekReminders.filter((r) => r.status === 'concluido').length;
  const pendingReminders = (input.reminders || []).filter((r) => r.status === 'pendente').length;
  const securityAlertsCount =
    weekVault.filter((v) => v.scanStatus !== 'limpo').length +
    weekAudits.filter((a) => a.verdict !== 'seguro').length;

  const startLabel = new Date(weekStartMs).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  const endLabel = new Date(safeNowMs).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });

  const highlights: string[] = [];
  if (weekCheckins.length > 0) {
    highlights.push(
      `${weekCheckins.length} check-in(s) emocional(is) com energia média ${checkinSummary.averageEnergy}/10 e humor "${checkinSummary.dominantMood}".`
    );
  } else {
    highlights.push('Nenhum check-in registrado nos últimos 7 dias — faça seu primeiro registro para calibrar o radar emocional.');
  }

  highlights.push(
    `Sentimento predominante da semana: ${overallSentiment.label} (${overallSentiment.toneHint}).`
  );

  if (weekVault.length > 0 || completedReminders > 0) {
    highlights.push(
      `${weekVault.length} documento(s) protegidos no Cofre E2EE e ${completedReminders} lembrete(s) concluído(s).`
    );
  } else if (userMessages.length > 0) {
    highlights.push(
      `${userMessages.length} comando(s) enviados ao ZAPIA MS nos últimos 7 dias (${pendingReminders} lembrete(s) ativo(s)).`
    );
  }

  if (securityAlertsCount > 0) {
    highlights.push(`${securityAlertsCount} alerta(s) de segurança ou quarentena registrados no período.`);
  }

  const aiPrompt = `Gere um Resumo Semanal ZAPIA MS personalizado com foco em produtividade e bem-estar considerando os últimos 7 dias (${startLabel} a ${endLabel}): ${weekCheckins.length} check-ins (energia média ${checkinSummary.averageEnergy}/10, humor ${checkinSummary.dominantMood}), sentimento geral ${overallSentiment.label}, ${userMessages.length} perguntas enviadas, ${weekVault.length} arquivos no Cofre E2EE e ${completedReminders} tarefas concluídas.`;

  return {
    periodLabel: `${startLabel} – ${endLabel}`,
    checkinCount: weekCheckins.length,
    averageEnergy: checkinSummary.averageEnergy,
    dominantMood: checkinSummary.dominantMood,
    userMessageCount: userMessages.length,
    assistantMessageCount: assistantMessages.length,
    vaultSavedCount: weekVault.length,
    completedReminders,
    pendingReminders,
    securityAlertsCount,
    overallSentiment,
    highlights,
    aiPrompt,
  };
}


