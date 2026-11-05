'use client';

import dynamic from 'next/dynamic';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AgentSidebar } from './AgentSidebar';
import { PlayerPreview } from './PlayerPreview';
import type { BrandKit } from '../lib/brand/types';
import { cardMeta, type SceneDoc } from '../lib/scenedoc';

const TldrawBoard = dynamic(() => import('./board/TldrawBoard').then((m) => m.TldrawBoard), { ssr: false });

export type BrandRec = BrandKit & { id: string };

export type ArtifactItem = {
  id: string;
  title: string;
  currentVersion: number;
  createdAt: string;
  doc: SceneDoc | null;
};

/**
 * The board, Hera-style: the agent chat floats over the infinite canvas and
 * every generated storyboard lands on it as a card. Double-click opens the
 * full-size preview; the brand kit is set from the sidebar header.
 */
export function Board() {
  const router = useRouter();
  const [brand, setBrand] = useState<BrandRec | null>(null);
  const [brandUrl, setBrandUrl] = useState('');
  const [brandBusy, setBrandBusy] = useState(false);
  const [brandOpen, setBrandOpen] = useState(false);
  const [items, setItems] = useState<ArtifactItem[]>([]);
  const [lightbox, setLightbox] = useState<{ title: string; doc: SceneDoc; version: number } | null>(null);
  const [boardSel, setBoardSel] = useState<{ ids: string[]; screen: { x: number; y: number; width: number; height: number } | null } | null>(null);
  const [boardBusy, setBoardBusy] = useState(false);
  const [boardError, setBoardError] = useState<string | null>(null);
  const boardActionRef = useRef(0);
  // The opening tap's own mouseup lands on the just-rendered scrim as a click;
  // without this guard the lightbox would close the instant it opens.
  const openedAtRef = useRef(0);

  const loadItems = useCallback(async () => {
    const r = await fetch('/api/artifacts');
    if (r.ok) setItems(await r.json());
  }, []);

  // Ignore noise (1 px shifts from camera moves) so the floating bar doesn't re-render every frame.
  const onBoardSelection = useCallback((sel: { ids: string[]; screen: { x: number; y: number; width: number; height: number } | null }) => {
    const key = (s: typeof sel) => `${s.ids.join(',')}|${s.screen ? [s.screen.x, s.screen.y, s.screen.width, s.screen.height].map(Math.round).join(',') : 'null'}`;
    setBoardSel((prev) => (prev && key(prev) === key(sel) ? prev : sel));
  }, []);

  /** Merge the selected cards into one film, or duplicate them (a remix block you can branch from). */
  const runBoardAction = useCallback(
    async (kind: 'merge' | 'duplicate') => {
      const ids = boardSel?.ids ?? [];
      if (boardBusy || ids.length === 0) return;
      if (kind === 'merge' && ids.length < 2) return;
      boardActionRef.current += 1;
      const token = boardActionRef.current;
      setBoardError(null);
      setBoardBusy(true);
      try {
        const errorText = async (r: Response) => {
          try {
            const j = (await r.json()) as { error?: string };
            if (j?.error) return r.status === 401 ? 'Your session expired — reload the page and sign in again.' : j.error;
          } catch {
            // not JSON — fall through
          }
          return `That action failed (${r.status}).`;
        };
        if (kind === 'merge') {
          const r = await fetch('/api/artifacts', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ merge: { sourceIds: ids } }),
          });
          if (!r.ok) throw new Error(await errorText(r));
        } else {
          for (const id of ids) {
            const r = await fetch('/api/artifacts', {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({ duplicate: { id } }),
            });
            if (!r.ok) throw new Error(await errorText(r));
          }
        }
        await loadItems();
      } catch (e) {
        // Credentials/backend hiccups must not trap the UI: show a small
        // dismissable notice above the selection instead of a blocking alert.
        setBoardError(e instanceof Error ? e.message : 'That action failed.');
      } finally {
        if (boardActionRef.current === token) setBoardBusy(false);
      }
    },
    [boardBusy, boardSel, loadItems],
  );

  useEffect(() => {
    void loadItems();
  }, [loadItems]);

  // Hydrate the latest brand kit, so the board keeps its brand (and title)
  // across reloads instead of falling back to the default brand.
  useEffect(() => {
    fetch('/api/brand')
      .then((r) => (r.ok ? r.json() : null))
      .then((b: BrandRec | null) => {
        if (b) setBrand(b);
      })
      .catch(() => setBrand(null));
  }, []);

  const [brandError, setBrandError] = useState<string | null>(null);

  async function setBrandFromUrl() {
    setBrandBusy(true);
    setBrandError(null);
    try {
      const r = await fetch('/api/brand', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ url: brandUrl }),
      });
      if (!r.ok) {
        let msg = `Could not read that brand URL (${r.status}).`;
        try {
          const j = (await r.json()) as { error?: string };
          if (j?.error) msg = j.error;
        } catch {
          // plain text — keep the generic message
        }
        throw new Error(msg);
      }
      setBrand(await r.json());
      setBrandOpen(false);
    } catch (e) {
      setBrandError(e instanceof Error ? e.message : 'Could not read that brand URL.');
    } finally {
      setBrandBusy(false);
    }
  }

  const openLightbox = useCallback(
    (artifactId: string) => {
      const it = items.find((i) => i.id === artifactId);
      if (it?.doc) {
        openedAtRef.current = Date.now();
        setLightbox({ title: it.title, doc: it.doc, version: it.currentVersion });
      }
    },
    [items],
  );

  /** Scrim click closes — but not the click that opened it (the opening tap's mouseup). */
  const onScrimClick = useCallback(() => {
    if (Date.now() - openedAtRef.current < 300) return;
    setLightbox(null);
  }, []);

  return (
    <main className="board-stage">
      <div className="board-canvas">
        <TldrawBoard
          items={items}
          brand={brand}
          openArtifact={(id) => router.push(`/app/${id}`)}
          openScene={(id, scene) => router.push(`/app/${id}?scene=${scene}`)}
          openLightbox={openLightbox}
          onSelectionChange={onBoardSelection}
        />
      </div>

      {boardSel && boardSel.ids.length > 0 && boardSel.screen && (
        <div
          className="board-selection-bar"
          style={{ left: Math.max(12, Math.min(boardSel.screen.x + boardSel.screen.width / 2 - 160, window.innerWidth - 330)), top: Math.max(12, boardSel.screen.y - 54) }}
          role="toolbar"
          aria-label="Selection actions"
        >
          <div className="board-selection-actions">
            {boardSel.ids.length >= 2 && (
              <button type="button" className="btn btn-primary" disabled={boardBusy} onClick={() => void runBoardAction('merge')}>
                {boardBusy ? 'Merging…' : `Merge ${boardSel.ids.length} cards → one film`}
              </button>
            )}
            <button type="button" className="btn" disabled={boardBusy} onClick={() => void runBoardAction('duplicate')}>
              {boardBusy ? '…' : 'Duplicate'}
            </button>
          </div>
          {boardError && (
            <button type="button" className="board-selection-error" role="alert" onClick={() => setBoardError(null)} title="Dismiss">
              {boardError}
            </button>
          )}
        </div>
      )}

      <AgentSidebar
        className="board-agent"
        mode="generate"
        brand={brand}
        onVersionsSaved={loadItems}
        title={brand ? `${brand.name} board` : 'Untitled board'}
      />

      {/* Brand kit strip folded into the sidebar header via the floating pill below the chat. */}
      <div className="board-brand">
        {brand ? (
          <button type="button" className="brand-pill" onClick={() => setBrandOpen((v) => !v)} aria-expanded={brandOpen}>
            <span className="swatch" style={{ background: brand.colors.primary }} />
            <span className="swatch" style={{ background: brand.colors.secondary }} />
            {brand.name}
          </button>
        ) : (
          <button type="button" className="brand-pill" onClick={() => setBrandOpen((v) => !v)} aria-expanded={brandOpen}>
            Set brand kit
          </button>
        )}
        {brandOpen && (
          <div className="brand-pop" role="form" aria-label="Brand kit">
            <input
              type="url"
              placeholder="https://yourbrand.com"
              value={brandUrl}
              onChange={(e) => setBrandUrl(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && brandUrl && setBrandFromUrl()}
              aria-label="Brand URL"
            />
            <button type="button" className="btn btn-primary" disabled={!brandUrl || brandBusy} onClick={setBrandFromUrl}>
              {brandBusy ? 'Reading…' : brand ? 'Replace' : 'Read brand'}
            </button>
            <p className="muted" style={{ margin: 0, fontSize: 12 }}>
              Phantasma reads colors, type, and logo from the site.
            </p>
            {brandError && (
              <p role="alert" className="error-text" style={{ margin: 0, fontSize: 12 }}>
                {brandError}
              </p>
            )}
          </div>
        )}
      </div>

      {lightbox && (
        <div className="lightbox" role="dialog" aria-label={`${lightbox.title} preview`} onClick={onScrimClick}>
          <div className="lightbox-pill" onClick={(e) => e.stopPropagation()}>
            <span className="lightbox-kind">{cardMeta(lightbox.doc, lightbox.title).label}</span>
            <strong className="truncate">{lightbox.title}</strong>
            <span className="chip">v{lightbox.version}</span>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                setLightbox(null);
                router.push(`/app/${lightbox.doc.id}`);
              }}
            >
              Open editor
            </button>
            <button type="button" className="lightbox-close" aria-label="Close preview" onClick={() => setLightbox(null)}>
              ✕
            </button>
          </div>
          <div className="lightbox-body" onClick={(e) => e.stopPropagation()}>
            <PlayerPreview doc={lightbox.doc} aspect="9:16" width={Math.min(460, Math.max(280, window.innerWidth * 0.32))} />
          </div>
          <p className="lightbox-caption">
            {brand?.name ?? 'Phantasma'} · 9:16 · {lightbox.doc.scenes.length} scene{lightbox.doc.scenes.length === 1 ? '' : 's'}
          </p>
        </div>
      )}
    </main>
  );
}
