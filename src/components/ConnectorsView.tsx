import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  CheckCircle2,
  ChevronRight,
  Cpu,
  CreditCard,
  ExternalLink,
  Film,
  FlaskConical,
  ImagePlus,
  KeyRound,
  Loader2,
  LogIn,
  Music2,
  Plus,
  Search,
  ShieldCheck,
  Sparkles,
  Trash2,
  X,
  AlertCircle,
} from 'lucide-react';
import {
  ApiProviderKind,
  CONNECTOR_CATALOG,
  ConnectorCatalogItem,
  filterConnectorCatalog,
  sanitizeFirestoreId,
} from '../utils/zapiaLogic';
import {
  LinkedAccountMeta,
  LocalConnector,
  LocalSavedCardMeta,
} from '../utils/offlineDb';
import { decryptBytesE2EE, encryptBytesE2EE } from '../utils/cryptoVault';

interface ConnectorsViewProps {
  connectors: LocalConnector[];
  savedCards: LocalSavedCardMeta[];
  accounts: LinkedAccountMeta[];
  activeEmail: string | null;
  hasGoogleToken: boolean;
  initialCatalogId?: string | null;
  onConsumeInitialCatalogId?: () => void;
  onSaveConnector: (connector: LocalConnector) => Promise<void>;
  onDeleteConnector: (id: string) => Promise<void>;
  onSetActiveAiConnector: (id: string | null) => Promise<void>;
  onSaveCard: (card: LocalSavedCardMeta) => Promise<void>;
  onDeleteCard: (id: string) => Promise<void>;
  onAddGoogleAccount: (hint?: string) => Promise<void>;
  onOpenScheduleWorkspace: () => void;
  onOpenCodeStudio: () => void;
  onImportMediaToGallery?: (item: {
    id: string;
    title: string;
    kind: 'photo' | 'video';
    mimeType: string;
    dataUrl: string;
  }) => Promise<void>;
}

interface EditorFormState {
  id?: string;
  name: string;
  mode: 'api-free' | 'app-login';
  providerKind: ApiProviderKind;
  catalogId?: string;
  category: string;
  brandColor: string;
  shortGlyph: string;
  baseUrl: string;
  modelId: string;
  accountLabel: string;
  secret: string;
  isCustom: boolean;
  isActiveAiModel: boolean;
}

interface MediaSearchResultItem {
  id: string;
  title: string;
  kind: 'photo' | 'video';
  previewUrl: string;
  fullUrl: string;
  mimeType: string;
  author: string;
}

const MAIS_APPS_IDS = ['whatsapp', 'outlook', 'notion', 'slack', 'ifood'] as const;
const QUICK_MEDIA_AI_IDS = [
  'openai_gpt',
  'google_gemini',
  'dola_ai',
  'suno_ai',
  'pollinations_media',
  'pexels_media',
  'pixabay_media',
  'unsplash_media',
] as const;

type CatalogFilterCategory = 'all' | 'ai' | 'media' | 'apps';

export const ConnectorsView: React.FC<ConnectorsViewProps> = ({
  connectors,
  savedCards,
  accounts,
  activeEmail,
  hasGoogleToken,
  initialCatalogId,
  onConsumeInitialCatalogId,
  onSaveConnector,
  onDeleteConnector,
  onSetActiveAiConnector,
  onSaveCard,
  onDeleteCard,
  onAddGoogleAccount,
  onOpenScheduleWorkspace,
  onOpenCodeStudio,
  onImportMediaToGallery,
}) => {
  const [subView, setSubView] = useState<'main' | 'catalog'>('main');
  const [searchQuery, setSearchQuery] = useState('');
  const [catalogCategory, setCatalogCategory] = useState<CatalogFilterCategory>('all');
  const [editorOpen, setEditorOpen] = useState(false);
  const [cardModalOpen, setCardModalOpen] = useState(false);
  const [googleModalOpen, setGoogleModalOpen] = useState(false);

  const [mediaProvider, setMediaProvider] = useState<'pollinations' | 'pexels' | 'pixabay' | 'unsplash'>('pollinations');
  const [mediaKind, setMediaKind] = useState<'photo' | 'video'>('photo');
  const [mediaQuery, setMediaQuery] = useState('');
  const [isSearchingMedia, setIsSearchingMedia] = useState(false);
  const [mediaError, setMediaError] = useState<string | null>(null);
  const [mediaResults, setMediaResults] = useState<MediaSearchResultItem[]>([]);
  const [savedMediaIds, setSavedMediaIds] = useState<Record<string, boolean>>({});

  const [form, setForm] = useState<EditorFormState>({
    name: '',
    mode: 'api-free',
    providerKind: 'openai-compatible',
    category: 'ia-free',
    brandColor: '#1E1E24',
    shortGlyph: 'AI',
    baseUrl: 'https://api.groq.com/openai/v1',
    modelId: 'llama-3.3-70b-versatile',
    accountLabel: '',
    secret: '',
    isCustom: true,
    isActiveAiModel: false,
  });

  const [isTesting, setIsTesting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);

  const [cardNickname, setCardNickname] = useState('');
  const [cardBrand, setCardBrand] = useState('Mastercard');
  const [cardLast4, setCardLast4] = useState('');

  const filteredCatalog = useMemo(() => {
    const byQuery = filterConnectorCatalog(CONNECTOR_CATALOG, searchQuery);
    if (catalogCategory === 'all') return byQuery;
    if (catalogCategory === 'ai') return byQuery.filter((i) => i.category === 'ia-free');
    if (catalogCategory === 'media') return byQuery.filter((i) => i.category === 'fotos-videos');
    return byQuery.filter((i) => i.category !== 'ia-free' && i.category !== 'fotos-videos');
  }, [searchQuery, catalogCategory]);

  const quickMoreApps = useMemo(
    () =>
      MAIS_APPS_IDS.map((id) => CONNECTOR_CATALOG.find((c) => c.id === id)).filter(
        (x): x is ConnectorCatalogItem => Boolean(x)
      ),
    []
  );

  const quickAiMediaApps = useMemo(
    () =>
      QUICK_MEDIA_AI_IDS.map((id) => CONNECTOR_CATALOG.find((c) => c.id === id)).filter(
        (x): x is ConnectorCatalogItem => Boolean(x)
      ),
    []
  );

  const openEditorFromCatalog = (item: ConnectorCatalogItem) => {
    const existing = connectors.find((c) => c.catalogId === item.id || c.name === item.name);
    if (existing) {
      openEditorForExisting(existing);
      return;
    }
    const isApiFree = item.authMode === 'api-free';
    const providerKind: ApiProviderKind =
      item.id === 'telegram'
        ? 'telegram-bot'
        : item.id === 'google_gemini'
          ? 'gemini'
          : item.id === 'huggingface_free'
            ? 'huggingface'
            : item.category === 'fotos-videos'
              ? 'media-api'
              : isApiFree
                ? 'openai-compatible'
                : 'app-credentials';

    setForm({
      name: item.name,
      mode: isApiFree ? 'api-free' : 'app-login',
      providerKind,
      catalogId: item.id,
      category: item.category,
      brandColor: item.brandColor,
      shortGlyph: item.shortGlyph,
      baseUrl: item.defaultBaseUrl || '',
      modelId: item.defaultModel || '',
      accountLabel: item.placeholderHandle || '',
      secret: '',
      isCustom: false,
      isActiveAiModel: isApiFree && item.category === 'ia-free',
    });
    setTestResult(null);
    setEditorOpen(true);
  };

  useEffect(() => {
    if (!initialCatalogId) return;
    const item = CONNECTOR_CATALOG.find((c) => c.id === initialCatalogId);
    if (item) {
      openEditorFromCatalog(item);
    }
    onConsumeInitialCatalogId?.();
  }, [initialCatalogId]);

  const openCustomEditor = (defaultMode: 'api-free' | 'app-login' = 'api-free') => {
    setForm({
      name: '',
      mode: defaultMode,
      providerKind: defaultMode === 'api-free' ? 'openai-compatible' : 'app-credentials',
      category: defaultMode === 'api-free' ? 'ia-free' : 'custom',
      brandColor: '#1E1E24',
      shortGlyph: defaultMode === 'api-free' ? 'AI' : 'AP',
      baseUrl: defaultMode === 'api-free' ? 'https://api.groq.com/openai/v1' : '',
      modelId: defaultMode === 'api-free' ? 'llama-3.3-70b-versatile' : '',
      accountLabel: '',
      secret: '',
      isCustom: true,
      isActiveAiModel: defaultMode === 'api-free',
    });
    setTestResult(null);
    setEditorOpen(true);
  };

  const openEditorForExisting = async (conn: LocalConnector) => {
    let decryptedSecret = '';
    if (conn.encryptedSecret && conn.secretIv) {
      try {
        const bytes = await decryptBytesE2EE(conn.encryptedSecret, conn.secretIv);
        decryptedSecret = new TextDecoder().decode(bytes);
      } catch {
        decryptedSecret = '';
      }
    }
    const isApiMode =
      conn.providerKind === 'openai-compatible' ||
      conn.providerKind === 'gemini' ||
      conn.providerKind === 'huggingface' ||
      conn.providerKind === 'media-api' ||
      conn.providerKind === 'webhook';

    setForm({
      id: conn.id,
      name: conn.name,
      mode: isApiMode ? 'api-free' : 'app-login',
      providerKind: conn.providerKind,
      catalogId: conn.catalogId,
      category: conn.category,
      brandColor: conn.brandColor,
      shortGlyph: conn.shortGlyph,
      baseUrl: conn.baseUrl || '',
      modelId: conn.modelId || '',
      accountLabel: conn.accountLabel || '',
      secret: decryptedSecret,
      isCustom: conn.isCustom,
      isActiveAiModel: Boolean(conn.isActiveAiModel),
    });
    setTestResult(
      conn.lastTestMessage
        ? { ok: conn.lastTestStatus !== 'erro', message: conn.lastTestMessage }
        : null
    );
    setEditorOpen(true);
  };

  const handleTestConnection = async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      const res = await fetch('/api/connectors/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          providerKind: form.providerKind,
          baseUrl: form.baseUrl.trim(),
          modelId: form.modelId.trim(),
          secret: form.secret.trim(),
          accountLabel: form.accountLabel.trim() || form.name.trim(),
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; message?: string };
      setTestResult({
        ok: Boolean(res.ok && data.ok),
        message: data.message || (res.ok ? 'Conexão verificada!' : 'Não foi possível validar o endpoint.'),
      });
    } catch {
      setTestResult({
        ok: false,
        message: 'Sem rede ativa no momento. Você ainda pode salvar criptografado offline.',
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleSaveForm = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = form.name.trim();
    if (!cleanName) {
      setTestResult({ ok: false, message: 'Informe um nome para o conector ou API.' });
      return;
    }

    setIsSaving(true);
    try {
      let encryptedSecret: string | undefined;
      let secretIv: string | undefined;
      if (form.secret.trim()) {
        const enc = await encryptBytesE2EE(new TextEncoder().encode(form.secret.trim()));
        encryptedSecret = enc.encryptedBase64;
        secretIv = enc.ivBase64;
      }

      const id =
        form.id ||
        sanitizeFirestoreId(`conn_${cleanName.toLowerCase().replace(/\s+/g, '_')}_${Date.now()}`);

      const record: LocalConnector = {
        id,
        name: cleanName,
        providerKind: form.providerKind,
        catalogId: form.catalogId,
        category: form.category,
        brandColor: form.brandColor || '#1E1E24',
        shortGlyph: (form.shortGlyph || cleanName.slice(0, 2)).toUpperCase(),
        baseUrl: form.baseUrl.trim() || undefined,
        modelId: form.modelId.trim() || undefined,
        accountLabel: form.accountLabel.trim() || undefined,
        encryptedSecret,
        secretIv,
        isCustom: form.isCustom,
        isActiveAiModel:
          form.mode === 'api-free' && form.providerKind !== 'media-api'
            ? form.isActiveAiModel
            : false,
        connected: Boolean(
          form.secret.trim() ||
            form.accountLabel.trim() ||
            form.catalogId === 'pollinations_media' ||
            testResult?.ok
        ),
        lastTestStatus: testResult ? (testResult.ok ? 'ok' : 'erro') : 'pendente',
        lastTestMessage: testResult?.message,
        updatedAtIso: new Date().toISOString(),
      };

      await onSaveConnector(record);
      if (record.isActiveAiModel) {
        await onSetActiveAiConnector(record.id);
      }
      setEditorOpen(false);
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddCardSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const digits = cardLast4.replace(/\D/g, '').slice(-4);
    if (!cardNickname.trim() || digits.length !== 4) return;
    await onSaveCard({
      id: `card_${Date.now()}`,
      nickname: cardNickname.trim(),
      brand: cardBrand,
      last4: digits,
      createdAtIso: new Date().toISOString(),
    });
    setCardNickname('');
    setCardLast4('');
    setCardModalOpen(false);
  };

  const googleEmailSummary =
    activeEmail || accounts[0]?.email || 'moisesdecarvalho95@gmail.com';
  const googleAccountCountText = `${Math.max(1, accounts.length)} ${
    accounts.length <= 1 ? 'conta' : 'contas'
  }`;

  const handleRunFreeMediaSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mediaQuery.trim()) {
      setMediaError('Digite um assunto ou prompt para buscar fotos/vídeos.');
      return;
    }
    setMediaError(null);
    setIsSearchingMedia(true);
    try {
      let secret = '';
      if (mediaProvider !== 'pollinations') {
        const targetCatalogId = `${mediaProvider}_media`;
        const conn = connectors.find((c) => c.catalogId === targetCatalogId);
        if (conn?.encryptedSecret && conn.secretIv) {
          const bytes = await decryptBytesE2EE(conn.encryptedSecret, conn.secretIv);
          secret = new TextDecoder().decode(bytes);
        }
        if (!secret) {
          const item = CONNECTOR_CATALOG.find((c) => c.id === targetCatalogId);
          setMediaError(
            `Conecte primeiro sua chave gratuita de ${item?.name || mediaProvider} clicando no card acima.`
          );
          setIsSearchingMedia(false);
          return;
        }
      }

      const res = await fetch('/api/connectors/media-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: mediaProvider,
          query: mediaQuery.trim(),
          mediaType: mediaProvider === 'pollinations' || mediaProvider === 'unsplash' ? 'photo' : mediaKind,
          secret,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        items?: MediaSearchResultItem[];
        error?: string;
      };
      if (!res.ok) {
        throw new Error(data.error || 'Erro ao consultar API de mídia.');
      }
      setMediaResults(data.items || []);
      if ((data.items || []).length === 0) {
        setMediaError('Nenhum resultado retornado para essa busca.');
      }
    } catch (err: unknown) {
      setMediaError(err instanceof Error ? err.message : 'Falha na busca gratuita.');
    } finally {
      setIsSearchingMedia(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto w-full space-y-6">
      {subView === 'main' ? (
        <>
          {/* Conectores Title Bar */}
          <div className="flex items-center justify-between gap-3">
            <h1 className="font-editorial text-3xl text-[var(--zapia-text)]">Conectores</h1>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => openCustomEditor('api-free')}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-[var(--zapia-surface)] border border-[var(--zapia-border)] text-xs font-semibold text-[var(--zapia-text)] hover:border-[var(--zapia-accent)] transition-colors"
              >
                <Cpu className="w-3.5 h-3.5 text-[var(--zapia-accent)]" />
                <span>+ API Free / IA</span>
              </button>
              <button
                type="button"
                aria-label="Adicionar um conector"
                onClick={() => setSubView('catalog')}
                className="w-10 h-10 rounded-full bg-[var(--zapia-surface)] border border-[var(--zapia-border)] flex items-center justify-center text-[var(--zapia-text)] hover:border-[var(--zapia-accent)] transition-colors"
              >
                <Plus className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* "Deixe o Zapia pagar por você" Dark Card (Screenshot 1) */}
          <section className="rounded-3xl border border-[var(--zapia-border)] bg-[var(--zapia-surface)] p-5 space-y-4">
            <div className="flex items-start gap-4">
              <div
                aria-hidden="true"
                className="w-24 h-16 rounded-xl bg-gradient-to-br from-[#34373D] via-[#212328] to-[#121316] border border-white/15 shrink-0 relative overflow-hidden p-2.5 flex flex-col justify-center shadow-inner"
              >
                <div className="w-4 h-3 rounded-sm bg-white/25 border border-white/30" />
                <div className="absolute -right-4 -bottom-4 w-16 h-16 rounded-full bg-white/5" />
              </div>
              <div className="min-w-0 space-y-1">
                <h2 className="text-base font-semibold text-[var(--zapia-text)]">
                  Deixe o Zapia pagar por você
                </h2>
                <p className="text-xs sm:text-sm text-[var(--zapia-muted)] leading-relaxed">
                  Salve um cartão para contas, reservas e compras. O Zapia sempre pergunta antes.
                </p>
              </div>
            </div>

            {savedCards.length > 0 && (
              <div className="space-y-2 pt-1">
                {savedCards.map((card) => (
                  <div
                    key={card.id}
                    className="flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-2xl bg-[var(--zapia-bg)] border border-[var(--zapia-border)] text-xs"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <CreditCard className="w-4 h-4 text-[var(--zapia-accent)] shrink-0" />
                      <span className="font-semibold text-[var(--zapia-text)] truncate">
                        {card.nickname}
                      </span>
                      <span className="text-[var(--zapia-muted)] font-mono-tabular">
                        {card.brand} •••• {card.last4}
                      </span>
                    </div>
                    <button
                      type="button"
                      aria-label={`Remover cartão ${card.nickname}`}
                      onClick={() => onDeleteCard(card.id)}
                      className="p-1.5 text-[var(--zapia-muted)] hover:text-rose-500"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <button
              type="button"
              onClick={() => setCardModalOpen(true)}
              className="w-full py-3 px-4 rounded-full bg-white text-[#111113] text-sm font-semibold flex items-center justify-center gap-2 hover:bg-neutral-200 transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>Adicionar cartão</span>
            </button>
          </section>

          {/* Connected Google & Custom Connectors Grouped List (Screenshots 1 & 4) */}
          <section
            aria-label="Conectores configurados"
            className="rounded-3xl border border-[var(--zapia-border)] bg-[var(--zapia-surface)] divide-y divide-[var(--zapia-border)] overflow-hidden"
          >
            {/* Gmail */}
            <button
              type="button"
              onClick={() => setGoogleModalOpen(true)}
              className="w-full flex items-center justify-between gap-3 px-4 py-3.5 hover:bg-[var(--zapia-surface-alt)] transition-colors text-left"
            >
              <div className="flex items-center gap-3.5 min-w-0">
                <span className="w-10 h-10 rounded-xl bg-[#242428] border border-white/10 flex items-center justify-center font-bold text-sm shrink-0">
                  <span className="bg-gradient-to-r from-red-500 via-amber-400 to-emerald-400 bg-clip-text text-transparent">
                    M
                  </span>
                </span>
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-[var(--zapia-text)]">Gmail</div>
                  <div className="text-xs text-[var(--zapia-muted)]">
                    {accounts.length > 0 ? googleAccountCountText : 'Conectar conta(s) Gmail'}
                  </div>
                </div>
              </div>
              <span className="w-8 h-8 rounded-full border border-[var(--zapia-border)] flex items-center justify-center shrink-0">
                <ChevronRight className="w-4 h-4 text-[var(--zapia-muted)]" />
              </span>
            </button>

            {/* Google Calendar */}
            <button
              type="button"
              onClick={onOpenScheduleWorkspace}
              className="w-full flex items-center justify-between gap-3 px-4 py-3.5 hover:bg-[var(--zapia-surface-alt)] transition-colors text-left"
            >
              <div className="flex items-center gap-3.5 min-w-0">
                <span className="w-10 h-10 rounded-xl bg-[#1A73E8] text-white flex items-center justify-center font-bold text-xs shrink-0">
                  31
                </span>
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-[var(--zapia-text)]">
                    Google Calendar
                  </div>
                  <div className="text-xs text-[var(--zapia-muted)]">
                    {accounts.length > 0 ? googleAccountCountText : 'Agenda sincronizada'}
                  </div>
                </div>
              </div>
              <span className="w-8 h-8 rounded-full border border-[var(--zapia-border)] flex items-center justify-center shrink-0">
                <ChevronRight className="w-4 h-4 text-[var(--zapia-muted)]" />
              </span>
            </button>

            {/* Google Drive */}
            <button
              type="button"
              onClick={() => setGoogleModalOpen(true)}
              className="w-full flex items-center justify-between gap-3 px-4 py-3.5 hover:bg-[var(--zapia-surface-alt)] transition-colors text-left"
            >
              <div className="flex items-center gap-3.5 min-w-0">
                <span className="w-10 h-10 rounded-xl bg-[#242428] border border-white/10 flex items-center justify-center font-bold text-xs text-emerald-400 shrink-0">
                  GD
                </span>
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-[var(--zapia-text)]">Google Drive</div>
                  <div className="text-xs text-[var(--zapia-muted)] truncate">
                    {googleEmailSummary}
                  </div>
                </div>
              </div>
              <span className="w-8 h-8 rounded-full border border-[var(--zapia-border)] flex items-center justify-center shrink-0">
                <ChevronRight className="w-4 h-4 text-[var(--zapia-muted)]" />
              </span>
            </button>

            {/* Google Tasks */}
            <button
              type="button"
              onClick={onOpenScheduleWorkspace}
              className="w-full flex items-center justify-between gap-3 px-4 py-3.5 hover:bg-[var(--zapia-surface-alt)] transition-colors text-left"
            >
              <div className="flex items-center gap-3.5 min-w-0">
                <span className="w-10 h-10 rounded-xl bg-[#2563EB] text-white flex items-center justify-center font-bold text-xs shrink-0">
                  ✓
                </span>
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-[var(--zapia-text)]">Google Tasks</div>
                  <div className="text-xs text-[var(--zapia-muted)] truncate">
                    {googleEmailSummary}
                  </div>
                </div>
              </div>
              <span className="w-8 h-8 rounded-full border border-[var(--zapia-border)] flex items-center justify-center shrink-0">
                <ChevronRight className="w-4 h-4 text-[var(--zapia-muted)]" />
              </span>
            </button>

            {/* Dynamic Saved Connectors (Telegram @FFMoises29, Free AI APIs, Apps & Custom) */}
            {connectors.map((conn) => (
              <button
                key={conn.id}
                type="button"
                onClick={() => openEditorForExisting(conn)}
                className="w-full flex items-center justify-between gap-3 px-4 py-3.5 hover:bg-[var(--zapia-surface-alt)] transition-colors text-left"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <span
                    className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-xs text-white shrink-0 border border-white/10"
                    style={{ backgroundColor: conn.brandColor }}
                  >
                    {conn.shortGlyph}
                  </span>
                  <div className="min-w-0 space-y-0.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold text-[var(--zapia-text)] truncate">
                        {conn.name}
                      </span>
                      {conn.isCustom && (
                        <span className="px-2 py-0.5 rounded-full bg-[var(--zapia-surface-alt)] text-[11px] text-[var(--zapia-muted)]">
                          Personalizado
                        </span>
                      )}
                      {conn.isActiveAiModel && (
                        <span className="px-2 py-0.5 rounded-full bg-emerald-600/20 text-emerald-400 text-[11px] font-medium">
                          Modelo IA Ativo
                        </span>
                      )}
                      {conn.lastTestStatus === 'ok' && (
                        <span className="px-2 py-0.5 rounded-full bg-emerald-600/15 text-emerald-400 text-[10px]">
                          Testado OK
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-[var(--zapia-muted)] truncate">
                      {conn.accountLabel || conn.modelId || conn.baseUrl || 'Clique para configurar e testar'}
                    </div>
                  </div>
                </div>
                <span className="w-8 h-8 rounded-full border border-[var(--zapia-border)] flex items-center justify-center shrink-0">
                  <ChevronRight className="w-4 h-4 text-[var(--zapia-muted)]" />
                </span>
              </button>
            ))}
          </section>

          {/* IA, Música & Fotos/Vídeos Grátis (GPT, Gemini, Dola, Suno, Pollinations, Pexels, Pixabay, Unsplash) */}
          <section className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Film className="w-4 h-4 text-[var(--zapia-accent)]" />
                <h2 className="text-sm font-semibold text-[var(--zapia-text)]">
                  GPT, Gemini, Dola, Suno & Fotos/Vídeos Grátis
                </h2>
              </div>
              <button
                type="button"
                onClick={() => {
                  setCatalogCategory('media');
                  setSubView('catalog');
                }}
                className="text-xs font-medium text-[var(--zapia-accent)] hover:underline"
              >
                Ver todas as APIs de mídia
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {quickAiMediaApps.map((app) => {
                const isConnected = connectors.some(
                  (c) => (c.catalogId === app.id || c.name === app.name) && c.connected
                );
                return (
                  <button
                    key={app.id}
                    type="button"
                    onClick={() => openEditorFromCatalog(app)}
                    className="rounded-2xl border border-[var(--zapia-border)] bg-[var(--zapia-surface)] hover:border-[var(--zapia-accent)] p-3 flex items-center gap-2.5 text-left transition-colors"
                  >
                    <span
                      className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-bold text-[11px] shrink-0"
                      style={{ backgroundColor: app.brandColor }}
                    >
                      {app.shortGlyph}
                    </span>
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-[var(--zapia-text)] truncate">
                        {app.name.split(' (')[0]}
                      </div>
                      <div className="text-[10px] text-[var(--zapia-muted)] truncate">
                        {isConnected
                          ? 'Conectado'
                          : app.id === 'suno_ai'
                            ? 'Música grátis'
                            : app.category === 'fotos-videos'
                              ? 'API Fotos/Vídeos'
                              : 'Conectar API'}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Interactive Live Search/Generate Free Photos & Videos Bar */}
            <form
              onSubmit={handleRunFreeMediaSearch}
              className="rounded-2xl border border-[var(--zapia-border)] bg-[var(--zapia-surface)] p-4 space-y-3"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-xs font-semibold text-[var(--zapia-text)]">
                  <ImagePlus className="w-4 h-4 text-emerald-400" />
                  <span>Buscar / Gerar Fotos e Vídeos Grátis (Salvar na Galeria ZAPIA)</span>
                </div>
                <span className="inline-flex items-center gap-1 text-[11px] text-emerald-400">
                  <Music2 className="w-3 h-3" />
                  <span>Pollinations grátis sem chave</span>
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                <select
                  aria-label="Provedor gratuito de fotos e vídeos"
                  value={mediaProvider}
                  onChange={(e) =>
                    setMediaProvider(
                      e.target.value as 'pollinations' | 'pexels' | 'pixabay' | 'unsplash'
                    )
                  }
                  className="sm:col-span-4 px-3 py-2 rounded-xl border border-[var(--zapia-border)] bg-[var(--zapia-bg)] text-xs text-[var(--zapia-text)]"
                >
                  <option value="pollinations">Pollinations IA (Grátis)</option>
                  <option value="pexels">Pexels (Fotos/Vídeos)</option>
                  <option value="pixabay">Pixabay (Fotos/Vídeos)</option>
                  <option value="unsplash">Unsplash (Fotos HD)</option>
                </select>

                {(mediaProvider === 'pexels' || mediaProvider === 'pixabay') && (
                  <select
                    aria-label="Tipo de mídia"
                    value={mediaKind}
                    onChange={(e) => setMediaKind(e.target.value as 'photo' | 'video')}
                    className="sm:col-span-2 px-3 py-2 rounded-xl border border-[var(--zapia-border)] bg-[var(--zapia-bg)] text-xs text-[var(--zapia-text)]"
                  >
                    <option value="photo">Fotos</option>
                    <option value="video">Vídeos</option>
                  </select>
                )}

                <input
                  type="text"
                  value={mediaQuery}
                  onChange={(e) => setMediaQuery(e.target.value)}
                  placeholder="Ex: pôr do sol futurista, praia HD, setup gamer..."
                  aria-label="Tema da foto ou vídeo gratuito"
                  className={`${
                    mediaProvider === 'pexels' || mediaProvider === 'pixabay'
                      ? 'sm:col-span-3'
                      : 'sm:col-span-5'
                  } px-3.5 py-2 rounded-xl border border-[var(--zapia-border)] bg-[var(--zapia-bg)] text-xs text-[var(--zapia-text)]`}
                />

                <button
                  type="submit"
                  disabled={isSearchingMedia}
                  className="sm:col-span-3 py-2 px-4 rounded-full bg-white text-[#111113] text-xs font-semibold inline-flex items-center justify-center gap-1.5 hover:bg-neutral-200"
                >
                  {isSearchingMedia ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Search className="w-3.5 h-3.5" />
                  )}
                  <span>{isSearchingMedia ? 'Buscando...' : 'Buscar / Gerar'}</span>
                </button>
              </div>

              {mediaError && (
                <div role="alert" className="text-xs text-amber-300 flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>{mediaError}</span>
                </div>
              )}

              {mediaResults.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  {mediaResults.map((resItem) => (
                    <div
                      key={resItem.id}
                      className="rounded-2xl border border-[var(--zapia-border)] bg-[var(--zapia-bg)] overflow-hidden flex flex-col"
                    >
                      <img
                        src={resItem.previewUrl}
                        alt={resItem.title}
                        className="w-full h-36 object-cover bg-black/40"
                      />
                      <div className="p-3 flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <div className="text-xs font-semibold text-[var(--zapia-text)] truncate">
                            {resItem.title}
                          </div>
                          <div className="text-[10px] text-[var(--zapia-muted)] truncate">
                            {resItem.author} · {resItem.kind === 'video' ? 'Vídeo' : 'Foto'}
                          </div>
                        </div>
                        {onImportMediaToGallery && (
                          <button
                            type="button"
                            disabled={savedMediaIds[resItem.id]}
                            onClick={async () => {
                              await onImportMediaToGallery({
                                id: resItem.id,
                                title: resItem.title,
                                kind: resItem.kind,
                                mimeType: resItem.mimeType,
                                dataUrl: resItem.fullUrl,
                              });
                              setSavedMediaIds((prev) => ({ ...prev, [resItem.id]: true }));
                            }}
                            className="px-3 py-1.5 rounded-full bg-white text-[#111113] text-[11px] font-semibold shrink-0 disabled:opacity-60"
                          >
                            {savedMediaIds[resItem.id] ? 'Salvo!' : 'Salvar Galeria'}
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </form>
          </section>

          {/* "Mais apps" 3x2 Grid (Screenshot 4) */}
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-[var(--zapia-muted)]">Mais apps</h2>
              <button
                type="button"
                onClick={onOpenCodeStudio}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--zapia-accent)] hover:underline"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Criar Jogos & Apps</span>
              </button>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {quickMoreApps.map((app) => (
                <button
                  key={app.id}
                  type="button"
                  onClick={() => openEditorFromCatalog(app)}
                  className="rounded-2xl border border-[var(--zapia-border)] bg-[var(--zapia-surface)] hover:border-[var(--zapia-accent)] p-4 flex flex-col items-center justify-center gap-2.5 transition-colors"
                >
                  <span
                    className="w-11 h-11 rounded-xl flex items-center justify-center text-white font-bold text-xs shadow-sm"
                    style={{ backgroundColor: app.brandColor }}
                  >
                    {app.shortGlyph}
                  </span>
                  <span className="text-xs sm:text-sm font-medium text-[var(--zapia-text)]">
                    {app.name}
                  </span>
                </button>
              ))}

              <button
                type="button"
                onClick={() => {
                  setCatalogCategory('all');
                  setSubView('catalog');
                }}
                className="rounded-2xl border border-[var(--zapia-border)] bg-[var(--zapia-surface)] hover:border-[var(--zapia-accent)] p-4 flex flex-col items-center justify-center gap-2.5 transition-colors"
              >
                <span className="w-11 h-11 rounded-xl bg-[var(--zapia-surface-alt)] border border-[var(--zapia-border)] flex items-center justify-center text-[var(--zapia-text)]">
                  <ChevronRight className="w-5 h-5" />
                </span>
                <span className="text-xs sm:text-sm font-medium text-[var(--zapia-text)]">
                  Ver tudo
                </span>
              </button>
            </div>
          </section>
        </>
      ) : (
        /* "Adicionar um conector" Sub-View (Screenshots 2 & 3) */
        <>
          <div className="flex items-center gap-3">
            <button
              type="button"
              aria-label="Voltar para Conectores"
              onClick={() => setSubView('main')}
              className="w-10 h-10 rounded-full bg-[var(--zapia-surface)] border border-[var(--zapia-border)] flex items-center justify-center text-[var(--zapia-text)] hover:border-[var(--zapia-accent)]"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="font-editorial text-2xl sm:text-3xl text-[var(--zapia-text)]">
              Adicionar um conector
            </h1>
          </div>

          <div className="relative">
            <Search className="w-4 h-4 text-[var(--zapia-muted)] absolute left-4 top-1/2 -translate-y-1/2" />
            <label htmlFor="connector-search" className="sr-only">
              Busque apps, redes sociais ou APIs Free
            </label>
            <input
              id="connector-search"
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Busque GPT, Gemini, Dola, Suno, Pexels, WhatsApp ou qualquer API..."
              className="w-full pl-11 pr-4 py-3 rounded-full bg-[var(--zapia-surface)] border border-[var(--zapia-border)] text-sm text-[var(--zapia-text)] placeholder:text-[var(--zapia-muted)]"
            />
          </div>

          {/* Category Filter Chips */}
          <div className="flex flex-wrap gap-2">
            {[
              { id: 'all', label: 'Todos' },
              { id: 'ai', label: 'IA: GPT, Gemini & Dola' },
              { id: 'media', label: 'Fotos, Vídeos & Suno' },
              { id: 'apps', label: 'Redes & Apps' },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setCatalogCategory(tab.id as CatalogFilterCategory)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                  catalogCategory === tab.id
                    ? 'bg-white text-[#111113] border-white'
                    : 'bg-[var(--zapia-surface)] text-[var(--zapia-muted)] border-[var(--zapia-border)] hover:text-[var(--zapia-text)]'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="space-y-3">
            {filteredCatalog.map((item) => {
              const alreadySaved = connectors.some(
                (c) => c.catalogId === item.id || c.name === item.name
              );
              return (
                <div
                  key={item.id}
                  className="flex items-center justify-between gap-3 p-3.5 rounded-2xl border border-[var(--zapia-border)] bg-[var(--zapia-surface)]"
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <span
                      className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold text-xs shrink-0"
                      style={{ backgroundColor: item.brandColor }}
                    >
                      {item.shortGlyph}
                    </span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-semibold text-[var(--zapia-text)]">
                          {item.name}
                        </h3>
                        {item.authMode === 'api-free' && (
                          <span className="px-2 py-0.5 rounded-full bg-emerald-600/20 text-emerald-400 text-[10px] font-semibold">
                            API Free
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-[var(--zapia-muted)] line-clamp-2">
                        {item.description}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => openEditorFromCatalog(item)}
                    className="px-4 py-2 rounded-full bg-white text-[#111113] text-xs font-semibold hover:bg-neutral-200 transition-colors shrink-0"
                  >
                    {alreadySaved ? 'Configurar' : 'Conectar'}
                  </button>
                </div>
              );
            })}
          </div>

          {/* Personalizado Section (Screenshot 2 bottom) */}
          <div className="pt-2 space-y-2.5">
            <h2 className="text-sm font-semibold text-[var(--zapia-muted)]">Personalizado</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => openCustomEditor('api-free')}
                className="flex items-center justify-between gap-3 p-4 rounded-2xl border border-[var(--zapia-border)] bg-[var(--zapia-surface)] hover:border-[var(--zapia-accent)] text-left"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="w-11 h-11 rounded-xl bg-[#242428] flex items-center justify-center shrink-0">
                    <Cpu className="w-5 h-5 text-[var(--zapia-accent)]" />
                  </span>
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-[var(--zapia-text)]">
                      Adicionar API Free / Modelo IA
                    </div>
                    <p className="text-xs text-[var(--zapia-muted)]">
                      Adicione, teste ao vivo e salve qualquer modelo (Groq, Gemini, OpenRouter...)
                    </p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-[var(--zapia-muted)] shrink-0" />
              </button>

              <button
                type="button"
                onClick={() => openCustomEditor('app-login')}
                className="flex items-center justify-between gap-3 p-4 rounded-2xl border border-[var(--zapia-border)] bg-[var(--zapia-surface)] hover:border-[var(--zapia-accent)] text-left"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="w-11 h-11 rounded-xl bg-[#242428] flex items-center justify-center shrink-0">
                    <KeyRound className="w-5 h-5 text-[var(--zapia-accent)]" />
                  </span>
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-[var(--zapia-text)]">
                      Conectar Qualquer App (Login/Senha)
                    </div>
                    <p className="text-xs text-[var(--zapia-muted)]">
                      Salve login e senha ou token com criptografia AES-256-GCM local
                    </p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-[var(--zapia-muted)] shrink-0" />
              </button>
            </div>
          </div>
        </>
      )}

      {/* Modal: Add / Edit / Test Live Free API or App Login */}
      {editorOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto"
          role="dialog"
          aria-modal="true"
          aria-label="Configurar conector ou API"
        >
          <form
            onSubmit={handleSaveForm}
            className="w-full max-w-lg rounded-3xl border border-[var(--zapia-border)] bg-[var(--zapia-bg)] p-5 sm:p-6 space-y-4 my-auto"
          >
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-editorial text-xl text-[var(--zapia-text)]">
                {form.id ? `Configurar ${form.name}` : 'Novo Conector ou API Free'}
              </h2>
              <button
                type="button"
                aria-label="Fechar janela de conector"
                onClick={() => setEditorOpen(false)}
                className="w-9 h-9 rounded-full bg-[var(--zapia-surface)] border border-[var(--zapia-border)] flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Mode switcher */}
            <div className="grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-[var(--zapia-surface)] border border-[var(--zapia-border)]">
              <button
                type="button"
                onClick={() =>
                  setForm((f) => ({
                    ...f,
                    mode: 'api-free',
                    providerKind:
                      f.providerKind === 'app-credentials' || f.providerKind === 'telegram-bot'
                        ? 'openai-compatible'
                        : f.providerKind,
                  }))
                }
                className={`py-2 px-3 rounded-lg text-xs font-semibold transition-colors ${
                  form.mode === 'api-free'
                    ? 'bg-white text-[#111113]'
                    : 'text-[var(--zapia-muted)]'
                }`}
              >
                API Free / Modelo IA
              </button>
              <button
                type="button"
                onClick={() =>
                  setForm((f) => ({
                    ...f,
                    mode: 'app-login',
                    providerKind:
                      f.catalogId === 'telegram' ? 'telegram-bot' : 'app-credentials',
                  }))
                }
                className={`py-2 px-3 rounded-lg text-xs font-semibold transition-colors ${
                  form.mode === 'app-login'
                    ? 'bg-white text-[#111113]'
                    : 'text-[var(--zapia-muted)]'
                }`}
              >
                App (Login, Senha ou Token)
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label htmlFor="conn-name" className="block text-xs text-[var(--zapia-muted)] mb-1">
                  Nome do Conector ou Modelo
                </label>
                <input
                  id="conn-name"
                  type="text"
                  required
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="Ex: Groq Llama 3 Free, Instagram Pessoal, Minha API..."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[var(--zapia-border)] bg-[var(--zapia-surface)] text-sm text-[var(--zapia-text)]"
                />
              </div>

              {form.mode === 'api-free' ? (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label htmlFor="conn-provider" className="block text-xs text-[var(--zapia-muted)] mb-1">
                        Formato da API
                      </label>
                      <select
                        id="conn-provider"
                        value={form.providerKind}
                        onChange={(e) => {
                          const kind = e.target.value as ApiProviderKind;
                          setForm((f) => ({
                            ...f,
                            providerKind: kind,
                            baseUrl:
                              kind === 'gemini'
                                ? 'https://generativelanguage.googleapis.com/v1beta'
                                : kind === 'huggingface'
                                  ? 'https://router.huggingface.co/v1'
                                  : kind === 'media-api'
                                    ? f.baseUrl || 'https://image.pollinations.ai'
                                    : f.baseUrl || 'https://api.openai.com/v1',
                          }));
                        }}
                        className="w-full px-3 py-2.5 rounded-xl border border-[var(--zapia-border)] bg-[var(--zapia-surface)] text-xs text-[var(--zapia-text)]"
                      >
                        <option value="openai-compatible">OpenAI (GPT) / Groq / OpenRouter</option>
                        <option value="gemini">Google Gemini / AI Studio</option>
                        <option value="media-api">Fotos / Vídeos / Música Grátis (Suno / Pexels / Pollinations)</option>
                        <option value="huggingface">Hugging Face Inference</option>
                        <option value="webhook">Endpoint REST / Webhook</option>
                      </select>
                    </div>
                    <div>
                      <label htmlFor="conn-model" className="block text-xs text-[var(--zapia-muted)] mb-1">
                        ID do Modelo
                      </label>
                      <input
                        id="conn-model"
                        type="text"
                        value={form.modelId}
                        onChange={(e) => setForm((f) => ({ ...f, modelId: e.target.value }))}
                        placeholder="Ex: llama-3.3-70b-versatile"
                        className="w-full px-3.5 py-2.5 rounded-xl border border-[var(--zapia-border)] bg-[var(--zapia-surface)] text-xs text-[var(--zapia-text)]"
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="conn-url" className="block text-xs text-[var(--zapia-muted)] mb-1">
                      URL Base da API (HTTPS)
                    </label>
                    <input
                      id="conn-url"
                      type="url"
                      value={form.baseUrl}
                      onChange={(e) => setForm((f) => ({ ...f, baseUrl: e.target.value }))}
                      placeholder="https://api.groq.com/openai/v1"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-[var(--zapia-border)] bg-[var(--zapia-surface)] text-xs text-[var(--zapia-text)]"
                    />
                  </div>
                </>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="conn-account" className="block text-xs text-[var(--zapia-muted)] mb-1">
                      Login, E-mail ou @Usuário
                    </label>
                    <input
                      id="conn-account"
                      type="text"
                      value={form.accountLabel}
                      onChange={(e) => setForm((f) => ({ ...f, accountLabel: e.target.value }))}
                      placeholder="@FFMoises29 ou login"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-[var(--zapia-border)] bg-[var(--zapia-surface)] text-xs text-[var(--zapia-text)]"
                    />
                  </div>
                  <div>
                    <label htmlFor="conn-app-url" className="block text-xs text-[var(--zapia-muted)] mb-1">
                      Site ou URL do Serviço (opcional)
                    </label>
                    <input
                      id="conn-app-url"
                      type="url"
                      value={form.baseUrl}
                      onChange={(e) => setForm((f) => ({ ...f, baseUrl: e.target.value }))}
                      placeholder="https://..."
                      className="w-full px-3.5 py-2.5 rounded-xl border border-[var(--zapia-border)] bg-[var(--zapia-surface)] text-xs text-[var(--zapia-text)]"
                    />
                  </div>
                </div>
              )}

              <div>
                <label htmlFor="conn-secret" className="block text-xs text-[var(--zapia-muted)] mb-1">
                  {form.mode === 'api-free'
                    ? 'Chave da API (criptografada AES-256-GCM no dispositivo)'
                    : 'Senha ou Token de Acesso (criptografado AES-256-GCM)'}
                </label>
                <input
                  id="conn-secret"
                  type="password"
                  autoComplete="new-password"
                  value={form.secret}
                  onChange={(e) => setForm((f) => ({ ...f, secret: e.target.value }))}
                  placeholder={form.id ? 'Deixe como está ou informe nova chave/senha' : 'Cole sua API key, token ou senha'}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[var(--zapia-border)] bg-[var(--zapia-surface)] text-sm text-[var(--zapia-text)]"
                />
              </div>

              {form.mode === 'api-free' && form.providerKind !== 'media-api' && (
                <label className="flex items-center justify-between gap-3 p-3 rounded-xl border border-[var(--zapia-border)] bg-[var(--zapia-surface)] cursor-pointer">
                  <div className="text-xs">
                    <div className="font-semibold text-[var(--zapia-text)]">
                      Ativar este modelo no Chat ZAPIA
                    </div>
                    <div className="text-[var(--zapia-muted)]">
                      As conversas usarão esta API configurada (GPT, Gemini, Groq...).
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={form.isActiveAiModel}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, isActiveAiModel: e.target.checked }))
                    }
                    className="w-4 h-4 accent-[var(--zapia-accent)]"
                  />
                </label>
              )}
            </div>

            {testResult && (
              <div
                role="status"
                className={`p-3 rounded-xl border text-xs flex items-start gap-2 ${
                  testResult.ok
                    ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
                    : 'border-amber-500/40 bg-amber-500/10 text-amber-300'
                }`}
              >
                {testResult.ok ? (
                  <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                )}
                <span>{testResult.message}</span>
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={isTesting}
                  onClick={handleTestConnection}
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-full border border-[var(--zapia-border)] bg-[var(--zapia-surface)] text-xs font-semibold text-[var(--zapia-text)] hover:border-[var(--zapia-accent)]"
                >
                  {isTesting ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <FlaskConical className="w-3.5 h-3.5 text-[var(--zapia-accent)]" />
                  )}
                  <span>Testar Conexão</span>
                </button>

                {form.id && (
                  <button
                    type="button"
                    aria-label="Excluir conector"
                    onClick={async () => {
                      await onDeleteConnector(form.id!);
                      setEditorOpen(false);
                    }}
                    className="p-2.5 rounded-full border border-[var(--zapia-border)] text-rose-400 hover:bg-rose-500/10"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>

              <button
                type="submit"
                disabled={isSaving}
                className="px-5 py-2.5 rounded-full bg-white text-[#111113] text-xs font-semibold hover:bg-neutral-200 transition-colors"
              >
                {isSaving ? 'Salvando...' : 'Salvar Conector'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal: "+ Adicionar cartão" */}
      {cardModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Salvar cartão para pagamentos assistidos"
        >
          <form
            onSubmit={handleAddCardSubmit}
            className="w-full max-w-md rounded-3xl border border-[var(--zapia-border)] bg-[var(--zapia-bg)] p-6 space-y-4"
          >
            <div className="flex items-center justify-between">
              <h2 className="font-editorial text-xl text-[var(--zapia-text)]">
                Adicionar cartão
              </h2>
              <button
                type="button"
                aria-label="Fechar janela de cartão"
                onClick={() => setCardModalOpen(false)}
                className="w-9 h-9 rounded-full bg-[var(--zapia-surface)] border border-[var(--zapia-border)] flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-[var(--zapia-muted)] leading-relaxed">
              Para sua proteção, guardamos apenas o apelido e os 4 últimos dígitos para identificar o cartão. O ZAPIA sempre solicita sua aprovação antes de qualquer compra.
            </p>
            <div className="space-y-3">
              <div>
                <label htmlFor="card-nick" className="block text-xs text-[var(--zapia-muted)] mb-1">
                  Apelido do cartão
                </label>
                <input
                  id="card-nick"
                  type="text"
                  required
                  value={cardNickname}
                  onChange={(e) => setCardNickname(e.target.value)}
                  placeholder="Ex: Nubank Principal"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[var(--zapia-border)] bg-[var(--zapia-surface)] text-sm text-[var(--zapia-text)]"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="card-brand" className="block text-xs text-[var(--zapia-muted)] mb-1">
                    Bandeira
                  </label>
                  <select
                    id="card-brand"
                    value={cardBrand}
                    onChange={(e) => setCardBrand(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border border-[var(--zapia-border)] bg-[var(--zapia-surface)] text-xs text-[var(--zapia-text)]"
                  >
                    <option value="Mastercard">Mastercard</option>
                    <option value="Visa">Visa</option>
                    <option value="Elo">Elo</option>
                    <option value="Pix Automático">Pix Automático</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="card-last4" className="block text-xs text-[var(--zapia-muted)] mb-1">
                    4 últimos dígitos
                  </label>
                  <input
                    id="card-last4"
                    type="text"
                    required
                    maxLength={4}
                    pattern="\d{4}"
                    value={cardLast4}
                    onChange={(e) => setCardLast4(e.target.value.replace(/\D/g, '').slice(0, 4))}
                    placeholder="1234"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[var(--zapia-border)] bg-[var(--zapia-surface)] text-sm font-mono-tabular text-[var(--zapia-text)]"
                  />
                </div>
              </div>
            </div>
            <button
              type="submit"
              className="w-full py-3 rounded-full bg-white text-[#111113] text-sm font-semibold hover:bg-neutral-200 transition-colors"
            >
              Salvar cartão com segurança
            </button>
          </form>
        </div>
      )}

      {/* Modal: Multi-Account Google Workspace Hub */}
      {googleModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Gerenciar contas Google Workspace"
        >
          <div className="w-full max-w-md rounded-3xl border border-[var(--zapia-border)] bg-[var(--zapia-bg)] p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-editorial text-xl text-[var(--zapia-text)]">
                Contas Google conectadas
              </h2>
              <button
                type="button"
                aria-label="Fechar contas Google"
                onClick={() => setGoogleModalOpen(false)}
                className="w-9 h-9 rounded-full bg-[var(--zapia-surface)] border border-[var(--zapia-border)] flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-2 max-h-56 overflow-y-auto">
              {accounts.length === 0 ? (
                <p className="text-xs text-[var(--zapia-muted)]">
                  Nenhuma conta OAuth ativa nesta sessão. Conecte seu Gmail para Drive, Agenda e E-mails.
                </p>
              ) : (
                accounts.map((acc) => (
                  <div
                    key={acc.email}
                    className="flex items-center justify-between gap-2 p-3 rounded-xl border border-[var(--zapia-border)] bg-[var(--zapia-surface)]"
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-[var(--zapia-text)] truncate">
                        {acc.displayName}
                      </div>
                      <div className="text-[11px] text-[var(--zapia-muted)] truncate">
                        {acc.email}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => onAddGoogleAccount(acc.email)}
                      className="px-3 py-1.5 rounded-full border border-[var(--zapia-border)] text-xs font-medium hover:border-[var(--zapia-accent)]"
                    >
                      {activeEmail === acc.email && hasGoogleToken ? 'Ativa' : 'Alternar'}
                    </button>
                  </div>
                ))
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => onAddGoogleAccount()}
                className="flex-1 inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-full bg-white text-[#111113] text-xs font-semibold hover:bg-neutral-200"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>Conectar nova conta Gmail</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setGoogleModalOpen(false);
                  onOpenScheduleWorkspace();
                }}
                className="inline-flex items-center gap-1.5 py-2.5 px-4 rounded-full border border-[var(--zapia-border)] text-xs font-medium text-[var(--zapia-text)]"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Abrir E-mails & Agenda</span>
              </button>
            </div>
            <div className="flex items-center gap-2 text-[11px] text-emerald-400">
              <ShieldCheck className="w-4 h-4 shrink-0" />
              <span>Escopos Gmail, Drive e Google Agenda com login OAuth real.</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
