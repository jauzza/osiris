'use client';

import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, LayoutGrid, MapPin, RefreshCw, Maximize2, Minimize2, ChevronLeft, Crosshair } from 'lucide-react';
import {
  freshen,
  previewMedia,
  refreshInterval,
  VIDEO_KINDS,
  type PreviewKind,
} from '@/lib/camera-preview';
import { cityCanPanCam, pickAlhaurinGrid, pickPuertaBlancaGrid, type GridCamera } from '@/lib/cctv-priority';

const FEED_FIT = 'h-full w-full object-cover bg-black';

const REFRESH_OPTIONS = [
  { label: '1s', ms: 1000 },
  { label: '2s', ms: 2000 },
  { label: '5s', ms: 5000 },
] as const;

const SLOT_COUNT = 4;

interface CctvGridWallProps {
  open: boolean;
  cameras: GridCamera[];
  slotIds: string[];
  onSlotIdsChange: (ids: string[]) => void;
  refreshMs: number;
  onRefreshMsChange: (ms: number) => void;
  onClose: () => void;
  onLocate?: (lat: number, lng: number) => void;
  pendingAdd?: GridCamera | null;
  onPendingAddHandled?: () => void;
  pickMode?: boolean;
  pickCount?: number;
  onPickModeChange?: (on: boolean) => void;
}

interface SlotCamera extends GridCamera {
  media: { kind: PreviewKind; url: string };
}

function GridImage({ cam, refreshMs }: { cam: SlotCamera; refreshMs: number }) {
  const { kind, url } = cam.media;
  const every = refreshInterval(kind, { ...cam, forceMs: refreshMs });
  const [src, setSrc] = useState(() => freshen(url));

  useEffect(() => {
    setSrc(freshen(url));
  }, [url, cam.id]);

  useEffect(() => {
    if (!every) return;
    let cancelled = false;
    let interval: ReturnType<typeof setInterval> | undefined;

    const loadNext = () => {
      const next = freshen(url);
      const probe = new Image();
      probe.onload = () => {
        if (!cancelled) setSrc(next);
      };
      probe.src = next;
    };

    const first = setTimeout(() => {
      loadNext();
      interval = setInterval(loadNext, every);
    }, Math.random() * 300);

    return () => {
      cancelled = true;
      clearTimeout(first);
      if (interval) clearInterval(interval);
    };
  }, [url, every, cam.id]);

  return (
    /* eslint-disable-next-line @next/next/no-img-element -- live camera still */
    <img src={src} alt={cam.name} className={FEED_FIT} decoding="sync" draggable={false} />
  );
}

function GridVideo({ cam, refreshMs }: { cam: SlotCamera; refreshMs: number }) {
  const { kind, url } = cam.media;
  const ref = useRef<HTMLVideoElement>(null);
  const [cacheBust, setCacheBust] = useState(0);
  const every = refreshInterval(kind, { ...cam, forceMs: kind === 'mp4' ? refreshMs : undefined });

  useEffect(() => {
    if (!every) return;
    const t = setInterval(() => setCacheBust(n => n + 1), every);
    return () => clearInterval(t);
  }, [every]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    if (kind === 'mp4') {
      el.src = cacheBust ? freshen(url) : url;
      el.play().catch(() => {});
      return;
    }

    let cancelled = false;
    let hls: { destroy: () => void } | null = null;
    import('hls.js').then(({ default: Hls }) => {
      if (cancelled || !ref.current) return;
      if (!Hls.isSupported()) {
        if (ref.current.canPlayType('application/vnd.apple.mpegurl')) {
          ref.current.src = url;
          ref.current.play().catch(() => {});
        }
        return;
      }
      const instance = new Hls({
        enableWorker: false,
        maxBufferLength: 20,
        capLevelToPlayerSize: false,
        startLevel: -1,
      });
      hls = instance;
      instance.loadSource(url);
      instance.attachMedia(ref.current);
      ref.current.play().catch(() => {});
    }).catch(() => {});

    return () => { cancelled = true; hls?.destroy(); };
  }, [kind, url, cacheBust]);

  return (
    <video ref={ref} className={FEED_FIT} muted playsInline loop autoPlay preload="auto" />
  );
}

function FeedMedia({ cam, refreshMs }: { cam: SlotCamera; refreshMs: number }) {
  return VIDEO_KINDS.has(cam.media.kind)
    ? <GridVideo cam={cam} refreshMs={refreshMs} />
    : <GridImage cam={cam} refreshMs={refreshMs} />;
}

function GridCell({
  cam,
  refreshMs,
  onExpand,
  onClear,
  onLocate,
}: {
  cam: SlotCamera | null;
  refreshMs: number;
  onExpand?: () => void;
  onClear: () => void;
  onLocate?: (lat: number, lng: number) => void;
}) {
  if (!cam) {
    return (
      <div className="flex h-full min-h-0 items-center justify-center border border-dashed border-white/15 bg-black/40">
        <span className="font-mono text-[9px] tracking-[0.2em] text-white/30">EMPTY SLOT</span>
      </div>
    );
  }

  return (
    <div className="group relative h-full min-h-0 overflow-hidden border border-[var(--map-cctv)]/40 bg-black">
      <button
        type="button"
        onClick={onExpand}
        className="absolute inset-0 z-[1] cursor-pointer"
        title="Expand camera"
        aria-label={`Expand ${cam.name}`}
      />
      <FeedMedia cam={cam} refreshMs={refreshMs} />
      <div className="pointer-events-none absolute left-1.5 top-1.5 z-[2] flex items-center gap-1">
        <div className="flex items-center gap-1 bg-black/70 px-1.5 py-0.5">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--alert-red)]" />
          <span className="font-mono text-[7px] tracking-[0.18em] text-white/75">LIVE</span>
        </div>
        {cityCanPanCam(cam) && (
          <span
            className="bg-black/70 px-1.5 py-0.5 font-mono text-[7px] tracking-[0.14em] text-white/55"
            title="City can pan this cam — the view can change"
          >
            CITY PAN
          </span>
        )}
      </div>
      <div className="absolute inset-x-0 bottom-0 z-[2] flex items-center justify-between gap-2 bg-black/75 px-2 py-1">
        <span className="min-w-0 truncate font-mono text-[8px] uppercase tracking-wider text-[var(--map-cctv)] md:text-[9px]">{cam.name}</span>
        <div className="flex shrink-0 gap-1">
          {onLocate && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onLocate(cam.lat, cam.lng); }}
              className="rounded bg-white/10 p-1 hover:bg-white/20"
              title="Fly to camera"
            >
              <MapPin className="h-3 w-3 text-white/70" />
            </button>
          )}
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onClear(); }}
            className="rounded bg-white/10 p-1 hover:bg-red-500/30"
            title="Remove from wall"
          >
            <X className="h-3 w-3 text-white/70" />
          </button>
        </div>
      </div>
    </div>
  );
}

function SoloFeed({
  cam,
  refreshMs,
  onBack,
  onLocate,
}: {
  cam: SlotCamera;
  refreshMs: number;
  onBack: () => void;
  onLocate?: (lat: number, lng: number) => void;
}) {
  return (
    <div className="relative flex min-h-0 flex-1 flex-col bg-black">
      <div className="relative min-h-0 flex-1">
        <FeedMedia cam={cam} refreshMs={refreshMs} />
        <div className="absolute left-3 top-3 z-[2] flex items-center gap-2">
          <button
            type="button"
            onClick={onBack}
            className="flex items-center gap-1.5 rounded border border-white/20 bg-black/80 px-2.5 py-1.5 font-mono text-[9px] tracking-[0.15em] text-white/90 hover:border-[var(--map-cctv)]/50 hover:text-[var(--map-cctv)]"
          >
            <ChevronLeft className="h-4 w-4" />
            GRID
          </button>
          {onLocate && (
            <button
              type="button"
              onClick={() => onLocate(cam.lat, cam.lng)}
              className="rounded border border-white/20 bg-black/80 p-1.5 hover:border-[var(--map-cctv)]/50"
              title="Fly to camera on map"
            >
              <MapPin className="h-4 w-4 text-white/70" />
            </button>
          )}
        </div>
      </div>
      <div className="flex shrink-0 items-center justify-between gap-3 border-t border-white/10 bg-black/90 px-3 py-2">
        <div className="min-w-0">
          <p className="truncate font-mono text-[11px] font-bold uppercase tracking-wider text-white">{cam.name}</p>
          <p className="font-mono text-[8px] tracking-wider text-white/40">
            {cam.city ?? '—'} · {cam.source ?? 'CCTV'}
            {cityCanPanCam(cam) ? ' · city can pan this cam' : ''}
            {' · esc to return to grid'}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5 bg-black/70 px-2 py-1">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--alert-red)]" />
          <span className="font-mono text-[8px] tracking-[0.18em] text-white/75">LIVE</span>
        </div>
      </div>
    </div>
  );
}

function CctvGridWall({
  open,
  cameras,
  slotIds,
  onSlotIdsChange,
  refreshMs,
  onRefreshMsChange,
  onClose,
  onLocate,
  pendingAdd,
  onPendingAddHandled,
  pickMode = false,
  pickCount = 0,
  onPickModeChange,
}: CctvGridWallProps) {
  const [fullscreen, setFullscreen] = useState(false);
  const [soloIndex, setSoloIndex] = useState<number | null>(null);

  const byId = useMemo(() => new Map(cameras.map(c => [c.id, c])), [cameras]);

  const slots = useMemo(() => {
    const ids = [...slotIds];
    while (ids.length < SLOT_COUNT) ids.push('');
    return ids.slice(0, SLOT_COUNT).map(id => {
      if (!id) return null;
      const cam = byId.get(id);
      if (!cam) return null;
      const media = previewMedia(cam);
      if (!media) return null;
      return { ...cam, media };
    });
  }, [slotIds, byId]);

  const loadPuertaBlanca = useCallback(() => {
    const preset = pickPuertaBlancaGrid(cameras, 4).map(c => c.id);
    while (preset.length < SLOT_COUNT) preset.push('');
    onSlotIdsChange(preset.slice(0, SLOT_COUNT));
    onLocate?.(36.688, -4.458);
  }, [cameras, onSlotIdsChange, onLocate]);

  const loadAlhaurin = useCallback(() => {
    const preset = pickAlhaurinGrid(cameras, SLOT_COUNT).map(c => c.id);
    while (preset.length < SLOT_COUNT) preset.push('');
    onSlotIdsChange(preset.slice(0, SLOT_COUNT));
    onLocate?.(36.661, -4.562);
  }, [cameras, onSlotIdsChange, onLocate]);

  const setSlot = useCallback((index: number, id: string | null) => {
    const next = [...slotIds];
    while (next.length < SLOT_COUNT) next.push('');
    next.length = SLOT_COUNT;
    if (id) {
      const existing = next.indexOf(id);
      if (existing >= 0 && existing !== index) next[existing] = '';
    }
    next[index] = id ?? '';
    onSlotIdsChange(next);
  }, [slotIds, onSlotIdsChange]);

  const addCamera = useCallback((cam: GridCamera) => {
    if (!previewMedia(cam)) return;
    const next = [...slotIds];
    while (next.length < SLOT_COUNT) next.push('');
    const empty = next.findIndex(id => !id);
    const target = empty >= 0 ? empty : next.length % SLOT_COUNT;
    setSlot(target, cam.id);
  }, [slotIds, setSlot]);

  useEffect(() => {
    if (!pendingAdd) return;
    addCamera(pendingAdd);
    onPendingAddHandled?.();
  }, [pendingAdd, addCamera, onPendingAddHandled]);

  useEffect(() => {
    if (!open) {
      setFullscreen(false);
      setSoloIndex(null);
    }
  }, [open]);

  useEffect(() => {
    if (soloIndex != null && !slots[soloIndex]) setSoloIndex(null);
  }, [soloIndex, slots]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (soloIndex !== null) setSoloIndex(null);
      else if (fullscreen) setFullscreen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, soloIndex, fullscreen]);

  const soloCam = soloIndex !== null ? slots[soloIndex] : null;

  if (!open) return null;

  const shellClass = fullscreen
    ? 'fixed inset-0 z-[520] flex h-dvh flex-col bg-black'
    : 'fixed inset-x-2 bottom-[72px] z-[480] mx-auto flex max-h-[min(82dvh,calc(100dvh-5.5rem))] max-w-6xl flex-col md:inset-x-auto md:right-4 md:bottom-4 md:left-auto md:w-[min(1100px,calc(100vw-2rem))]';

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: fullscreen ? 0 : 16 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: fullscreen ? 0 : 16 }}
        className={shellClass}
      >
        <div className={`flex min-h-0 flex-1 flex-col overflow-hidden bg-black/95 shadow-2xl backdrop-blur-xl ${fullscreen ? 'h-full' : 'border border-[var(--map-cctv)]/30'}`}>
          <div className="flex shrink-0 flex-col gap-2 border-b border-white/10 px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-center gap-2">
              <LayoutGrid className="h-4 w-4 shrink-0 text-[var(--map-cctv)]" />
              <div className="min-w-0">
                <h2 className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-white">CCTV Wall</h2>
                <p className="hidden font-mono text-[8px] tracking-wider text-white/40 sm:block">
                  {pickMode
                    ? `pick on map · ${pickCount}/4 selected`
                    : soloCam
                      ? 'single feed · esc or grid to return'
                      : fullscreen
                        ? 'fullscreen · click a feed to expand'
                        : '4-up grid · your layout is saved'}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <div className="flex rounded border border-white/10">
                {REFRESH_OPTIONS.map(opt => (
                  <button
                    key={opt.ms}
                    type="button"
                    onClick={() => onRefreshMsChange(opt.ms)}
                    className={`px-2 py-1 font-mono text-[8px] tracking-wider ${refreshMs === opt.ms ? 'bg-[var(--map-cctv)]/25 text-[var(--map-cctv)]' : 'text-white/50 hover:text-white/80'}`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              {onPickModeChange && (
                <button
                  type="button"
                  onClick={() => onPickModeChange(!pickMode)}
                  className={`flex items-center gap-1 rounded border px-2 py-1 font-mono text-[8px] tracking-wider ${pickMode ? 'border-[var(--map-cctv)] bg-[var(--map-cctv)]/20 text-[var(--map-cctv)]' : 'border-white/10 text-white/70 hover:border-[var(--map-cctv)]/50 hover:text-[var(--map-cctv)]'}`}
                  title={pickMode ? 'Cancel pick mode' : 'Pick 4 cameras from the map'}
                >
                  <Crosshair className={`h-3 w-3 ${pickMode ? 'animate-pulse' : ''}`} />
                  PICK
                </button>
              )}
              <button
                type="button"
                onClick={loadPuertaBlanca}
                className="hidden items-center gap-1 rounded border border-white/10 px-2 py-1 font-mono text-[8px] tracking-wider text-white/70 hover:border-[var(--map-cctv)]/50 hover:text-[var(--map-cctv)] sm:flex"
                title="Load Puerta Blanca / Molière preset (replaces current slots)"
              >
                <RefreshCw className="h-3 w-3" />
                MÁLAGA
              </button>
              <button
                type="button"
                onClick={loadAlhaurin}
                className="hidden items-center gap-1 rounded border border-white/10 px-2 py-1 font-mono text-[8px] tracking-wider text-white/70 hover:border-[var(--map-cctv)]/50 hover:text-[var(--map-cctv)] sm:flex"
                title="Load Alhaurín de la Torre + A-7 / A-357 approaches"
              >
                <RefreshCw className="h-3 w-3" />
                ALHAURÍN
              </button>
              {soloCam && (
                <button
                  type="button"
                  onClick={() => setSoloIndex(null)}
                  className="flex items-center gap-1 rounded border border-white/10 px-2 py-1 font-mono text-[8px] tracking-wider text-white/70 hover:border-[var(--map-cctv)]/50 hover:text-[var(--map-cctv)]"
                >
                  <ChevronLeft className="h-3 w-3" />
                  GRID
                </button>
              )}
              <button
                type="button"
                onClick={() => setFullscreen(f => !f)}
                className="rounded border border-white/10 bg-white/5 p-1.5 hover:border-[var(--map-cctv)]/50"
                title={fullscreen ? 'Exit fullscreen' : 'Fullscreen wall'}
              >
                {fullscreen
                  ? <Minimize2 className="h-4 w-4 text-white/70" />
                  : <Maximize2 className="h-4 w-4 text-white/70" />}
              </button>
              <button type="button" onClick={onClose} className="rounded border border-red-500/30 bg-red-900/20 p-1.5 hover:bg-red-500/30">
                <X className="h-4 w-4 text-red-400" />
              </button>
            </div>
          </div>

          {soloCam ? (
            <SoloFeed
              cam={soloCam}
              refreshMs={refreshMs}
              onBack={() => setSoloIndex(null)}
              onLocate={onLocate}
            />
          ) : (
            <div className={`grid min-h-0 flex-1 grid-cols-2 grid-rows-2 overflow-hidden ${fullscreen ? 'gap-0.5 p-0.5' : 'gap-1 p-1'}`}>
              {slots.map((cam, i) => (
                <GridCell
                  key={`slot-${i}-${cam?.id ?? slotIds[i] ?? 'empty'}`}
                  cam={cam}
                  refreshMs={refreshMs}
                  onExpand={cam ? () => setSoloIndex(i) : undefined}
                  onClear={() => setSlot(i, null)}
                  onLocate={onLocate}
                />
              ))}
            </div>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

export default memo(CctvGridWall);
