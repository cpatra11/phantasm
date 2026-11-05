'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AgentSidebar } from './AgentSidebar';
import { EditablePreview } from './EditablePreview';
import { PlayerPreview } from './PlayerPreview';
import { ASPECT_LIST, allLayers, applyPatch, type Aspect, type Layer, type SceneDoc } from '../lib/scenedoc';
import type { BrandKit } from '../lib/brand/types';

type Detail = {
  artifact: { id: string; title: string; currentVersion: number };
  versions: { version: number; message: string; createdAt: string }[];
  doc: SceneDoc;
};

type RenderRec = {
  id: string;
  kind: 'video' | 'still';
  aspect: Aspect;
  status: 'rendering' | 'done' | 'failed';
  url: string | null;
  error: string | null;
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** API errors arrive as JSON ({ error }) or plain text; show the readable part. */
async function errorText(r: Response): Promise<string> {
  const raw = await r.text();
  try {
    const j = JSON.parse(raw) as { error?: string };
    if (j?.error) return j.error;
  } catch {
    // plain text — use as-is
  }
  return raw || `Export failed (${r.status}).`;
}

/** Editor for one storyboard: editable preview, layers, inspector, agent refine panel, versions, export. */
export function Editor({ id, initialScene }: { id: string; initialScene?: number }) {
  const router = useRouter();
  const [detail, setDetail] = useState<Detail | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [aspect, setAspect] = useState<Aspect>('9:16');
  const [selected, setSelected] = useState<string[]>([]);
  const [patchError, setPatchError] = useState<string | null>(null);
  const [render, setRender] = useState<RenderRec | null>(null);
  const [brand, setBrand] = useState<BrandKit | null>(null);
  const [sceneIdx, setSceneIdx] = useState(initialScene ?? 0);
  // Multi-scene docs open on the full film so every scene is accounted for;
  // picking a scene (tab, filmstrip, layer, or a board scene card) switches
  // to per-scene editing.
  const [previewMode, setPreviewMode] = useState<'film' | 'scene'>(initialScene != null ? 'scene' : 'film');
  const [editingId, setEditingId] = useState<string | null>(null);

  const loadDetail = useCallback(async () => {
    const r = await fetch(`/api/artifacts?id=${encodeURIComponent(id)}`);
    if (!r.ok) {
      setLoadError(await r.text());
      return;
    }
    setDetail(await r.json());
  }, [id]);

  useEffect(() => {
    void loadDetail();
  }, [loadDetail]);

  useEffect(() => {
    fetch('/api/brand')
      .then((r) => (r.ok ? r.json() : null))
      .then(setBrand)
      .catch(() => setBrand(null));
  }, []);

  const layers = useMemo(() => (detail ? allLayers(detail.doc) : []), [detail]);
  const selectedLayers = layers.filter((l) => selected.includes(l.id));
  const singleLayer = selectedLayers.length === 1 ? selectedLayers[0] : null;

  /**
   * One patch = one version. The new document is validated with the same
   * zod/patch pipeline the server uses and applied to local state FIRST, so
   * the preview and layers update instantly; the server round-trip then only
   * confirms the version. On any failure we roll back to the previous state.
   */
  const patchOps = useCallback(
    async (ops: Parameters<typeof applyPatch>[1], msg = 'Manual edit'): Promise<{ version: number; doc: SceneDoc } | null> => {
      setPatchError(null);
      if (!detail) return null;
      let nextDoc: SceneDoc;
      try {
        nextDoc = applyPatch(detail.doc, ops);
      } catch (e) {
        setPatchError(e instanceof Error ? e.message : 'That edit is not allowed.');
        return null;
      }
      const previous = detail;
      const optimisticVersion = detail.artifact.currentVersion + 1;
      setDetail({
        ...detail,
        doc: nextDoc,
        artifact: { ...detail.artifact, currentVersion: optimisticVersion },
        versions: [{ version: optimisticVersion, message: msg, createdAt: new Date().toISOString() }, ...detail.versions],
      });
      const r = await fetch('/api/artifacts', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id, ops }),
      });
      if (!r.ok) {
        setDetail(previous);
        setPatchError(await errorText(r));
        return null;
      }
      const data = (await r.json()) as { version: number; doc: SceneDoc };
      setDetail((d) => (d ? { ...d, artifact: { ...d.artifact, currentVersion: data.version } } : d));
      return data;
    },
    [detail, id],
  );

  async function patchLayer(layerId: string, path: string, value: string | number | boolean) {
    await patchOps([{ op: 'set', layerId, path, value }]);
  }

  async function addTextLayer() {
    if (!detail) return;
    setPatchError(null);
    const scene = detail.doc.scenes[Math.min(sceneIdx, detail.doc.scenes.length - 1)];
    const newId = `text-${Date.now().toString(36)}`;
    const fontFamily = brand?.fonts.heading ?? 'DM Serif Display';
    const ok = await patchOps([
      {
        op: 'upsert_layer',
        sceneId: scene.id,
        layer: {
          id: newId,
          kind: 'text',
          name: 'Headline',
          transform: { x: 90, y: 760, w: 900, h: 260, rotation: 0 },
          style: { fontFamily, fontSize: 120, fontWeight: 800, color: brand?.colors.text ?? '#171817', textAlign: 'left' },
          text: 'New headline',
          segment: false,
          motion: { preset: 'none', delayMs: 0, durationMs: 600 },
          locked: false,
        },
      },
    ]);
    if (ok) setSelected([newId]);
  }

  async function removeLayer(layerId: string) {
    const ok = await patchOps([{ op: 'remove_layer', layerId }]);
    if (ok) setSelected((prev) => prev.filter((x) => x !== layerId));
  }

  const commitTransform = useCallback(
    async (layerId: string, t: { x: number; y: number; w: number; h: number }) => {
      await patchOps((['x', 'y', 'w', 'h'] as const).map((k) => ({ op: 'set' as const, layerId, path: `transform.${k}`, value: Math.round(t[k]) })));
    },
    [patchOps],
  );

  async function revert(version: number) {
    setPatchError(null);
    const r = await fetch('/api/artifacts', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id, revertTo: version }),
    });
    if (!r.ok) {
      setPatchError(await errorText(r));
      return;
    }
    // The reverted document rides back with the response: swap it in with
    // no refetch, and note the new version on top of the list.
    const data = (await r.json()) as { version: number; doc: SceneDoc };
    setDetail((d) =>
      d
        ? {
            ...d,
            doc: data.doc,
            artifact: { ...d.artifact, currentVersion: data.version },
            versions: [{ version: data.version, message: `Reverted to v${version}`, createdAt: new Date().toISOString() }, ...d.versions],
          }
        : d,
    );
  }

  const [exporting, setExporting] = useState<'video' | 'still' | null>(null);
  const [exportElapsed, setExportElapsed] = useState(0);

  useEffect(() => {
    if (!exporting) return;
    setExportElapsed(0);
    const t = setInterval(() => setExportElapsed((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [exporting]);

  async function exportAs(kind: 'video' | 'still') {
    if (exporting) return;
    setPatchError(null);
    setRender(null);
    setExporting(kind);
    try {
      const r = await fetch('/api/render', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ artifactId: id, aspect, kind }),
      });
      if (!r.ok) throw new Error(await errorText(r));
      let rec = (await r.json()) as RenderRec;
      setRender(rec);
      // Lambda renders take seconds to minutes: poll patiently, riding out
      // transient status-check failures instead of dying silently.
      for (let i = 0; i < 200 && rec.status === 'rendering'; i++) {
        await sleep(3000);
        try {
          const s = await fetch(`/api/render?id=${encodeURIComponent(rec.id)}`);
          if (!s.ok) continue;
          rec = (await s.json()) as RenderRec;
          setRender(rec);
        } catch {
          // Status check hiccup — the render itself is unaffected; keep polling.
        }
      }
      if (rec.status === 'failed') setPatchError(rec.error ?? 'The export failed on the render service.');
      else if (rec.status === 'rendering') setPatchError('The export is taking longer than usual. It may still finish — try exporting again in a moment.');
    } catch (e) {
      setPatchError(e instanceof Error ? e.message : 'The export could not be started.');
    } finally {
      setExporting(null);
    }
  }

  if (loadError && !detail) {
    return (
      <main className="field">
        <p role="alert" className="error-text span-12">
          {loadError}
        </p>
      </main>
    );
  }
  if (!detail) {
    return (
      <main className="field">
        <p className="muted span-12">Loading storyboard…</p>
      </main>
    );
  }

  const previewWidth = aspect === '9:16' ? 340 : 460;
  const scenes = detail.doc.scenes;
  const activeScene = scenes[Math.min(sceneIdx, scenes.length - 1)];
  // Editing happens one scene at a time (like a comp in a video editor); the
  // full film still plays in the board lightbox and in exports.
  const previewDoc: SceneDoc = scenes.length > 1 ? { ...detail.doc, scenes: [activeScene] } : detail.doc;

  return (
    <main className="editor-shell">
      <section className="editor-stage">
        <div className="editor-stagehead">
          <button type="button" className="btn btn-ghost" onClick={() => router.push('/app')}>
            ← Board
          </button>
          <h2 style={{ margin: 0, flex: 1, minWidth: 0 }} className="truncate">
            {detail.artifact.title} <span className="chip">v{detail.artifact.currentVersion}</span>
          </h2>
          <div role="radiogroup" aria-label="Aspect ratio" style={{ display: 'flex', gap: 6 }}>
            {ASPECT_LIST.map((a) => (
              <button
                key={a}
                type="button"
                role="radio"
                aria-checked={aspect === a}
                className="chip"
                data-active={aspect === a}
                onClick={() => setAspect(a)}
              >
                {a}
              </button>
            ))}
          </div>
        </div>

        {scenes.length > 1 && (
          <>
            <div role="tablist" aria-label="Preview mode" style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <button
                type="button"
                role="tab"
                aria-selected={previewMode === 'film'}
                className="chip"
                data-active={previewMode === 'film'}
                onClick={() => setPreviewMode('film')}
              >
                ▶ Full film · {scenes.length} scenes · {(scenes.reduce((sum, s) => sum + s.durationMs, 0) / 1000).toFixed(1)}s
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={previewMode === 'scene'}
                className="chip"
                data-active={previewMode === 'scene'}
                onClick={() => setPreviewMode('scene')}
              >
                Edit scene {Math.min(sceneIdx, scenes.length - 1) + 1}
              </button>
            </div>
            <div className="scene-strip" aria-label="All scenes">
              {scenes.map((s, i) => (
                <button
                  key={s.id}
                  type="button"
                  className="scene-thumb"
                  data-active={previewMode === 'scene' && i === Math.min(sceneIdx, scenes.length - 1)}
                  onClick={() => {
                    setSceneIdx(i);
                    setPreviewMode('scene');
                  }}
                >
                  <PlayerPreview doc={{ ...detail.doc, scenes: [s] }} aspect={aspect} width={54} mode="thumb" />
                  <span>
                    Scene {i + 1} · {(s.durationMs / 1000).toFixed(1)}s
                    <span className="muted"> · {s.layers.length} layers</span>
                  </span>
                </button>
              ))}
            </div>
          </>
        )}

        {previewMode === 'film' && scenes.length > 1 ? (
          <div>
            <PlayerPreview doc={detail.doc} aspect={aspect} width={previewWidth} />
            <p className="muted" style={{ margin: '8px 0 0', fontSize: 12 }}>
              Playing all {scenes.length} scenes in order. Pick a scene above to edit its layers.
            </p>
          </div>
        ) : (
          <EditablePreview
          doc={previewDoc}
          aspect={aspect}
          width={previewWidth}
          selected={selected}
          onSelect={setSelected}
          onTransformCommit={commitTransform}
          editingId={editingId}
          onStartEdit={(layer) => {
            setSelected([layer.id]);
            setEditingId(layer.id);
          }}
          onCommitText={(layerId, text) => {
            setEditingId(null);
            void patchLayer(layerId, 'text', text);
          }}
          onCancelEdit={() => setEditingId(null)}
          />
        )}
        {previewMode === 'scene' && (
          <p className="muted" style={{ margin: 0, fontSize: 12 }}>
            Editing scene {Math.min(sceneIdx, scenes.length - 1) + 1} of {scenes.length}. Double-click any text to edit it in place. Drag to move, corner to resize.
          </p>
        )}

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button type="button" className="btn btn-primary" disabled={exporting !== null} onClick={() => exportAs('video')}>
            {exporting === 'video' ? `Exporting MP4… ${exportElapsed}s` : `Export MP4 (${aspect})`}
          </button>
          <button type="button" className="btn" disabled={exporting !== null} onClick={() => exportAs('still')}>
            {exporting === 'still' ? `Exporting PNG… ${exportElapsed}s` : 'Export PNG'}
          </button>
        </div>

        {(exporting || render) && (
          <p role="status" style={{ margin: 0 }}>
            <span className="label">Export</span>{' '}
            {exporting && !render && <span className="muted">Starting the render on Remotion Lambda… {exportElapsed}s</span>}
            {render?.status === 'rendering' && (
              <span className="muted">
                Rendering {render.kind} at {render.aspect} on Remotion Lambda… {exportElapsed}s
              </span>
            )}
            {render?.status === 'done' && (
              <a className="btn btn-primary" style={{ textDecoration: 'none' }} href={`/api/render/download?id=${encodeURIComponent(render.id)}`}>
                Download {render.kind === 'video' ? 'MP4' : 'PNG'} ({render.aspect})
              </a>
            )}
            {render?.status === 'failed' && <span className="error-text">{render.error ?? 'The export failed.'}</span>}
          </p>
        )}

        {patchError && (
          <p role="alert" className="error-text" style={{ margin: 0 }}>
            {patchError}
          </p>
        )}
      </section>

      <section className="editor-side">
        <AgentSidebar
          className="editor-agent"
          mode="refine"
          artifactId={id}
          brand={brand}
          selectedLayerIds={selected}
          layerNames={selectedLayers.map((l) => l.name || l.kind)}
          onVersionsSaved={loadDetail}
          title={detail.artifact.title}
        />

        <div className="panel editor-layers">
          <div className="label" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <span>Layers</span>
            <button type="button" className="btn btn-ghost" style={{ fontSize: 11, padding: '2px 8px' }} onClick={() => void addTextLayer()}>
              + Text
            </button>
          </div>
          <p className="muted" style={{ margin: 0, fontSize: 12 }}>
            Select to scope the agent. Click a layer in the preview to move and resize it.
          </p>
          {scenes.map((scene, si) => (
            <div key={scene.id}>
              {scenes.length > 1 && (
                <div className="label" style={{ marginTop: si ? 10 : 0 }}>
                  Scene {si + 1} · {(scene.durationMs / 1000).toFixed(1)}s
                </div>
              )}
              <ul className="editor-layerlist">
                {scene.layers.map((l) => {
                  const isSel = selected.includes(l.id);
                  const lowConf = typeof l.style.confidence === 'number' && l.style.confidence < 0.75;
                  return (
                    <li key={l.id} className="layer-row" data-selected={isSel}>
                      <label style={{ display: 'contents' }}>
                        <input
                          type="checkbox"
                          aria-label={`Select ${l.name || l.kind}`}
                          checked={isSel}
                          onChange={() => {
                            setSceneIdx(si);
                            setPreviewMode('scene');
                            setSelected((prev) => (prev.includes(l.id) ? prev.filter((x) => x !== l.id) : [...prev, l.id]));
                          }}
                        />
                        <span className="truncate">{l.name || l.kind}</span>
                        {lowConf && (
                          <span className="chip" title="The layer read was unsure about this one — worth a check">
                            check
                          </span>
                        )}
                        <span className="muted" style={{ fontSize: 12 }}>
                          {l.kind}
                        </span>
                      </label>
                      {isSel && singleLayer && (
                        <button
                          type="button"
                          className="btn btn-ghost"
                          style={{ fontSize: 11, padding: '2px 8px' }}
                          onClick={() => {
                            setSceneIdx(si);
                            setPreviewMode('scene');
                            setSelected([l.id]);
                          }}
                        >
                          Edit on canvas
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}

          {singleLayer && (
            <Inspector
              key={singleLayer.id}
              layer={singleLayer}
              brand={brand}
              onCommit={(p, v) => patchLayer(singleLayer.id, p, v)}
              onDelete={() => void removeLayer(singleLayer.id)}
            />
          )}
        </div>

        <div className="panel editor-versions">
          <div className="label">Versions</div>
          <ol className="editor-versionlist">
            {[...detail.versions].reverse().slice(0, 8).map((v) => (
              <li key={v.version} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'baseline' }}>
                <span className="truncate">
                  <strong>v{v.version}</strong> <span className="muted">{v.message}</span>
                </span>
                {v.version !== detail.artifact.currentVersion && (
                  <button type="button" className="btn btn-ghost" style={{ fontSize: 11, padding: '2px 8px' }} onClick={() => revert(v.version)}>
                    Revert
                  </button>
                )}
              </li>
            ))}
          </ol>
        </div>
      </section>
    </main>
  );
}

/** Inspector for one selected layer. Text and numbers commit on blur, so each edit is one version. */
function Inspector({
  layer,
  brand,
  onCommit,
  onDelete,
}: {
  layer: Layer;
  brand: BrandKit | null;
  onCommit: (path: string, value: string | number | boolean) => void;
  onDelete: () => void;
}) {
  const [text, setText] = useState(layer.text ?? '');
  const [color, setColor] = useState(String(layer.style.color ?? '#171817'));
  const [fontSize, setFontSize] = useState(String(layer.style.fontSize ?? 64));
  const [delayMs, setDelayMs] = useState(String(layer.motion.delayMs));
  const [durationMs, setDurationMs] = useState(String(layer.motion.durationMs));

  const showsText = layer.kind !== 'image';
  const fontOptions = Array.from(
    new Set([layer.style.fontFamily, brand?.fonts.heading, brand?.fonts.body, 'Archivo', 'DM Sans', 'DM Serif Display', 'Inter'].filter((f): f is string => typeof f === 'string' && f.length > 0)),
  );

  return (
    <div className="inspector">
      <div className="label">Inspector · {layer.name || layer.kind}</div>

      {showsText && (
        <label className="field-row">
          <span className="label">Text</span>
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onBlur={() => text !== (layer.text ?? '') && onCommit('text', text)}
          />
        </label>
      )}

      {showsText && (
        <>
          <label className="field-row">
            <span className="label">Font</span>
            <select value={String(layer.style.fontFamily ?? '')} onChange={(e) => onCommit('style.fontFamily', e.target.value)}>
              {fontOptions.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <label className="field-row">
              <span className="label">Weight</span>
              <select value={String(layer.style.fontWeight ?? 700)} onChange={(e) => onCommit('style.fontWeight', Number(e.target.value))}>
                {[400, 500, 600, 700, 800, 900].map((w) => (
                  <option key={w} value={w}>
                    {w}
                  </option>
                ))}
              </select>
            </label>
            <label className="field-row">
              <span className="label">Align</span>
              <select value={String(layer.style.textAlign ?? 'left')} onChange={(e) => onCommit('style.textAlign', e.target.value)}>
                <option value="left">Left</option>
                <option value="center">Center</option>
                <option value="right">Right</option>
              </select>
            </label>
          </div>
        </>
      )}

      <label className="field-row">
        <span className="label">Color</span>
        <input
          type="color"
          value={color}
          onChange={(e) => setColor(e.target.value)}
          onBlur={() => color !== String(layer.style.color ?? '') && onCommit('style.color', color)}
        />
      </label>

      <label className="field-row">
        <span className="label">Font size</span>
        <input
          type="number"
          min={8}
          max={400}
          value={fontSize}
          onChange={(e) => setFontSize(e.target.value)}
          onBlur={() => {
            const n = Number(fontSize);
            if (Number.isFinite(n) && n !== Number(layer.style.fontSize ?? 64)) onCommit('style.fontSize', n);
          }}
        />
      </label>

      <label className="field-row">
        <span className="label">Motion</span>
        <select
          value={layer.motion.preset}
          onChange={(e) => e.target.value !== layer.motion.preset && onCommit('motion.preset', e.target.value)}
        >
          <option value="none">None</option>
          <option value="fade-in">Fade in</option>
          <option value="slide-up">Slide up</option>
          <option value="slide-left">Slide left</option>
          <option value="pop">Pop</option>
          <option value="reveal">Reveal</option>
          <option value="float">Float</option>
          <option value="ken-burns">Ken burns</option>
          <option value="type">Typewriter</option>
          <option value="count-up">Count up</option>
        </select>
      </label>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <label className="field-row">
          <span className="label">Delay (ms)</span>
          <input
            type="number"
            min={0}
            max={4000}
            step={50}
            value={delayMs}
            onChange={(e) => setDelayMs(e.target.value)}
            onBlur={() => {
              const n = Number(delayMs);
              if (Number.isFinite(n) && n !== layer.motion.delayMs) onCommit('motion.delayMs', Math.max(0, Math.round(n)));
            }}
          />
        </label>
        <label className="field-row">
          <span className="label">Duration (ms)</span>
          <input
            type="number"
            min={100}
            max={4000}
            step={50}
            value={durationMs}
            onChange={(e) => setDurationMs(e.target.value)}
            onBlur={() => {
              const n = Number(durationMs);
              if (Number.isFinite(n) && n !== layer.motion.durationMs) onCommit('motion.durationMs', Math.max(100, Math.round(n)));
            }}
          />
        </label>
      </div>

      <label className="field-row" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <input
          type="checkbox"
          checked={layer.locked}
          onChange={(e) => onCommit('locked', e.target.checked)}
          aria-label="Lock layer"
        />
        <span className="label" style={{ margin: 0 }}>
          Lock position
        </span>
      </label>

      <button type="button" className="btn btn-ghost" style={{ fontSize: 12, justifySelf: 'start' }} onClick={onDelete}>
        Delete layer
      </button>
    </div>
  );
}
