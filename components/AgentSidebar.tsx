'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport, isTextUIPart } from 'ai';
import type { AgentStepData, AgentUIMessage, AgentVersionData } from '../lib/agent/types';
import type { AspectParam, Effort, Variety } from '../lib/agent/params';
import type { BrandKit } from '../lib/brand/types';
import { CREDITS_CHANGED_EVENT } from './Shell';

const transport = new DefaultChatTransport<AgentUIMessage>({ api: '/api/agent' });

type ChatMode = 'generate' | 'image' | 'design' | 'animate' | 'refine';
type GenMode = Exclude<ChatMode, 'refine'>;
type MenuId = 'aspect' | 'count' | 'scenes' | 'duration' | 'effort' | 'switcher';
type CountParam = 'auto' | number;
type DurationParam = 'auto' | number;

type Thread = { id: string; title: string; updatedAt: string; messages: AgentUIMessage[] };

const THREADS_KEY = 'phantasma-chats:v1';
const PARAMS_KEY = 'phantasma-composer:v1';

const MODES: Array<{ id: GenMode; label: string; shortcut: string }> = [
  { id: 'image', label: 'Image', shortcut: '⌥1' },
  { id: 'generate', label: 'Storyboard', shortcut: '⌥2' },
  { id: 'design', label: 'Design', shortcut: '⌥3' },
  { id: 'animate', label: 'Animation', shortcut: '⌥4' },
];

const ASPECT_OPTIONS: AspectParam[] = ['auto', '16:9', '9:16', '1:1', '4:5'];
const VARIETY_OPTIONS: Array<{ id: Variety; label: string; sub: string }> = [
  { id: 'close', label: 'Close', sub: 'Small differences' },
  { id: 'balanced', label: 'Balanced', sub: 'Clearly different, same idea' },
  { id: 'wide', label: 'Wide', sub: 'Different takes' },
];
const DURATION_PRESETS: Array<{ label: string; ms: number }> = [
  { label: '5s', ms: 5000 },
  { label: '10s', ms: 10000 },
  { label: '15s', ms: 15000 },
  { label: '20s', ms: 20000 },
  { label: '30s', ms: 30000 },
];
const EFFORT_OPTIONS: Array<{ id: Effort; label: string }> = [
  { id: 'low', label: 'Low' },
  { id: 'medium', label: 'Medium' },
  { id: 'high', label: 'High' },
];

function ModeIcon({ mode }: { mode: GenMode }) {
  const common = { width: 15, height: 15, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true } as const;
  if (mode === 'image')
    return (
      <svg {...common}>
        <rect x="3" y="4" width="18" height="16" rx="2" />
        <circle cx="9" cy="10" r="1.6" />
        <path d="M4 18l5.5-5.5 3.5 3.5L17 12l3 3" />
      </svg>
    );
  if (mode === 'generate')
    return (
      <svg {...common}>
        <rect x="3" y="9" width="18" height="11" rx="2" />
        <path d="M3.5 9L5 4.5A1.5 1.5 0 0 1 6.9 3.6l12 2A1.5 1.5 0 0 1 20 7.3L19.4 9" />
        <path d="M8 6l1.2 3M13 6.8L14.2 9" />
      </svg>
    );
  if (mode === 'design')
    return (
      <svg {...common}>
        <rect x="3" y="4" width="18" height="16" rx="2" />
        <path d="M3 10h18M10 10v10" />
      </svg>
    );
  return (
    <svg {...common}>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M8 4v16M16 4v16M3 9h5M3 15h5M16 9h5M16 15h5" />
    </svg>
  );
}

/**
 * The Phantasma agent chat: a Hera-style left panel over the canvas.
 * Mode chips (Image ⌥1 · Storyboard ⌥2 · Design ⌥3 · Animation ⌥4) with
 * per-mode parameter pills — Aspect, Count+Variety, Scenes, Duration, Effort —
 * copied from Hera's composer (research/hera-composer-clickmap.md).
 * Board chats are multiple named threads with a searchable switcher,
 * persisted locally; the editor keeps one refine thread per artifact.
 */
export function AgentSidebar({
  mode,
  artifactId,
  brand = null,
  selectedLayerIds = [],
  layerNames = [],
  onVersionsSaved,
  title = 'Untitled canvas',
  className = '',
}: {
  mode: ChatMode;
  artifactId?: string;
  brand?: BrandKit | null;
  selectedLayerIds?: string[];
  layerNames?: string[];
  onVersionsSaved?: () => void;
  title?: string;
  className?: string;
}) {
  const chat = useChat<AgentUIMessage>({
    transport,
    onFinish: () => {
      onVersionsSavedRef.current?.();
      window.dispatchEvent(new Event(CREDITS_CHANGED_EVENT));
    },
  });

  const isRefine = mode === 'refine';

  /* ---------- chat threads (board only) ---------- */
  const [threads, setThreads] = useState<Thread[]>([]);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [chatSearch, setChatSearch] = useState('');
  const threadsReady = useRef(false);
  const activeThreadRef = useRef<string | null>(null);
  activeThreadRef.current = activeThreadId;

  const persistThreads = useCallback((next: Thread[], activeId: string | null) => {
    try {
      window.localStorage.setItem(THREADS_KEY, JSON.stringify({ activeId, threads: next.slice(0, 30) }));
    } catch {
      // Quota or private mode: live threads still work.
    }
  }, []);

  // Board: restore the thread list once after mount (never during SSR).
  useEffect(() => {
    if (isRefine || threadsReady.current) return;
    threadsReady.current = true;
    let initial: Thread[] = [];
    let activeId: string | null = null;
    try {
      const raw = window.localStorage.getItem(THREADS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as { activeId?: string; threads?: Thread[] };
        initial = Array.isArray(parsed.threads) ? parsed.threads : [];
        activeId = parsed.activeId ?? null;
      }
    } catch {
      initial = [];
    }
    if (initial.length === 0) {
      const t: Thread = { id: `chat_${Date.now().toString(36)}`, title: 'New chat', updatedAt: new Date().toISOString(), messages: [] };
      initial = [t];
      activeId = t.id;
    }
    if (!initial.some((t) => t.id === activeId)) activeId = initial[0].id;
    setThreads(initial);
    setActiveThreadId(activeId);
    const active = initial.find((t) => t.id === activeId);
    chat.setMessages(active?.messages ?? []);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRefine]);

  // Board: save the active thread whenever the conversation settles.
  useEffect(() => {
    if (isRefine || !threadsReady.current || !activeThreadId) return;
    if (chat.status === 'streaming' || chat.status === 'submitted') return;
    setThreads((prev) => {
      const firstUser = chat.messages.find((m) => m.role === 'user');
      const firstText = firstUser?.parts.filter(isTextUIPart).map((p) => p.text).join(' ').trim();
      const next = prev.map((t) =>
        t.id === activeThreadId
          ? { ...t, title: firstText ? firstText.slice(0, 42) : t.title, updatedAt: new Date().toISOString(), messages: chat.messages.slice(-50) }
          : t,
      );
      persistThreads(next, activeThreadId);
      return next;
    });
  }, [chat.messages, chat.status, isRefine, activeThreadId, persistThreads]);

  // Refine: one persisted thread per artifact (unchanged behaviour, new key).
  const refineKey = `phantasma-chat:refine:${artifactId ?? ''}`;
  const refineRestored = useRef<string | null>(null);
  useEffect(() => {
    if (!isRefine || refineRestored.current === refineKey) return;
    refineRestored.current = refineKey;
    try {
      const raw = window.localStorage.getItem(refineKey) ?? window.localStorage.getItem(`basix-chat:refine:${artifactId ?? ''}`);
      chat.setMessages(raw ? (JSON.parse(raw) as AgentUIMessage[]) : []);
    } catch {
      chat.setMessages([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRefine, refineKey]);

  useEffect(() => {
    if (!isRefine || refineRestored.current !== refineKey) return;
    if (chat.status === 'streaming' || chat.status === 'submitted') return;
    try {
      window.localStorage.setItem(refineKey, JSON.stringify(chat.messages.slice(-50)));
    } catch {
      // Live thread still works.
    }
  }, [chat.messages, chat.status, isRefine, refineKey]);

  function switchThread(id: string) {
    if (id === activeThreadId) return;
    const target = threads.find((t) => t.id === id);
    setActiveThreadId(id);
    chat.setMessages(target?.messages ?? []);
    persistThreads(threads, id);
    setOpenMenu(null);
  }

  function newThread() {
    const t: Thread = { id: `chat_${Date.now().toString(36)}`, title: 'New chat', updatedAt: new Date().toISOString(), messages: [] };
    const next = [t, ...threads];
    setThreads(next);
    setActiveThreadId(t.id);
    chat.setMessages([]);
    persistThreads(next, t.id);
    setOpenMenu(null);
  }

  /* ---------- composer state ---------- */
  const [input, setInput] = useState('');
  const [genMode, setGenMode] = useState<GenMode>(mode === 'refine' ? 'image' : mode);
  const [aspect, setAspect] = useState<AspectParam>('auto');
  const [count, setCount] = useState<CountParam>('auto');
  const [variety, setVariety] = useState<Variety>('balanced');
  const [scenes, setScenes] = useState(3);
  const [duration, setDuration] = useState<DurationParam>('auto');
  const [customSec, setCustomSec] = useState('');
  const [effort, setEffort] = useState<Effort>('medium');
  const [openMenu, setOpenMenu] = useState<MenuId | null>(null);
  const [attachOpen, setAttachOpen] = useState(false);
  const [sourceIds, setSourceIds] = useState<string[]>([]);
  const [sources, setSources] = useState<Array<{ id: string; title: string; currentVersion: number }>>([]);
  const [sourcesLoading, setSourcesLoading] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const onVersionsSavedRef = useRef(onVersionsSaved);
  onVersionsSavedRef.current = onVersionsSaved;

  // Restore composer parameters (sticky across modes and sessions, like Hera's aspect pill).
  const paramsRestored = useRef(false);
  useEffect(() => {
    if (paramsRestored.current) return;
    paramsRestored.current = true;
    try {
      const raw = window.localStorage.getItem(PARAMS_KEY);
      if (!raw) return;
      const p = JSON.parse(raw) as Partial<{ aspect: AspectParam; count: CountParam; variety: Variety; scenes: number; duration: DurationParam; effort: Effort }>;
      if (p.aspect) setAspect(p.aspect);
      if (p.count) setCount(p.count);
      if (p.variety) setVariety(p.variety);
      if (p.scenes) setScenes(p.scenes);
      if (p.duration) setDuration(p.duration);
      if (p.effort) setEffort(p.effort);
    } catch {
      // Defaults stand.
    }
  }, []);

  useEffect(() => {
    if (!paramsRestored.current) return;
    try {
      window.localStorage.setItem(PARAMS_KEY, JSON.stringify({ aspect, count, variety, scenes, duration, effort }));
    } catch {
      // Non-fatal.
    }
  }, [aspect, count, variety, scenes, duration, effort]);

  const loadSources = useCallback(async () => {
    if (isRefine) return;
    setSourcesLoading(true);
    try {
      const r = await fetch('/api/artifacts');
      if (r.ok) {
        const list = (await r.json()) as Array<{ id: string; title: string; currentVersion: number }>;
        setSources(list);
        setSourceIds((cur) => {
          const valid = cur.filter((id) => list.some((x) => x.id === id));
          return valid.length ? valid : list[0] ? [list[0].id] : [];
        });
      }
    } finally {
      setSourcesLoading(false);
    }
  }, [isRefine]);

  useEffect(() => {
    void loadSources();
  }, [loadSources]);

  useEffect(() => {
    if (genMode === 'design' || genMode === 'animate') void loadSources();
  }, [genMode, loadSources]);

  // Hera's mode shortcuts: ⌥1 Image, ⌥2 Storyboard, ⌥3 Design, ⌥4 Animation.
  useEffect(() => {
    if (isRefine) return;
    const onKey = (e: KeyboardEvent) => {
      if (!e.altKey) return;
      const idx = ['1', '2', '3', '4'].indexOf(e.key);
      if (idx >= 0) {
        e.preventDefault();
        setGenMode(MODES[idx].id);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isRefine]);

  const effectiveMode: ChatMode = isRefine ? 'refine' : genMode;
  const busy = chat.status === 'streaming' || chat.status === 'submitted';
  const activeThread = threads.find((t) => t.id === activeThreadId);

  const greeting = useMemo(() => {
    if (isRefine) return 'What should change?';
    if (genMode === 'image') return 'Describe an image. It lands on the board as a still — never a video unless you animate it.';
    if (genMode === 'design') return 'Pick a card — every element becomes an editable layer.';
    if (genMode === 'animate') return 'Pick a card — Phantasma picks the motion, you pick the length.';
    return 'Hi, what are we creating today?';
  }, [isRefine, genMode]);

  async function send() {
    const text = input.trim();
    if (!text || busy) return;
    if (effectiveMode === 'refine' && selectedLayerIds.length === 0) return;
    if ((effectiveMode === 'design' || effectiveMode === 'animate') && sourceIds.length === 0) return;
    setInput('');
    await chat.sendMessage(
      { text },
      {
        body: {
          mode: effectiveMode,
          ...(effectiveMode === 'refine' ? { artifactId, selectedLayerIds } : {}),
          ...(!isRefine
            ? {
                aspect,
                variety,
                effort,
                ...(count !== 'auto' && (effectiveMode === 'generate' || effectiveMode === 'image') ? { count } : {}),
                ...(effectiveMode === 'generate' ? { scenes } : {}),
                ...(effectiveMode === 'design' || effectiveMode === 'animate' ? { sourceArtifactIds: sourceIds } : {}),
                ...(effectiveMode === 'animate' && duration !== 'auto' ? { durationMs: duration } : {}),
              }
            : {}),
          brand,
        },
      },
    );
  }

  const newest = chat.messages[chat.messages.length - 1];
  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }, [chat.messages.length, newest?.id, chat.status]);

  const toggleMenu = (m: MenuId) => setOpenMenu((cur) => (cur === m ? null : m));

  const durationLabel = duration === 'auto' ? 'Auto' : `${Math.round(duration / 1000)}s`;
  const visibleThreads = threads.filter((t) => t.title.toLowerCase().includes(chatSearch.trim().toLowerCase()));

  return (
    <aside className={`agent-sidebar ${className}`} aria-label="Agent chat">
      <header className="agent-head">
        <div style={{ minWidth: 0 }}>
          <div className="agent-title truncate">{isRefine ? title : 'Phantasma'}</div>
          <div className="agent-sub muted truncate">{isRefine ? 'Editor chat' : title}</div>
        </div>
        {brand && (
          <div className="agent-brand-chip" title={brand.sourceUrl}>
            <span className="swatch" style={{ background: brand.colors.primary }} />
            <span className="swatch" style={{ background: brand.colors.secondary }} />
            <span className="truncate">{brand.name}</span>
          </div>
        )}
      </header>

      {!isRefine && (
        <div className="chat-switcher">
          <button type="button" className="chat-switcher-btn" aria-haspopup="listbox" aria-expanded={openMenu === 'switcher'} onClick={() => toggleMenu('switcher')}>
            <span className="truncate">{activeThread?.title ?? 'New chat'}</span>
            <span aria-hidden="true">▾</span>
          </button>
          <button type="button" className="chat-new-btn" aria-label="New chat" title="New chat" onClick={newThread}>
            +
          </button>
          {openMenu === 'switcher' && (
            <>
              <div className="menu-backdrop" onClick={() => setOpenMenu(null)} />
              <div className="chat-pop" role="listbox" aria-label="Chats">
                <input type="search" placeholder="Search chats" value={chatSearch} onChange={(e) => setChatSearch(e.target.value)} aria-label="Search chats" autoFocus />
                <div className="menu-head">Chats</div>
                {visibleThreads.length === 0 && <p className="muted" style={{ margin: 0, fontSize: 12.5 }}>No chats match.</p>}
                {visibleThreads.map((t) => (
                  <button key={t.id} type="button" role="option" aria-selected={t.id === activeThreadId} className="chat-pop-item" data-active={t.id === activeThreadId} onClick={() => switchThread(t.id)}>
                    <span className="truncate">{t.title}</span>
                    {t.id === activeThreadId && <span aria-hidden="true">✓</span>}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      <div className="agent-feed" ref={listRef}>
        {chat.messages.length === 0 && (
          <div className="agent-greeting">
            <p className="agent-greeting-line">{greeting}</p>
            {!isRefine && (
              <>
                <p className="muted" style={{ margin: 0, fontSize: 13 }}>
                  Ask for images, designs, animations or a storyboard. Select cards to use them.
                </p>
                <div className="agent-suggestions">
                  {(genMode === 'image'
                    ? ['One flavour per ad, big headline, product in front', 'Cold brew can on wet marble, morning light', 'Skincare jar, soft shadow, cream backdrop']
                    : genMode === 'design'
                      ? ['Make this ad editable', 'Separate every element into layers']
                      : genMode === 'animate'
                        ? ['Animate this ad', 'Text reveals, product floats']
                        : ['Launch video for a yoga booking app', '15s product ad for cold brew', 'Promo for a design tool']
                  ).map((s) => (
                    <button key={s} type="button" className="suggestion" onClick={() => setInput(s)}>
                      {s}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {chat.messages.map((m) => (
          <AgentMessage key={m.id} message={m} streaming={busy && m.id === newest?.id} />
        ))}

        {chat.error && (
          <p role="alert" className="agent-error">
            {cleanError(chat.error.message)}
          </p>
        )}
      </div>

      <footer className="agent-composer">
        {!isRefine && (
          <>
            <div className="agent-modes" role="tablist" aria-label="Generation mode">
              {MODES.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  role="tab"
                  aria-selected={genMode === m.id}
                  className="mode-chip"
                  data-active={genMode === m.id}
                  title={`${m.label} · ${m.shortcut}`}
                  onClick={() => setGenMode(m.id)}
                >
                  <ModeIcon mode={m.id} />
                  {genMode === m.id && <span>{m.label}</span>}
                </button>
              ))}
            </div>

            {(attachOpen || genMode === 'design' || genMode === 'animate') && (
              <div className="agent-options" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
                <span className="agent-option-note">
                  {genMode === 'design' ? 'Design' : genMode === 'animate' ? 'Animation' : 'Using'} · {aspect === 'auto' ? 'Auto format' : aspect} · {sourceIds.length} card{sourceIds.length === 1 ? '' : 's'}
                  {genMode === 'animate' && sourceIds.length > 1 ? ` → ${sourceIds.length} films` : ''}
                </span>
                {sources.length === 0 ? (
                  <span className="agent-option-note">{sourcesLoading ? 'Loading cards…' : 'No cards yet — make an image first'}</span>
                ) : (
                  <div className="agent-sources" role="group" aria-label="Source cards">
                    {sources.map((s) => (
                      <label key={s.id} className="agent-source">
                        <input
                          type="checkbox"
                          checked={sourceIds.includes(s.id)}
                          onChange={() => setSourceIds((cur) => (cur.includes(s.id) ? cur.filter((x) => x !== s.id) : [...cur, s.id].slice(-8)))}
                        />
                        <span className="truncate">
                          {s.title} · v{s.currentVersion}
                        </span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}
        {isRefine && <RefineScope count={selectedLayerIds.length} layerNames={layerNames} />}

        <div className="agent-inputrow">
          <textarea
            className="agent-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                void send();
              }
            }}
            placeholder={
              effectiveMode === 'refine'
                ? 'Make the headline bigger…'
                : genMode === 'image'
                  ? 'Make 4 product shots on a marble table…'
                  : genMode === 'design'
                    ? 'Make this ad editable…'
                    : genMode === 'animate'
                      ? 'Turn the selected image into a 5-second animation…'
                      : 'A 15-second product ad, an explainer, a launch teaser — any animation…'
            }
            rows={2}
            aria-label={effectiveMode === 'refine' ? 'Change request' : 'Prompt'}
          />
        </div>

        {!isRefine && (
          <div className="param-row">
            <button type="button" className="param-plus" aria-label="Use cards" title="Use cards as sources" aria-expanded={attachOpen} onClick={() => setAttachOpen((v) => !v)}>
              +
            </button>

            <div className="param-wrap">
              <button type="button" className="param-pill" aria-haspopup="menu" aria-expanded={openMenu === 'aspect'} onClick={() => toggleMenu('aspect')}>
                {aspect === 'auto' ? 'Auto' : aspect} <span aria-hidden="true">▾</span>
              </button>
              {openMenu === 'aspect' && (
                <Menu onClose={() => setOpenMenu(null)}>
                  {ASPECT_OPTIONS.map((a) => (
                    <MenuRow key={a} label={a === 'auto' ? 'Auto' : a} selected={aspect === a} onClick={() => { setAspect(a); setOpenMenu(null); }} />
                  ))}
                </Menu>
              )}
            </div>

            {genMode !== 'generate' && (
              <div className="param-wrap">
                <button type="button" className="param-pill" aria-haspopup="menu" aria-expanded={openMenu === 'count'} onClick={() => toggleMenu('count')}>
                  Count {count === 'auto' ? 'Auto' : count} <span aria-hidden="true">▾</span>
                </button>
                {openMenu === 'count' && (
                  <Menu onClose={() => setOpenMenu(null)} align="right">
                    <div className="menu-head">Count</div>
                    <MenuRow label="Auto" sub="Phantasma reads the count from your message." selected={count === 'auto'} onClick={() => { setCount('auto'); setOpenMenu(null); }} />
                    <div className="menu-seg" role="group" aria-label="Count">
                      {[1, 2, 3, 4, 5, 6].map((n) => (
                        <button key={n} type="button" data-active={count === n} onClick={() => { setCount(n); setOpenMenu(null); }}>
                          {n}
                        </button>
                      ))}
                    </div>
                    <div className="menu-head">Variety</div>
                    {VARIETY_OPTIONS.map((v) => (
                      <MenuRow key={v.id} label={v.label} sub={v.sub} selected={variety === v.id} onClick={() => { setVariety(v.id); setOpenMenu(null); }} />
                    ))}
                  </Menu>
                )}
              </div>
            )}

            {genMode === 'generate' && (
              <div className="param-wrap">
                <button type="button" className="param-pill" aria-haspopup="menu" aria-expanded={openMenu === 'scenes'} onClick={() => toggleMenu('scenes')}>
                  Scenes {scenes} <span aria-hidden="true">▾</span>
                </button>
                {openMenu === 'scenes' && (
                  <Menu onClose={() => setOpenMenu(null)}>
                    <div className="menu-head">Scenes</div>
                    <div className="menu-seg" role="group" aria-label="Scenes">
                      {[1, 2, 3, 4, 5, 6, 7].map((n) => (
                        <button key={n} type="button" data-active={scenes === n} onClick={() => { setScenes(n); setOpenMenu(null); }}>
                          {n}
                        </button>
                      ))}
                    </div>
                  </Menu>
                )}
              </div>
            )}

            {genMode === 'animate' && (
              <div className="param-wrap">
                <button type="button" className="param-pill" aria-haspopup="menu" aria-expanded={openMenu === 'duration'} onClick={() => toggleMenu('duration')}>
                  ◷ {durationLabel} <span aria-hidden="true">▾</span>
                </button>
                {openMenu === 'duration' && (
                  <Menu onClose={() => setOpenMenu(null)} align="right">
                    <div className="menu-head">Duration</div>
                    <div className="menu-seg" role="group" aria-label="Duration">
                      <button type="button" data-active={duration === 'auto'} onClick={() => { setDuration('auto'); setOpenMenu(null); }}>
                        Auto
                      </button>
                      {DURATION_PRESETS.map((d) => (
                        <button key={d.ms} type="button" data-active={duration === d.ms} onClick={() => { setDuration(d.ms); setOpenMenu(null); }}>
                          {d.label}
                        </button>
                      ))}
                    </div>
                    <label className="menu-custom">
                      <span>Custom seconds</span>
                      <input
                        type="number"
                        min={3}
                        max={120}
                        placeholder="—"
                        value={customSec}
                        onChange={(e) => setCustomSec(e.target.value)}
                        onBlur={() => {
                          const n = Number(customSec);
                          if (Number.isFinite(n) && n >= 3) setDuration(Math.min(120, n) * 1000);
                        }}
                        aria-label="Custom seconds"
                      />
                    </label>
                    <p className="menu-note">Phantasma picks the length, up to 120 s.</p>
                  </Menu>
                )}
              </div>
            )}

            <div className="param-wrap" style={{ marginLeft: 'auto' }}>
              <button type="button" className="param-pill" aria-haspopup="menu" aria-expanded={openMenu === 'effort'} onClick={() => toggleMenu('effort')}>
                {effort[0].toUpperCase() + effort.slice(1)} <span aria-hidden="true">▾</span>
              </button>
              {openMenu === 'effort' && (
                <Menu onClose={() => setOpenMenu(null)} align="right">
                  <p className="menu-note">Higher effort means better creations, but takes longer.</p>
                  {EFFORT_OPTIONS.map((e) => (
                    <MenuRow key={e.id} label={e.label} selected={effort === e.id} onClick={() => { setEffort(e.id); setOpenMenu(null); }} />
                  ))}
                </Menu>
              )}
            </div>

            {busy ? (
              <button type="button" className="agent-send agent-stop" aria-label="Stop" onClick={() => chat.stop()}>
                <span aria-hidden="true">■</span>
              </button>
            ) : (
              <button
                type="button"
                className="agent-send"
                aria-label="Send"
                disabled={
                  input.trim().length < 2 ||
                  (effectiveMode === 'refine' && selectedLayerIds.length === 0) ||
                  ((effectiveMode === 'design' || effectiveMode === 'animate') && sourceIds.length === 0)
                }
                onClick={() => void send()}
              >
                <span aria-hidden="true">↑</span>
              </button>
            )}
          </div>
        )}

        {isRefine && (
          <div className="param-row">
            {busy ? (
              <button type="button" className="agent-send agent-stop" aria-label="Stop" onClick={() => chat.stop()}>
                <span aria-hidden="true">■</span>
              </button>
            ) : (
              <button type="button" className="agent-send" aria-label="Send" disabled={input.trim().length < 2 || selectedLayerIds.length === 0} onClick={() => void send()}>
                <span aria-hidden="true">↑</span>
              </button>
            )}
          </div>
        )}

        <p className="agent-fineprint muted">
          {isRefine ? 'Touches only the selected layers · 1 credit' : `${MODES.find((m) => m.id === genMode)?.label} · ${aspect === 'auto' ? 'Auto' : aspect} · 1 credit per run`}
        </p>
      </footer>
    </aside>
  );
}

function Menu({ children, onClose, align = 'left' }: { children: React.ReactNode; onClose: () => void; align?: 'left' | 'right' }) {
  return (
    <>
      <div className="menu-backdrop" onClick={onClose} />
      <div className="param-menu" data-align={align} role="menu">
        {children}
      </div>
    </>
  );
}

function MenuRow({ label, sub, selected, onClick }: { label: string; sub?: string; selected: boolean; onClick: () => void }) {
  return (
    <button type="button" role="menuitemradio" aria-checked={selected} className="menu-row" data-selected={selected} onClick={onClick}>
      <span>
        {label}
        {sub && <span className="menu-row-sub">{sub}</span>}
      </span>
      {selected && <span aria-hidden="true">✓</span>}
    </button>
  );
}

function RefineScope({ count, layerNames }: { count: number; layerNames?: string[] }) {
  if (count === 0) {
    return (
      <p className="agent-scope muted" style={{ margin: 0 }}>
        Select layers in the preview or the list — the agent changes only what is selected.
      </p>
    );
  }
  return (
    <div className="agent-refs" aria-label={`${count} layer(s) in scope`}>
      <span className="ref-chip">
        <span className="ref-dot" aria-hidden="true" />
        {count === 1 ? `${layerNames?.[0] || '1 layer'} · in scope` : `${count} layers · in scope`}
      </span>
    </div>
  );
}

function AgentMessage({ message, streaming }: { message: AgentUIMessage; streaming: boolean }) {
  if (message.role === 'user') {
    return (
      <div className="agent-msg agent-msg-user">
        {message.parts.filter(isTextUIPart).map((p, i) => (
          <p key={i} style={{ margin: 0 }}>
            {p.text}
          </p>
        ))}
      </div>
    );
  }

  const steps = message.parts.filter((p): p is { type: 'data-step'; id?: string; data: AgentStepData } => p.type === 'data-step');
  const versions = message.parts.filter((p): p is { type: 'data-version'; id?: string; data: AgentVersionData } => p.type === 'data-version');
  const hasAnything = steps.length > 0 || versions.length > 0;

  if (!hasAnything && streaming) {
    return (
      <div className="agent-msg agent-msg-agent">
        <span className="agent-thinking" aria-label="Working">
          <i />
          <i />
          <i />
        </span>
      </div>
    );
  }
  if (!hasAnything) return null;

  return (
    <div className="agent-msg agent-msg-agent">
      {steps.length > 0 && (
        <ol className="steps agent-steps" aria-label="Agent progress">
          {steps.map((p) => (
            <li key={p.id ?? p.data.id} data-status={p.data.status}>
              <span className="mark-state" aria-hidden="true" />
              <span>
                {p.data.label}
                <span className="muted">{p.data.status === 'running' ? ' — working' : p.data.status === 'done' ? ' — done' : ' — failed'}</span>
                {p.data.detail && <span className="muted"> · {p.data.detail}</span>}
              </span>
            </li>
          ))}
        </ol>
      )}
      {versions.length > 0 && (
        <div className="agent-versions">
          {versions.map((p) => (
            <span key={p.id ?? `${p.data.artifactId}:${p.data.version}`} className="version-chip">
              v{p.data.version} saved — on the board
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function cleanError(raw: string): string {
  try {
    const j = JSON.parse(raw.replace(/^[^\{]*/, ''));
    if (typeof j?.error === 'string') return j.error;
  } catch {
    // not JSON — fall through
  }
  return raw
    .replace(/^Failed to (submit|fetch)[^:]*:\s*/i, '')
    .replace(/^\d{3}\s*/, '')
    .replace(/^Error:\s*/, '');
}
