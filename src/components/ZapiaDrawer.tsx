import React, { useState } from 'react';
import {
  Bell,
  ChevronRight,
  Clock,
  Layers,
  Plug,
  Target,
  Settings,
  Search,
  MessageCircle,
  X,
} from 'lucide-react';
import { LocalThread } from '../utils/offlineDb';
import { ThreadGlyph, ZapiaProGraphic } from './ZapiaWordmark';

export type WorkspaceViewId = 'assistant' | 'routines' | 'artifacts' | 'connect' | 'radar' | 'settings';

interface ZapiaDrawerProps {
  userName: string;
  userPhotoUrl?: string | null;
  userEmail?: string | null;
  isOnline: boolean;
  threads: LocalThread[];
  activeThreadId: string | null;
  activeView: WorkspaceViewId;
  radarBadgeCount: number;
  isMobileDrawerOpen: boolean;
  onCloseMobileDrawer: () => void;
  onSelectThread: (thread: LocalThread) => void;
  onNewChat: () => void;
  onSelectView: (view: WorkspaceViewId) => void;
}

export const ZapiaDrawer: React.FC<ZapiaDrawerProps> = ({
  userName,
  userPhotoUrl,
  userEmail,
  isOnline,
  threads,
  activeThreadId,
  activeView,
  radarBadgeCount,
  isMobileDrawerOpen,
  onCloseMobileDrawer,
  onSelectThread,
  onNewChat,
  onSelectView,
}) => {
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const initials = userName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() || '')
    .join('');

  const filteredThreads = threads.filter((t) =>
    t.title.toLowerCase().includes(searchQuery.trim().toLowerCase())
  );

  const handleAction = (fn: () => void) => {
    fn();
    onCloseMobileDrawer();
  };

  const drawerBody = (
    <div className="flex flex-col h-full bg-[var(--zapia-bg)] text-[var(--zapia-text)]">
      {/* Header Profile Row */}
      <div className="px-4 pt-4 pb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-3 min-w-0">
          {userPhotoUrl ? (
            <img
              src={userPhotoUrl}
              alt={userName}
              referrerPolicy="no-referrer"
              className="w-11 h-11 rounded-full object-cover border border-[var(--zapia-border)] shrink-0"
            />
          ) : (
            <div className="w-11 h-11 rounded-full bg-[var(--zapia-surface-alt)] border border-[var(--zapia-border)] flex items-center justify-center text-sm font-semibold shrink-0">
              {initials || 'MC'}
            </div>
          )}
          <div className="min-w-0">
            <div className="font-editorial text-base font-medium leading-tight truncate">
              {userName}
            </div>
            <div className="text-xs text-[var(--zapia-muted)] truncate mt-0.5">
              {userEmail ? userEmail : isOnline ? 'Plano Completo · Nuvem E2EE' : 'Modo Offline Seguro'}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => handleAction(() => onSelectView('radar'))}
            aria-label="Abrir alertas e Radar"
            className="relative w-10 h-10 rounded-full bg-[var(--zapia-surface)] border border-[var(--zapia-border)] flex items-center justify-center hover:border-[var(--zapia-accent)] transition-colors"
          >
            <Bell className="w-4 h-4" />
            {radarBadgeCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-white text-[#111113] text-[10px] font-bold flex items-center justify-center font-mono-tabular">
                {radarBadgeCount}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => {
              if (isMobileDrawerOpen) {
                onCloseMobileDrawer();
              } else {
                onSelectView('connect');
              }
            }}
            aria-label={isMobileDrawerOpen ? 'Fechar menu lateral' : 'Gerenciar contas Google'}
            className="w-10 h-10 rounded-full bg-[var(--zapia-surface)] border border-[var(--zapia-border)] flex items-center justify-center hover:border-[var(--zapia-accent)] transition-colors"
          >
            {isMobileDrawerOpen ? <X className="w-4 h-4 lg:hidden" /> : null}
            <ChevronRight className={`w-4 h-4 ${isMobileDrawerOpen ? 'hidden lg:block' : ''}`} />
          </button>
        </div>
      </div>

      {/* Featured Horizontal Banner Strip */}
      <div className="px-4 py-2 flex gap-2.5 overflow-x-auto no-scrollbar shrink-0">
        <div className="min-w-[248px] flex-1 rounded-2xl bg-[#C4F16E] text-[#11120E] px-3.5 py-2.5 flex items-center justify-between gap-2">
          <ZapiaProGraphic className="h-9" />
          <button
            type="button"
            onClick={() => handleAction(() => onSelectView('artifacts'))}
            className="px-3.5 py-2 rounded-full bg-[#B1DF59] hover:bg-[#a3d448] text-[#11120E] text-xs font-semibold whitespace-nowrap shrink-0 transition-colors"
          >
            Ver recursos
          </button>
        </div>

        <button
          type="button"
          onClick={() => handleAction(() => onSelectView('settings'))}
          aria-label="Personalizar cores e vozes"
          className="min-w-[74px] rounded-2xl bg-[#F29BD4] text-[#141416] p-2.5 flex flex-col justify-between items-start shrink-0 hover:opacity-95 transition-opacity"
        >
          <span className="text-[11px] font-bold leading-tight">Temas</span>
          <span className="text-[10px] font-medium opacity-80">4 cores</span>
        </button>
      </div>

      {/* 4-Tile Quick Action Grid (Rotinas, Artefatos, Conectar, Radar) */}
      <div className="px-4 py-3 grid grid-cols-4 gap-2 shrink-0">
        <button
          type="button"
          onClick={() => handleAction(() => onSelectView('routines'))}
          className={`rounded-2xl py-3 px-1.5 flex flex-col items-center justify-center gap-1.5 border transition-colors min-h-[72px] ${
            activeView === 'routines'
              ? 'bg-[var(--zapia-surface-alt)] border-[var(--zapia-accent)]'
              : 'bg-[var(--zapia-surface)] border-[var(--zapia-border)] hover:bg-[var(--zapia-surface-alt)]'
          }`}
        >
          <Clock className="w-5 h-5" />
          <span className="text-[11px] font-medium whitespace-nowrap">Rotinas</span>
        </button>

        <button
          type="button"
          onClick={() => handleAction(() => onSelectView('artifacts'))}
          className={`rounded-2xl py-3 px-1.5 flex flex-col items-center justify-center gap-1.5 border transition-colors min-h-[72px] ${
            activeView === 'artifacts'
              ? 'bg-[var(--zapia-surface-alt)] border-[var(--zapia-accent)]'
              : 'bg-[var(--zapia-surface)] border-[var(--zapia-border)] hover:bg-[var(--zapia-surface-alt)]'
          }`}
        >
          <Layers className="w-5 h-5" />
          <span className="text-[11px] font-medium whitespace-nowrap">Artefatos</span>
        </button>

        <button
          type="button"
          onClick={() => handleAction(() => onSelectView('connect'))}
          className={`rounded-2xl py-3 px-1.5 flex flex-col items-center justify-center gap-1.5 border transition-colors min-h-[72px] ${
            activeView === 'connect'
              ? 'bg-[var(--zapia-surface-alt)] border-[var(--zapia-accent)]'
              : 'bg-[var(--zapia-surface)] border-[var(--zapia-border)] hover:bg-[var(--zapia-surface-alt)]'
          }`}
        >
          <Plug className="w-5 h-5" />
          <span className="text-[11px] font-medium whitespace-nowrap">Conectar</span>
        </button>

        <button
          type="button"
          onClick={() => handleAction(() => onSelectView('radar'))}
          className={`relative rounded-2xl py-3 px-1.5 flex flex-col items-center justify-center gap-1.5 border transition-colors min-h-[72px] ${
            activeView === 'radar'
              ? 'bg-[var(--zapia-surface-alt)] border-[var(--zapia-accent)]'
              : 'bg-[var(--zapia-surface)] border-[var(--zapia-border)] hover:bg-[var(--zapia-surface-alt)]'
          }`}
        >
          <Target className="w-5 h-5" />
          <span className="text-[11px] font-medium whitespace-nowrap">Radar</span>
          {radarBadgeCount > 0 && (
            <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-white text-[#111113] text-[10px] font-bold flex items-center justify-center font-mono-tabular">
              {radarBadgeCount}
            </span>
          )}
        </button>
      </div>

      {/* Conversas Section Header & Optional Search */}
      <div className="px-4 pt-2 pb-2 flex items-center justify-between shrink-0">
        <span className="text-xs font-medium text-[var(--zapia-muted)]">Conversas</span>
        <span className="text-[11px] font-mono-tabular text-[var(--zapia-muted)]">
          {filteredThreads.length}
        </span>
      </div>

      {searchOpen && (
        <div className="px-4 pb-2 shrink-0">
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filtrar conversas..."
            aria-label="Filtrar conversas"
            autoFocus
            className="w-full px-3 py-2 rounded-xl bg-[var(--zapia-surface)] border border-[var(--zapia-border)] text-xs text-[var(--zapia-text)] placeholder:text-[var(--zapia-muted)] focus:outline-none focus:border-[var(--zapia-accent)]"
          />
        </div>
      )}

      {/* Threads List */}
      <div className="flex-1 overflow-y-auto px-3 space-y-1 pb-3">
        {filteredThreads.map((thread) => {
          const isActive = activeView === 'assistant' && activeThreadId === thread.id;
          return (
            <button
              key={thread.id}
              type="button"
              onClick={() => handleAction(() => onSelectThread(thread))}
              className={`w-full flex items-center justify-between gap-3 px-2.5 py-2.5 rounded-xl text-left transition-colors min-h-[46px] ${
                isActive
                  ? 'bg-[var(--zapia-surface-alt)] text-[var(--zapia-text)] font-medium'
                  : 'hover:bg-[var(--zapia-surface)] text-[var(--zapia-text)]'
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <ThreadGlyph
                  colorHex={thread.colorHex}
                  variant={thread.glyphVariant}
                  isMail={thread.isMailAssistant}
                />
                <span className="text-sm truncate">{thread.title}</span>
              </div>
              {thread.unreadCount > 0 && (
                <span className="min-w-[20px] h-5 px-1.5 rounded-full bg-white text-[#111113] text-[11px] font-bold flex items-center justify-center font-mono-tabular shrink-0">
                  {thread.unreadCount}
                </span>
              )}
            </button>
          );
        })}

        {filteredThreads.length === 0 && (
          <p className="px-3 py-4 text-xs text-[var(--zapia-muted)] text-center">
            Nenhuma conversa encontrada.
          </p>
        )}
      </div>

      {/* Bottom Bar: Settings Gear + Search + White "Novo chat" Pill */}
      <div className="px-4 py-3 border-t border-[var(--zapia-border)] flex items-center justify-between gap-2 shrink-0 pb-safe">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => handleAction(() => onSelectView('settings'))}
            aria-label="Configurações de voz, persona e temas"
            className={`w-11 h-11 rounded-full border flex items-center justify-center transition-colors ${
              activeView === 'settings'
                ? 'bg-[var(--zapia-accent)] text-[var(--zapia-accent-fg)] border-transparent'
                : 'bg-[var(--zapia-surface)] border-[var(--zapia-border)] hover:border-[var(--zapia-accent)]'
            }`}
          >
            <Settings className="w-5 h-5" />
          </button>

          <button
            type="button"
            onClick={() => setSearchOpen((v) => !v)}
            aria-label="Buscar conversas"
            className={`w-11 h-11 rounded-full border flex items-center justify-center transition-colors ${
              searchOpen
                ? 'bg-[var(--zapia-surface-alt)] border-[var(--zapia-accent)]'
                : 'bg-[var(--zapia-surface)] border-[var(--zapia-border)] hover:border-[var(--zapia-accent)]'
            }`}
          >
            <Search className="w-5 h-5" />
          </button>
        </div>

        <button
          type="button"
          onClick={() => handleAction(onNewChat)}
          className="h-11 px-5 rounded-full bg-white text-[#111113] text-sm font-semibold inline-flex items-center gap-2 hover:bg-neutral-200 transition-colors whitespace-nowrap shrink-0 shadow-sm"
        >
          <MessageCircle className="w-4 h-4 fill-current" />
          <span>Novo chat</span>
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Persistent Sidebar (Screenshot 2) */}
      <aside
        className="hidden lg:block w-[328px] xl:w-[348px] shrink-0 border-r border-[var(--zapia-border)] h-screen sticky top-0 no-print"
        aria-label="Navegação ZAPIA"
      >
        {drawerBody}
      </aside>

      {/* Mobile Full-Screen Slide-Over Drawer */}
      {isMobileDrawerOpen && (
        <div
          className="lg:hidden fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex"
          role="dialog"
          aria-modal="true"
          aria-label="Menu ZAPIA"
        >
          <div className="w-full max-w-[390px] h-full border-r border-[var(--zapia-border)] bg-[var(--zapia-bg)]">
            {drawerBody}
          </div>
          <button
            type="button"
            aria-label="Fechar menu"
            onClick={onCloseMobileDrawer}
            className="flex-1 h-full"
          />
        </div>
      )}
    </>
  );
};
