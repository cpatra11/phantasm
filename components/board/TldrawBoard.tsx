'use client';

import { useEffect, useMemo } from 'react';
import { Tldraw, useEditor, useValue, type TLShapePartial } from 'tldraw';
import 'tldraw/tldraw.css';
import {
  BRAND_CARD_TYPE,
  BrandCardShape,
  BrandCardShapeUtil,
  brandJsonOf,
  BoardDataContext,
  SCENE_CARD_TYPE,
  SceneCardShape,
  SceneCardShapeUtil,
  STORYBOARD_TYPE,
  StoryboardShapeUtil,
  StoryboardShape,
} from './shapes';
import type { BrandRec, ArtifactItem } from '../Board';

const GRID_X = 120;
const ROW_Y = 340;
const ROW_H = 560;
const CARD_W = 220;
const SCENE_X = GRID_X + CARD_W + 36;
const SCENE_W = 160;
const SCENE_GAP = 20;

/** Selection state the board overlay renders: ids of selected storyboard cards + their screen bounds. */
export type BoardSelection = { ids: string[]; screen: { x: number; y: number; width: number; height: number } | null };

/** Sends the current storyboard-card selection (and bounds) up so the board can render an action bar. */
function SelectionBridge({ onSelectionChange }: { onSelectionChange?: (sel: BoardSelection) => void }) {
  const editor = useEditor();
  const sel = useValue(
    'board-selection',
    () => {
      const ids = editor.getSelectedShapeIds();
      const cardIds: string[] = [];
      for (const id of ids) {
        const s = editor.getShape(id);
        if (s?.type === STORYBOARD_TYPE) {
          const artifactId = (s as StoryboardShape).props.artifactId;
          if (artifactId) cardIds.push(artifactId);
        }
      }
      const b = editor.getSelectionScreenBounds();
      return { ids: cardIds, screen: b ? { x: b.x, y: b.y, width: b.width, height: b.height } : null };
    },
    [editor],
  );
  useEffect(() => {
    onSelectionChange?.(sel);
  }, [sel, onSelectionChange]);
  return null;
}

/**
 * Keeps the shapes in step with the artifact list and the brand kit.
 * Layout is Hera-style: one row per variant — the variant card first, then
 * one picture card per scene. Positions live in the tldraw store (persisted
 * locally) so dragged cards stay put; new cards land at their row slot.
 */
function BoardSyncer({ items, brand }: { items: ArtifactItem[]; brand: BrandRec | null }) {
  const editor = useEditor();
  useEffect(() => {
    const all = editor.getCurrentPageShapes();

    const brandShapes = all.filter((s): s is BrandCardShape => s.type === BRAND_CARD_TYPE);
    const brandJson = brandJsonOf(brand);
    if (brandShapes.length === 0) {
      if (brand) editor.createShape({ type: BRAND_CARD_TYPE, x: GRID_X, y: 60, props: { brandJson } });
    } else {
      const keep = brandShapes[0];
      if (brandShapes.length > 1) editor.deleteShapes(brandShapes.slice(1).map((s) => s.id));
      // An empty json means "no brand this session": keep the persisted kit on the card.
      if (brand && keep.props.brandJson !== brandJson) {
        editor.updateShapes([{ id: keep.id, type: BRAND_CARD_TYPE, props: { brandJson } }]);
      }
    }

    const storyShapes = all.filter((s): s is StoryboardShape => s.type === STORYBOARD_TYPE);
    const byArtifact = new Map(storyShapes.map((s) => [s.props.artifactId, s]));
    const sceneShapes = all.filter((s): s is SceneCardShape => s.type === SCENE_CARD_TYPE);
    const byScene = new Map(sceneShapes.map((s) => [`${s.props.artifactId}:${s.props.sceneIndex}`, s]));

    // Drop cards for artifacts that no longer exist, and scene cards past the
    // end of a doc that shrank.
    const alive = new Set(items.map((it) => it.id));
    const staleStory = storyShapes.filter((s) => !alive.has(s.props.artifactId));
    if (staleStory.length > 0) editor.deleteShapes(staleStory.map((s) => s.id));
    const sceneCount = new Map(items.map((it) => [it.id, it.doc?.scenes.length ?? 0]));
    const staleScenes = sceneShapes.filter((s) => !alive.has(s.props.artifactId) || s.props.sceneIndex >= (sceneCount.get(s.props.artifactId) ?? 0));
    if (staleScenes.length > 0) editor.deleteShapes(staleScenes.map((s) => s.id));

    // Create missing variant cards, one row per artifact, in list order.
    let created = false;
    const missing = items.filter((it) => !byArtifact.has(it.id));
    if (missing.length > 0) {
      created = true;
      editor.createShapes(
        missing.map((it) => {
          const row = items.findIndex((x) => x.id === it.id);
          return {
            type: STORYBOARD_TYPE,
            x: GRID_X,
            y: ROW_Y + row * ROW_H,
            props: { artifactId: it.id, title: it.title, version: it.currentVersion },
          };
        }),
      );
    }
    const updates: TLShapePartial<StoryboardShape>[] = [];
    for (const it of items) {
      const s = byArtifact.get(it.id);
      if (s && (s.props.title !== it.title || s.props.version !== it.currentVersion)) {
        updates.push({ id: s.id, type: STORYBOARD_TYPE, props: { title: it.title, version: it.currentVersion } });
      }
    }
    if (updates.length > 0) editor.updateShapes(updates);

    // Create missing scene pictures next to their variant card.
    const missingScenes: Array<{ artifactId: string; sceneIndex: number; row: number }> = [];
    items.forEach((it, row) => {
      const n = it.doc?.scenes.length ?? 0;
      for (let i = 0; i < n; i++) {
        if (!byScene.has(`${it.id}:${i}`)) missingScenes.push({ artifactId: it.id, sceneIndex: i, row });
      }
    });
    if (missingScenes.length > 0) {
      created = true;
      editor.createShapes(
        missingScenes.map((m) => ({
          type: SCENE_CARD_TYPE,
          x: SCENE_X + m.sceneIndex * (SCENE_W + SCENE_GAP),
          y: ROW_Y + m.row * ROW_H,
          props: { artifactId: m.artifactId, sceneIndex: m.sceneIndex },
        })),
      );
    }

    // New cards land where the camera may not look: bring all content into view.
    if (created) {
      editor.zoomToFit({ animation: { duration: 300 } });
    }
  }, [editor, items, brand]);
  return null;
}

/**
 * The infinite board: brand card, then one row per variant with a picture
 * per scene. The prompt bar and agent progress are DOM overlays by Board.
 */
export function TldrawBoard({
  items,
  brand,
  openArtifact,
  openScene,
  openLightbox,
  onSelectionChange,
}: {
  items: ArtifactItem[];
  brand: BrandRec | null;
  openArtifact: (artifactId: string) => void;
  openScene: (artifactId: string, sceneIndex: number) => void;
  openLightbox: (artifactId: string) => void;
  onSelectionChange?: (sel: BoardSelection) => void;
}) {
  const data = useMemo(
    () => ({
      brand,
      docs: Object.fromEntries(items.map((it) => [it.id, it.doc])) as Record<string, ArtifactItem['doc']>,
      openArtifact,
      openScene,
      openLightbox,
    }),
    [items, brand, openArtifact, openScene, openLightbox],
  );
  return (
    <BoardDataContext.Provider value={data}>
      {/* The board's chrome is ours (agent chat, brand pill); hide tldraw's own panels. */}
      <Tldraw
        shapeUtils={[BrandCardShapeUtil, StoryboardShapeUtil, SceneCardShapeUtil]}
        persistenceKey="basix-board-v2"
        components={{
          StylePanel: null,
          MainMenu: null,
          PageMenu: null,
          NavigationPanel: null,
          DebugPanel: null,
          DebugMenu: null,
          HelpMenu: null,
          Toolbar: null,
          SharePanel: null,
          MenuPanel: null,
          QuickActions: null,
          ContextMenu: null,
        }}
      >
        <BoardSyncer items={items} brand={brand} />
        <SelectionBridge onSelectionChange={onSelectionChange} />
      </Tldraw>
    </BoardDataContext.Provider>
  );
}
