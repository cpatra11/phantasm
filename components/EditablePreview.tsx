'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { PlayerPreview } from './PlayerPreview';
import { ASPECTS, deriveLayout, type Aspect, type Layer, type SceneDoc } from '../lib/scenedoc';

type Transform = { x: number; y: number; w: number; h: number };

/**
 * An interactive sheet over the preview: every layer gets a movable,
 * resizable box mapped 1:1 onto the rendered frame. Drags update the box live
 * and commit the authored-document transform once, on pointer up — each
 * gesture is exactly one version.
 */
const TEXT_BEARING = new Set(['text', 'callout', 'shape', 'logo']);

export function EditablePreview({
  doc,
  aspect,
  width,
  selected,
  onSelect,
  onTransformCommit,
  editingId = null,
  onStartEdit,
  onCommitText,
  onCancelEdit,
}: {
  doc: SceneDoc;
  aspect: Aspect;
  width: number;
  selected: string[];
  onSelect: (ids: string[]) => void;
  onTransformCommit: (layerId: string, t: Transform) => void;
  /** Layer currently being inline-edited (double-click), if any. */
  editingId?: string | null;
  onStartEdit?: (layer: Layer) => void;
  onCommitText?: (layerId: string, text: string) => void;
  onCancelEdit?: () => void;
}) {
  const derived = useMemo(() => deriveLayout(doc, aspect), [doc, aspect]);
  const size = ASPECTS[aspect];
  const scale = width / size.width;
  const height = (width * size.height) / size.width;

  // Live drag feedback: overrides for the layers being moved, committed on pointer up.
  const [overrides, setOverrides] = useState<Record<string, Transform>>({});
  const [dragging, setDragging] = useState<string | null>(null);
  const [hover, setHover] = useState<string | null>(null);

  const startRef = useRef<{ id: string; px: number; py: number; t: Transform; mode: 'move' | 'resize' } | null>(null);

  const layersById = useMemo(() => new Map(derived.scenes.flatMap((s) => s.layers).map((l) => [l.id, l])), [derived]);
  // All layers from every scene overlay the same frame; scene 1 is the reference view.
  const overlayLayers = useMemo(() => derived.scenes[0]?.layers ?? derived.scenes.flatMap((s) => s.layers).slice(0, 0), [derived]);

  const clamp = useCallback((t: Transform): Transform => {
    const w = Math.min(Math.max(24, t.w), size.width);
    const h = Math.min(Math.max(24, t.h), size.height);
    return {
      w,
      h,
      x: Math.min(Math.max(0, t.x), Math.max(0, size.width - w)),
      y: Math.min(Math.max(0, t.y), Math.max(0, size.height - h)),
    };
  }, [size.width, size.height]);

  const beginGesture = (e: React.PointerEvent, layer: Layer, mode: 'move' | 'resize') => {
    e.stopPropagation();
    e.preventDefault();
    if (mode === 'move' && layer.locked) {
      onSelect([layer.id]);
      return;
    }
    // A pointer can be gone by the time this runs (synthetic events, cancellations).
    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {
      // fall through: the gesture still works from client coordinates.
    }
    const t = { ...layer.transform };
    startRef.current = { id: layer.id, px: e.clientX, py: e.clientY, t, mode };
    setDragging(layer.id);
    setOverrides((o) => ({ ...o, [layer.id]: t }));
  };

  const onGestureMove = (e: React.PointerEvent) => {
    const start = startRef.current;
    if (!start) return;
    const dx = (e.clientX - start.px) / scale;
    const dy = (e.clientY - start.py) / scale;
    const base = start.t;
    const t = clamp(
      start.mode === 'move'
        ? { ...base, x: base.x + dx, y: base.y + dy }
        : { ...base, w: base.w + dx, h: base.h + dy },
    );
    setOverrides((o) => ({ ...o, [start.id]: t }));
  };

  const endGesture = (e: React.PointerEvent) => {
    const start = startRef.current;
    if (!start) return;
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      // Nothing held, or the pointer is gone — nothing to release.
    }
    const id = start.id;
    const moved = Math.abs(e.clientX - start.px) + Math.abs(e.clientY - start.py);
    startRef.current = null;
    setDragging(null);
    if (moved <= 2) {
      // A click: select (shift adds to the selection).
      onSelect(
        e.shiftKey
          ? selected.includes(id)
            ? selected.filter((s) => s !== id)
            : [...selected, id]
          : [id],
      );
      return;
    }
    // Compute the final box from the gesture start, not from stored overrides —
    // the last pointermove's state may not have rendered yet.
    const dx = (e.clientX - start.px) / scale;
    const dy = (e.clientY - start.py) / scale;
    const final = clamp(
      start.mode === 'move'
        ? { ...start.t, x: start.t.x + dx, y: start.t.y + dy }
        : { ...start.t, w: start.t.w + dx, h: start.t.h + dy },
    );
    onTransformCommit(id, final);
  };

  // Clear stale drag feedback whenever a fresh document arrives (e.g. the
  // commit PATCH round-tripped) so the rendered boxes follow the new doc.
  useEffect(() => {
    setOverrides({});
    setDragging(null);
  }, [doc]);

  return (
    <div className="editable-stage" style={{ width, height }}>
      <PlayerPreview doc={derived} aspect={aspect} width={width} />
      <div className={`editable-overlay ${dragging ? 'is-dragging' : ''}`} aria-hidden={dragging ? 'false' : undefined}>
        {overlayLayers.map((layer) => {
          const t = overrides[layer.id] ?? layer.transform;
          const isSel = selected.includes(layer.id);
          return (
            <div
              key={layer.id}
              className="editable-box"
              data-selected={isSel}
              data-dragging={dragging === layer.id}
              data-kind={layer.kind}
              style={{
                left: t.x * scale,
                top: t.y * scale,
                width: t.w * scale,
                height: t.h * scale,
                zIndex: isSel ? 5 : 1,
                pointerEvents: dragging && dragging !== layer.id ? 'none' : 'auto',
                touchAction: 'none',
              }}
              onPointerEnter={() => setHover(layer.id)}
              onPointerLeave={() => setHover((h) => (h === layer.id ? null : h))}
              onPointerDown={(e) => beginGesture(e, layer, 'move')}
              onPointerMove={onGestureMove}
              onPointerUp={endGesture}
              onPointerCancel={endGesture}
              onDoubleClick={(e) => {
                e.stopPropagation();
                if (TEXT_BEARING.has(layer.kind)) onStartEdit?.(layer);
              }}
              role="button"
              tabIndex={-1}
              aria-label={`${layer.name || layer.kind} layer`}
            >
              {editingId === layer.id ? (
                <textarea
                  className="inline-text-edit"
                  autoFocus
                  defaultValue={layer.text ?? ''}
                  aria-label={`Edit ${layer.name || layer.kind} text`}
                  style={{
                    width: '100%',
                    height: '100%',
                    fontSize: Math.max(11, (typeof layer.style.fontSize === 'number' ? layer.style.fontSize : 64) * scale),
                    fontFamily: typeof layer.style.fontFamily === 'string' ? layer.style.fontFamily : undefined,
                    fontWeight: typeof layer.style.fontWeight === 'number' ? layer.style.fontWeight : undefined,
                    color: typeof layer.style.color === 'string' ? layer.style.color : undefined,
                    textAlign: (typeof layer.style.textAlign === 'string' ? layer.style.textAlign : 'left') as React.CSSProperties['textAlign'],
                  }}
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => e.stopPropagation()}
                  onDoubleClick={(e) => e.stopPropagation()}
                  onBlur={(e) => {
                    const next = e.target.value;
                    if (next !== (layer.text ?? '')) onCommitText?.(layer.id, next);
                    else onCancelEdit?.();
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      (e.target as HTMLTextAreaElement).blur();
                    }
                    if (e.key === 'Escape') {
                      e.preventDefault();
                      (e.target as HTMLTextAreaElement).value = layer.text ?? '';
                      onCancelEdit?.();
                    }
                  }}
                />
              ) : (
                (isSel || hover === layer.id) && <span className="editable-tag">{layer.name || layer.kind}</span>
              )}
              {isSel && !layer.locked && (
                <span
                  className="editable-handle"
                  role="button"
                  aria-label={`Resize ${layer.name || layer.kind}`}
                  onPointerDown={(e) => beginGesture(e, layer, 'resize')}
                  onPointerMove={onGestureMove}
                  onPointerUp={endGesture}
                  onPointerCancel={endGesture}
                  style={{ touchAction: 'none' }}
                />
              )}
            </div>
          );
        })}
      </div>
      <p className="editable-hint" data-visible={layersById.size > 0 && !dragging ? 'true' : 'false'} aria-hidden={dragging ? 'true' : 'false'}>
        {dragging ? 'Release to commit' : 'Drag to move · corner to resize · click to select'}
      </p>
    </div>
  );
}
