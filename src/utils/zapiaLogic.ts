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
  | 'telegram-bot'
  | 'app-credentials'
  | 'webhook';

export interface ConnectorCatalogItem {
  id: string;
  name: string;
  description: string;
  category: 'mensagens' | 'redes' | 'produtividade' | 'ia-free' | 'dev-jogos' | 'servicos';
  brandColor: string;
  shortGlyph: string;
  authMode: 'oauth-google' | 'token-or-login' | 'api-free';
  defaultBaseUrl?: string;
  defaultModel?: string;
  placeholderHandle?: string;
}

export const CONNECTOR_CATALOG: ConnectorCatalogItem[] = [
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
      item.category.toLowerCase().includes(q)
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


