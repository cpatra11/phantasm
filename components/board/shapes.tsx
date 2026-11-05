'use client';

import { createContext, useContext, useRef } from 'react';
import { HTMLContainer, Rectangle2d, ShapeUtil, T, TLShape } from 'tldraw';
import { PlayerPreview } from '../PlayerPreview';
import type { BrandKit } from '../../lib/brand/types';
import { cardMeta, type SceneDoc } from '../../lib/scenedoc';

/** Data the shapes render, kept out of shape props: the store only persists ids and layout. */
export type BoardData = {
  brand: BrandKit | null;
  docs: Record<string, SceneDoc | null | undefined>;
  openArtifact: (artifactId: string) => void;
  openScene: (artifactId: string, sceneIndex: number) => void;
  openLightbox: (artifactId: string) => void;
};

export const BoardDataContext = createContext<BoardData>({ brand: null, docs: {}, openArtifact: () => {}, openScene: () => {}, openLightbox: () => {} });

export function useBoardData(): BoardData {
  return useContext(BoardDataContext);
}

/* ---------------- Brand card ---------------- */

export const BRAND_CARD_TYPE = 'brand-card';

declare module 'tldraw' {
  export interface TLGlobalShapePropsMap {
    [BRAND_CARD_TYPE]: { w: number; h: number; brandJson: string }
    [STORYBOARD_TYPE]: { w: number; h: number; artifactId: string; title: string; version: number }
    [SCENE_CARD_TYPE]: { w: number; h: number; artifactId: string; sceneIndex: number }
  }
}

export type BrandCardShape = TLShape<typeof BRAND_CARD_TYPE>;

/** The kit rides in the shape props so the card survives reloads (tldraw store persists). */
export type BrandShapeData = Pick<BrandKit, 'name' | 'colors' | 'fonts' | 'source' | 'sourceUrl' | 'logoUrl' | 'tagline'> & {
  images?: Array<{ url: string; label: string; kind: string; cutoutUrl?: string }>;
};

export function brandJsonOf(brand: BrandKit | null): string {
  if (!brand) return '';
  const data: BrandShapeData = {
    name: brand.name,
    colors: brand.colors,
    fonts: brand.fonts,
    source: brand.source,
    sourceUrl: brand.sourceUrl,
    ...(brand.logoUrl ? { logoUrl: brand.logoUrl } : {}),
    ...(brand.tagline ? { tagline: brand.tagline } : {}),
    ...(brand.images?.length
      ? { images: brand.images.slice(0, 6).map((i) => ({ url: i.url, label: i.label, kind: i.kind, ...(i.cutoutUrl ? { cutoutUrl: i.cutoutUrl } : {}) })) }
      : {}),
  };
  return JSON.stringify(data);
}

export class BrandCardShapeUtil extends ShapeUtil<BrandCardShape> {
  static override type = BRAND_CARD_TYPE;
  static override props = { w: T.number, h: T.number, brandJson: T.string.optional() };

  getDefaultProps(): BrandCardShape['props'] {
    return { w: 360, h: 300, brandJson: '' };
  }

  getGeometry(shape: BrandCardShape) {
    return new Rectangle2d({ width: shape.props.w, height: shape.props.h, isFilled: true });
  }

  getIndicatorPath(shape: BrandCardShape) {
    const path = new Path2D();
    path.rect(0, 0, shape.props.w, shape.props.h);
    return path;
  }

  component(shape: BrandCardShape) {
    let brand: BrandShapeData | null = null;
    try {
      brand = shape.props.brandJson ? (JSON.parse(shape.props.brandJson) as BrandShapeData) : null;
    } catch {
      brand = null;
    }
    return (
      <HTMLContainer style={{ pointerEvents: 'all' }}>
        <div className="panel board-card brand-card" style={{ width: shape.props.w, height: shape.props.h, overflow: 'hidden' }}>
          <div className="label">01 Brand</div>
          {brand ? (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '4px 0 8px' }}>
                {brand.logoUrl ? (
                  <img src={brand.logoUrl} alt="" style={{ height: 34, maxWidth: 150, objectFit: 'contain' }} />
                ) : (
                  <h3 style={{ margin: 0 }}>{brand.name}</h3>
                )}
                <span className="chip">{brand.source === 'firecrawl' ? 'from your site' : 'default kit'}</span>
              </div>
              <div style={{ display: 'flex', gap: 6 }} aria-label="Brand colors">
                {[brand.colors.primary, brand.colors.secondary, brand.colors.background, brand.colors.text].map((c, i) => (
                  <span key={`${c}-${i}`} title={c} style={{ width: 28, height: 28, background: c, border: '1px solid var(--ink)' }} />
                ))}
              </div>
              <p className="muted" style={{ margin: '8px 0 6px' }}>
                <strong>{brand.fonts.heading}</strong> headlines · {brand.fonts.body} copy
              </p>
              {brand.images?.length ? (
                <div className="brand-strip" aria-label="Brand images">
                  {brand.images.slice(0, 4).map((img) => (
                    <img key={img.url} src={img.cutoutUrl ?? img.url} alt={img.label} title={img.label} />
                  ))}
                </div>
              ) : (
                <p className="muted" style={{ margin: '4px 0 0', fontSize: 12 }}>
                  Product shots and screenshots from the site land here.
                </p>
              )}
            </>
          ) : (
            <p className="muted" style={{ margin: 0 }}>
              No brand yet. Paste a URL above and the kit lands here.
            </p>
          )}
        </div>
      </HTMLContainer>
    );
  }
}

/* ---------------- Storyboard card ---------------- */

export const STORYBOARD_TYPE = 'storyboard';

export type StoryboardShape = TLShape<typeof STORYBOARD_TYPE>;

export class StoryboardShapeUtil extends ShapeUtil<StoryboardShape> {
  static override type = STORYBOARD_TYPE;
  static override props = {
    w: T.number,
    h: T.number,
    artifactId: T.string,
    title: T.string,
    version: T.number,
  };

  getDefaultProps(): StoryboardShape['props'] {
    return { w: 220, h: 470, artifactId: '', title: 'Untitled', version: 1 };
  }

  getGeometry(shape: StoryboardShape) {
    return new Rectangle2d({ width: shape.props.w, height: shape.props.h, isFilled: true });
  }

  getIndicatorPath(shape: StoryboardShape) {
    const path = new Path2D();
    path.rect(0, 0, shape.props.w, shape.props.h);
    return path;
  }

  component(shape: StoryboardShape) {
    const { docs, openArtifact, openLightbox } = useBoardData();
    const doc = docs[shape.props.artifactId];

    // tldraw captures the pointer to its canvas on pointerdown, so this DOM
    // never receives the matching pointerup (it retargets to the canvas).
    // Detect a double-press from two successive pointerdowns instead.
    const lastPress = useRef<{ x: number; y: number; t: number } | null>(null);
    const onCardPointerDown = (e: React.PointerEvent) => {
      if (e.button !== 0) return;
      const prev = lastPress.current;
      lastPress.current = { x: e.clientX, y: e.clientY, t: Date.now() };
      if (!prev) return;
      const dx = Math.abs(e.clientX - prev.x);
      const dy = Math.abs(e.clientY - prev.y);
      if (dx <= 24 && dy <= 24 && Date.now() - prev.t <= 350) {
        lastPress.current = null;
        openLightbox(shape.props.artifactId);
      }
    };

    return (
      <HTMLContainer style={{ pointerEvents: 'all' }}>
        <div
          className="story-card board-card"
          style={{ width: shape.props.w, height: shape.props.h, cursor: 'default' }}
          aria-label={`${shape.props.title}, version ${shape.props.version}`}
          onPointerDown={onCardPointerDown}
        >
          {doc ? (
            <PlayerPreview doc={doc} aspect="9:16" width={shape.props.w - 24} mode="thumb" />
          ) : (
            <div className="preview-frame" style={{ width: shape.props.w - 24, height: shape.props.w * 1.6 }} />
          )}
          <div className="meta">
            <span style={{ fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{shape.props.title}</span>
            <span className="chip">v{shape.props.version}</span>
          </div>
          {doc && <div className="card-sub">{cardMeta(doc, shape.props.title).label}</div>}
          <OpenEditorButton artifactId={shape.props.artifactId} onOpen={() => openArtifact(shape.props.artifactId)} />
        </div>
      </HTMLContainer>
    );
  }
}

/* ---------------- Scene card: one picture per scene, Hera-style ---------------- */

export const SCENE_CARD_TYPE = 'scene-card';

export type SceneCardShape = TLShape<typeof SCENE_CARD_TYPE>;

export class SceneCardShapeUtil extends ShapeUtil<SceneCardShape> {
  static override type = SCENE_CARD_TYPE;
  static override props = {
    w: T.number,
    h: T.number,
    artifactId: T.string,
    sceneIndex: T.number,
  };

  getDefaultProps(): SceneCardShape['props'] {
    return { w: 160, h: 330, artifactId: '', sceneIndex: 0 };
  }

  getGeometry(shape: SceneCardShape) {
    return new Rectangle2d({ width: shape.props.w, height: shape.props.h, isFilled: true });
  }

  getIndicatorPath(shape: SceneCardShape) {
    const path = new Path2D();
    path.rect(0, 0, shape.props.w, shape.props.h);
    return path;
  }

  component(shape: SceneCardShape) {
    const { docs, openScene, openLightbox } = useBoardData();
    const doc = docs[shape.props.artifactId];
    const scene = doc?.scenes[shape.props.sceneIndex];
    const sceneDoc: SceneDoc | null = doc && scene ? { ...doc, scenes: [scene] } : null;
    const headline = scene?.layers.find((l) => l.text)?.text;

    const lastPress = useRef<{ x: number; y: number; t: number } | null>(null);
    const onCardPointerDown = (e: React.PointerEvent) => {
      if (e.button !== 0) return;
      const prev = lastPress.current;
      lastPress.current = { x: e.clientX, y: e.clientY, t: Date.now() };
      if (!prev) return;
      if (Math.abs(e.clientX - prev.x) <= 24 && Math.abs(e.clientY - prev.y) <= 24 && Date.now() - prev.t <= 350) {
        lastPress.current = null;
        openLightbox(shape.props.artifactId);
      }
    };

    return (
      <HTMLContainer style={{ pointerEvents: 'all' }}>
        <div
          className="story-card board-card scene-card"
          style={{ width: shape.props.w, height: shape.props.h, cursor: 'default' }}
          aria-label={`Scene ${shape.props.sceneIndex + 1} of ${doc?.title ?? 'card'}`}
          onPointerDown={onCardPointerDown}
        >
          <div className="card-sub" style={{ marginTop: 0 }}>
            Scene {shape.props.sceneIndex + 1}
            {scene ? ` · ${(scene.durationMs / 1000).toFixed(1)}s · ${scene.layers.length} layers` : ''}
          </div>
          {sceneDoc ? (
            <PlayerPreview doc={sceneDoc} aspect="9:16" width={shape.props.w - 24} mode="thumb" />
          ) : (
            <div className="preview-frame" style={{ width: shape.props.w - 24, height: shape.props.w * 1.4 }} />
          )}
          {headline && <div className="scene-headline">{headline}</div>}
          <PressButton label="Edit scene" onPress={() => openScene(shape.props.artifactId, shape.props.sceneIndex)} />
        </div>
      </HTMLContainer>
    );
  }
}

/** Press-lift button for scene cards (same tldraw pointer contract as OpenEditorButton). */
function PressButton({ label, onPress }: { label: string; onPress: () => void }) {
  const downAt = useRef<{ x: number; y: number; t: number } | null>(null);
  return (
    <button
      type="button"
      className="btn board-open-btn"
      onPointerDown={(e) => {
        e.stopPropagation();
        downAt.current = e.button === 0 ? { x: e.clientX, y: e.clientY, t: Date.now() } : null;
      }}
      onPointerUp={(e) => {
        e.stopPropagation();
        const start = downAt.current;
        downAt.current = null;
        if (!start || e.button !== 0) return;
        if (Math.abs(e.clientX - start.x) > 6 || Math.abs(e.clientY - start.y) > 6 || Date.now() - start.t > 600) return;
        onPress();
      }}
      onDoubleClick={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      {label}
    </button>
  );
}

/**
 * The "Open editor" action. tldraw captures the pointer on its canvas and the
 * canvas dispatches its own events, so a synthetic DOM `click` can never be
 * trusted on DOM inside a shape (it fires on the canvas, not the button).
 * Navigate on pointerup instead: a clean press-lift in place opens the editor,
 * a drag or pan does not. Stopping propagation on both events keeps tldraw
 * from treating the press as a selection or camera move.
 */
function OpenEditorButton({ artifactId, onOpen }: { artifactId: string; onOpen: () => void }) {
  const downAt = useRef<{ x: number; y: number; t: number } | null>(null);
  const DRAG_PX = 6;
  const DRAG_MS = 600;

  return (
    <button
      type="button"
      className="btn btn-primary board-open-btn"
      onPointerDown={(e) => {
        e.stopPropagation();
        downAt.current = e.button === 0 ? { x: e.clientX, y: e.clientY, t: Date.now() } : null;
      }}
      onPointerUp={(e) => {
        e.stopPropagation();
        const start = downAt.current;
        downAt.current = null;
        if (!start || e.button !== 0) return;
        // Only a clean press-lift in place opens; drags and pans keep their tldraw meaning.
        const dx = Math.abs(e.clientX - start.x);
        const dy = Math.abs(e.clientY - start.y);
        if (dx > DRAG_PX || dy > DRAG_PX || Date.now() - start.t > DRAG_MS) return;
        try {
          onOpen();
        } catch (err) {
          console.error(`Could not open the editor for ${artifactId}`, err);
        }
      }}
      onDoubleClick={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      Open editor
    </button>
  );
}
