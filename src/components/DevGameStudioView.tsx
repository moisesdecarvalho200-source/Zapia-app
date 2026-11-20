import React, { useMemo, useState } from 'react';
import {
  Code2,
  Download,
  FolderLock,
  Gamepad2,
  Loader2,
  Play,
  Sparkles,
  Smartphone,
} from 'lucide-react';

export type ProjectTargetKind = 'html5-game' | 'react-app' | 'flutter-mobile' | 'node-api';

interface DevGameStudioViewProps {
  isOnline: boolean;
  onSaveToVault: (title: string, mimeType: string, content: string) => Promise<void>;
  onAskZapiaInChat: (prompt: string) => void;
}

const STARTER_TEMPLATES: Record<
  ProjectTargetKind,
  { label: string; filename: string; mime: string; code: string }
> = {
  'html5-game': {
    label: 'Jogo HTML5 Canvas',
    filename: 'zapia_star_dodge_game.html',
    mime: 'text/html',
    code: `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>ZAPIA Star Runner</title>
<style>
  body { margin: 0; background: #0f1014; color: #f4f4f5; font-family: system-ui, sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100vh; }
  canvas { border: 1px solid #2e323d; border-radius: 16px; background: radial-gradient(circle at top, #1b1e29, #0d0e12); max-width: 95vw; }
  .hud { display: flex; gap: 16px; margin-bottom: 10px; font-size: 14px; font-weight: 600; }
  button { margin-top: 10px; padding: 8px 18px; border-radius: 999px; border: none; background: #C4F16E; color: #111; font-weight: 700; cursor: pointer; }
</style>
</head>
<body>
  <div class="hud">
    <span id="score">Pontos: 0</span>
    <span>Use Setas / A-D para mover</span>
  </div>
  <canvas id="game" width="460" height="320"></canvas>
  <button onclick="resetGame()">Reiniciar Jogo</button>
<script>
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
let player = { x: 210, y: 275, w: 40, h: 16, speed: 6 };
let stars = [];
let score = 0;
let alive = true;
const keys = {};
window.addEventListener('keydown', e => keys[e.key] = true);
window.addEventListener('keyup', e => keys[e.key] = false);
function resetGame() {
  stars = []; score = 0; alive = true; player.x = 210;
  document.getElementById('score').textContent = 'Pontos: 0';
}
function loop() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (alive) {
    if (keys['ArrowLeft'] || keys['a'] || keys['A']) player.x = Math.max(8, player.x - player.speed);
    if (keys['ArrowRight'] || keys['d'] || keys['D']) player.x = Math.min(canvas.width - player.w - 8, player.x + player.speed);
    if (Math.random() < 0.06) stars.push({ x: Math.random() * (canvas.width - 16), y: -14, r: 8, v: 2.4 + Math.random() * 2.2, good: Math.random() > 0.35 });
    for (let i = stars.length - 1; i >= 0; i--) {
      const s = stars[i];
      s.y += s.v;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fillStyle = s.good ? '#C4F16E' : '#F43F5E';
      ctx.fill();
      if (s.x > player.x && s.x < player.x + player.w && s.y + s.r > player.y && s.y - s.r < player.y + player.h) {
        if (s.good) { score += 10; document.getElementById('score').textContent = 'Pontos: ' + score; }
        else { alive = false; }
        stars.splice(i, 1);
      } else if (s.y > canvas.height + 20) stars.splice(i, 1);
    }
  } else {
    ctx.fillStyle = '#f4f4f5';
    ctx.font = 'bold 20px system-ui';
    ctx.textAlign = 'center';
    ctx.fillText('Fim de jogo! Pontuação: ' + score, canvas.width / 2, canvas.height / 2);
  }
  ctx.fillStyle = '#38bdf8';
  ctx.fillRect(player.x, player.y, player.w, player.h);
  requestAnimationFrame(loop);
}
loop();
</script>
</body>
</html>`,
  },
  'react-app': {
    label: 'App React / TypeScript',
    filename: 'ZapiaTaskWidget.tsx',
    mime: 'text/plain',
    code: `import React, { useState } from 'react';

export function ZapiaTaskWidget() {
  const [tasks, setTasks] = useState<string[]>(['Publicar build Android/PC', 'Treinar voz ZAPIA']);
  const [text, setText] = useState('');

  return (
    <div style={{ padding: 24, fontFamily: 'system-ui', background: '#141416', color: '#fff', borderRadius: 16 }}>
      <h2>Meu App ZAPIA</h2>
      <form onSubmit={(e) => { e.preventDefault(); if (text.trim()) { setTasks([...tasks, text.trim()]); setText(''); } }}>
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Nova tarefa..." />
        <button type="submit">Adicionar</button>
      </form>
      <ul>{tasks.map((t, i) => <li key={i}>{t}</li>)}</ul>
    </div>
  );
}`,
  },
  'flutter-mobile': {
    label: 'App Flutter Mobile',
    filename: 'main_zapia_app.dart',
    mime: 'text/plain',
    code: `import 'package:flutter/material.dart';

void main() => runApp(const ZapiaMobileApp());

class ZapiaMobileApp extends StatelessWidget {
  const ZapiaMobileApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      theme: ThemeData.dark(useMaterial3: true),
      home: const ZapiaHomePage(),
    );
  }
}

class ZapiaHomePage extends StatefulWidget {
  const ZapiaHomePage({super.key});
  @override
  State<ZapiaHomePage> createState() => _ZapiaHomePageState();
}

class _ZapiaHomePageState extends State<ZapiaHomePage> {
  final _notes = <String>['Sincronização Offline AES-256 ativa'];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('ZAPIA Flutter Studio')),
      body: ListView.builder(
        itemCount: _notes.length,
        itemBuilder: (_, i) => ListTile(title: Text(_notes[i])),
      ),
      floatingActionButton: FloatingActionButton(
        onPressed: () => setState(() => _notes.add('Novo item #\${_notes.length + 1}')),
        child: const Icon(Icons.add),
      ),
    );
  }
}`,
  },
  'node-api': {
    label: 'Backend Node.js API',
    filename: 'zapia_api_server.ts',
    mime: 'text/plain',
    code: `import express from 'express';

const app = express();
app.use(express.json());

app.get('/api/status', (_req, res) => {
  res.json({ ok: true, service: 'ZAPIA Backend Customizado' });
});

app.listen(3000, () => console.log('Servidor rodando na porta 3000'));`,
  },
};

export const DevGameStudioView: React.FC<DevGameStudioViewProps> = ({
  isOnline,
  onSaveToVault,
  onAskZapiaInChat,
}) => {
  const [target, setTarget] = useState<ProjectTargetKind>('html5-game');
  const [prompt, setPrompt] = useState('');
  const [code, setCode] = useState(STARTER_TEMPLATES['html5-game'].code);
  const [isGenerating, setIsGenerating] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [showLivePreview, setShowLivePreview] = useState(true);

  const activeTemplate = useMemo(() => STARTER_TEMPLATES[target], [target]);

  const handleSelectTarget = (next: ProjectTargetKind) => {
    setTarget(next);
    setCode(STARTER_TEMPLATES[next].code);
    setStatusMessage(null);
  };

  const handleGenerateCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim()) return;
    setStatusMessage(null);

    if (!isOnline) {
      setStatusMessage(
        'Modo offline ativo: carregamos o template completo para edição local e exportação.'
      );
      return;
    }

    setIsGenerating(true);
    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          persona: 'criativo',
          message: `Gere código completo e pronto para rodar (${activeTemplate.label}) para o pedido a seguir. Retorne APENAS o código fonte no campo reply, sem explicações longas fora de comentários:\n\n${prompt.trim()}`,
        }),
      });
      if (!res.ok) throw new Error('Falha ao gerar código.');
      const data = (await res.json()) as { reply?: string };
      const cleaned = (data.reply || '')
        .replace(/^```[a-zA-Z]*\n?/, '')
        .replace(/```$/, '')
        .trim();
      if (cleaned) {
        setCode(cleaned);
        setStatusMessage('Código gerado pela IA ZAPIA! Você pode testar, baixar ou salvar no Cofre.');
      }
    } catch {
      setStatusMessage('Não foi possível consultar a IA agora; edite o template diretamente.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownload = () => {
    const blob = new Blob([code], { type: activeTemplate.mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = activeTemplate.filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-5">
      <div className="rounded-3xl border border-[var(--zapia-border)] bg-[var(--zapia-surface)] p-5 sm:p-6 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <Gamepad2 className="w-5 h-5 text-[var(--zapia-accent)]" />
            <div>
              <h2 className="text-lg font-semibold text-[var(--zapia-text)]">
                Estúdio de Criação de Jogos, Apps & Programação
              </h2>
              <p className="text-xs text-[var(--zapia-muted)]">
                Crie jogos HTML5 jogáveis ao vivo, componentes React, apps Flutter ou APIs Node.js.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() =>
              onAskZapiaInChat(
                `Me ajude a planejar a arquitetura, mecânicas e telas para este projeto (${activeTemplate.label}): ${prompt || 'Novo aplicativo ou jogo ZAPIA'}`
              )
            }
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full border border-[var(--zapia-border)] bg-[var(--zapia-bg)] text-xs font-medium hover:border-[var(--zapia-accent)]"
          >
            <Sparkles className="w-3.5 h-3.5 text-[var(--zapia-accent)]" />
            <span>Planejar com ZAPIA no Chat</span>
          </button>
        </div>

        {/* Target Pills */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
          {(Object.keys(STARTER_TEMPLATES) as ProjectTargetKind[]).map((key) => {
            const active = target === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => handleSelectTarget(key)}
                className={`p-3 rounded-2xl border text-left transition-colors ${
                  active
                    ? 'border-[var(--zapia-accent)] bg-[var(--zapia-accent-soft)] text-[var(--zapia-text)]'
                    : 'border-[var(--zapia-border)] bg-[var(--zapia-bg)] text-[var(--zapia-muted)]'
                }`}
              >
                <div className="flex items-center gap-1.5 text-xs font-semibold">
                  {key === 'html5-game' ? (
                    <Gamepad2 className="w-4 h-4 text-[var(--zapia-accent)]" />
                  ) : key === 'flutter-mobile' ? (
                    <Smartphone className="w-4 h-4 text-[var(--zapia-accent)]" />
                  ) : (
                    <Code2 className="w-4 h-4 text-[var(--zapia-accent)]" />
                  )}
                  <span className="truncate">{STARTER_TEMPLATES[key].label}</span>
                </div>
              </button>
            );
          })}
        </div>

        {/* AI Generator Prompt */}
        <form onSubmit={handleGenerateCode} className="flex flex-col sm:flex-row gap-2">
          <label htmlFor="dev-prompt-input" className="sr-only">
            Descreva o jogo ou aplicativo que deseja programar
          </label>
          <input
            id="dev-prompt-input"
            type="text"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Ex: Jogo de nave espacial com chefão, ou app de controle financeiro..."
            className="flex-1 px-4 py-2.5 rounded-full border border-[var(--zapia-border)] bg-[var(--zapia-bg)] text-sm text-[var(--zapia-text)]"
          />
          <button
            type="submit"
            disabled={isGenerating}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-full bg-white text-[#111113] text-xs font-semibold hover:bg-neutral-200 disabled:opacity-60 shrink-0"
          >
            {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            <span>Gerar Código</span>
          </button>
        </form>

        {statusMessage && (
          <p className="text-xs text-emerald-400" role="status">
            {statusMessage}
          </p>
        )}

        {/* Editor & Sandbox Split */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-[var(--zapia-muted)]">
              <span className="font-mono-tabular">{activeTemplate.filename}</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleDownload}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-[var(--zapia-border)] hover:border-[var(--zapia-accent)] text-[var(--zapia-text)]"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Baixar</span>
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    await onSaveToVault(activeTemplate.filename, activeTemplate.mime, code);
                    setStatusMessage(`"${activeTemplate.filename}" criptografado e salvo no Cofre E2EE!`);
                  }}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-[var(--zapia-border)] hover:border-[var(--zapia-accent)] text-[var(--zapia-text)]"
                >
                  <FolderLock className="w-3.5 h-3.5" />
                  <span>Salvar no Cofre</span>
                </button>
              </div>
            </div>
            <textarea
              aria-label="Editor de código fonte"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              rows={15}
              spellCheck={false}
              className="w-full p-3.5 rounded-2xl border border-[var(--zapia-border)] bg-[#0b0c10] text-xs font-mono text-emerald-300 leading-relaxed focus:outline-none"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-[var(--zapia-muted)]">
              <span>Execução & Pré-visualização Segura</span>
              {target === 'html5-game' && (
                <button
                  type="button"
                  onClick={() => setShowLivePreview((v) => !v)}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-[var(--zapia-border)] text-[var(--zapia-text)]"
                >
                  <Play className="w-3 h-3" />
                  <span>{showLivePreview ? 'Ocultar Tela' : 'Rodar Jogo'}</span>
                </button>
              )}
            </div>
            {target === 'html5-game' && showLivePreview ? (
              <iframe
                title="Sandbox de execução de jogo HTML5"
                sandbox="allow-scripts"
                srcDoc={code}
                className="w-full h-[350px] rounded-2xl border border-[var(--zapia-border)] bg-[#0d0e12]"
              />
            ) : (
              <div className="h-[350px] rounded-2xl border border-[var(--zapia-border)] bg-[var(--zapia-bg)] p-5 flex flex-col justify-center items-center text-center space-y-2">
                <Code2 className="w-8 h-8 text-[var(--zapia-accent)]" />
                <p className="text-sm font-semibold text-[var(--zapia-text)]">
                  Projeto {activeTemplate.label} pronto para exportar
                </p>
                <p className="text-xs text-[var(--zapia-muted)] max-w-xs">
                  Clique em &ldquo;Baixar&rdquo; ou &ldquo;Salvar no Cofre&rdquo; para usar no Flutter, React ou servidor Node, ou selecione &ldquo;Jogo Arcade HTML5 Canvas&rdquo; para rodar ao vivo no navegador.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
