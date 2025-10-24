"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  Fragment,
  useCallback,
  type MouseEvent as ReactMouseEvent,
} from "react";
// Remove strict Theme typing to avoid version mismatch issues
import { ResponsiveLine } from "@nivo/line";
import { cn } from "@/lib/utils";
import { evCacheGetMany, evCacheSetMany } from "@/lib/evCache";
import { computeEvClientForRecord } from "@/lib/evClient";

type CurvePoint = {
  handId: string;
  handNo: string | null;
  playedAt: string | null;
  cumActual: number;
  cumAdj: number;
  cumShowdown?: number;
  cumNoShowdown?: number;
};

type ApiResponse = {
  points?: CurvePoint[];
};

type LineDatum = {
  x: number;
  y: number;
};

type ChartSerie = {
  id: string;
  data: LineDatum[];
};

const clampValue = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

const CHART_MARGIN = { top: 48, right: 72, bottom: 56, left: 32 } as const;

const integerFormatter = new Intl.NumberFormat("en-US");

const chartTheme = {
  background: "transparent",
  textColor: "#f8fafc",
  fontSize: 12,
  fontFamily: "var(--font-inter), sans-serif",
  axis: {
    domain: {
      line: {
        stroke: "transparent",
      },
    },
    ticks: {
      line: {
        stroke: "transparent",
      },
      text: {
        fill: "#f8fafc",
        fontFamily: "var(--font-inter), sans-serif",
        fontSize: 12,
        fontWeight: 500,
      },
    },
    legend: {
      text: {
        fill: "#f8fafc",
        fontFamily: "var(--font-inter), sans-serif",
        fontSize: 12,
        fontWeight: 500,
      },
    },
  },
  grid: {
    line: {
      stroke: "#f8fafcbf",
      strokeWidth: 1.5,
      strokeLinecap: "round",
    },
  },
  legends: {
    text: {
      fill: "#f8fafc",
      fontFamily: "var(--font-inter), sans-serif",
      fontSize: 12,
      fontWeight: 500,
    },
  },
  crosshair: {
    line: {
      stroke: "#818cf8",
      strokeWidth: 1.25,
      strokeOpacity: 0.8,
    },
  },
} as const;

const SERIES_COLORS: Record<string, string> = {
  "Chips Won": "#22c55e",
  "Chips Won With Showdown": "#60a5fa",
  "Chips Won Without Showdown": "#ef4444",
  "Net Expected Chips Won": "#facc15",
};

const SERIES_STORAGE_KEY = 'ev-curve:series:v1';

const safeLocalStorage = () => {
  if (typeof window === 'undefined' || typeof window.localStorage === 'undefined') return null;
  return window.localStorage;
};

const loadSeriesSettings = () => {
  try {
    const storage = safeLocalStorage();
    const raw = storage ? storage.getItem(SERIES_STORAGE_KEY) : null;
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<Record<string, boolean>> | null;
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
};

const persistSeriesSettings = (value: Record<string, boolean>) => {
  try {
    const storage = safeLocalStorage();
    if (storage) storage.setItem(SERIES_STORAGE_KEY, JSON.stringify(value));
  } catch {
    // ignore errors
  }
};

export function EvCurveChart({ className, period, dateFrom, dateTo, hoursFrom, hoursTo, buyIns, position, huRoles, m3Roles, effMinBB, effMaxBB, phase }: { className?: string; period?: 'today' | 'yesterday' | 'this-week' | 'this-month'; dateFrom?: string; dateTo?: string; hoursFrom?: string; hoursTo?: string; buyIns?: number[]; position?: 'hu' | '3max'; huRoles?: Array<'sb' | 'bb'>; m3Roles?: Array<'bu' | 'sb' | 'bb'>; effMinBB?: number; effMaxBB?: number; phase?: 'preflop' | 'postflop' }) {
  const [points, setPoints] = useState<CurvePoint[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const chartRef = useRef<HTMLDivElement | null>(null);
  const [hoverPosition, setHoverPosition] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const [isHoverPinned, setIsHoverPinned] = useState<boolean>(false);
  const [measureStartY, setMeasureStartY] = useState<number | null>(null);
  const [measureCurrentY, setMeasureCurrentY] = useState<number | null>(null);
const yScaleRef = useRef<((value: number) => number) | null>(null);
const innerHeightRef = useRef<number>(0);
const xScaleRef = useRef<((value: number) => number) | null>(null);
const innerWidthRef = useRef<number>(0);
  const saved = loadSeriesSettings();
  const [enabledSeries, setEnabledSeries] = useState<Record<string, boolean>>(() => ({
    "Chips Won": saved?.["Chips Won"] ?? true,
    "Chips Won With Showdown": saved?.["Chips Won With Showdown"] ?? false,
    "Chips Won Without Showdown": saved?.["Chips Won Without Showdown"] ?? false,
    "Net Expected Chips Won": saved?.["Net Expected Chips Won"] ?? true,
  }));
  useEffect(() => {
    persistSeriesSettings(enabledSeries);
  }, [enabledSeries]);

  const handleMouseMove = (event: ReactMouseEvent<HTMLDivElement>) => {
    if (!chartRef.current) return;
    const rect = chartRef.current.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;

    const x = clampValue(event.clientX - rect.left, 0, rect.width);
    const y = clampValue(event.clientY - rect.top, 0, rect.height);

    const withinX =
      x >= CHART_MARGIN.left && x <= rect.width - CHART_MARGIN.right;
    const withinY =
      y >= CHART_MARGIN.top && y <= rect.height - CHART_MARGIN.bottom;
    if (!withinX || !withinY) {
      if (isHoverPinned) {
        const pinnedX = x < CHART_MARGIN.left ? CHART_MARGIN.left : (x > rect.width - CHART_MARGIN.right ? rect.width - CHART_MARGIN.right : x);
        const pinnedY = y < CHART_MARGIN.top ? CHART_MARGIN.top : (y > rect.height - CHART_MARGIN.bottom ? rect.height - CHART_MARGIN.bottom : y);
        setHoverPosition({ x: pinnedX, y: pinnedY });
        if (measureStartY !== null) setMeasureCurrentY(pinnedY);
        return;
      } else {
        setHoverPosition(null);
        return;
      }
    }

    setHoverPosition({ x, y });
    if (measureStartY !== null) {
      setMeasureCurrentY(y);
    }
  };

  const handleMouseLeave = () => {
    if (!isHoverPinned) setHoverPosition(null);
  };

  const handleMouseDown = (event: ReactMouseEvent<HTMLDivElement>) => {
    if (!chartRef.current) return;
    const rect = chartRef.current.getBoundingClientRect();
    const y = clampValue(event.clientY - rect.top, 0, rect.height);
    const withinY = y >= CHART_MARGIN.top && y <= rect.height - CHART_MARGIN.bottom;
    if (!withinY) return;
    setIsHoverPinned(true);
    setMeasureStartY(y);
    setMeasureCurrentY(y);
  };

  useEffect(() => {
    const handleWindowMouseUp = () => {
      if (measureStartY !== null) {
        setMeasureStartY(null);
        setMeasureCurrentY(null);
      }
      if (isHoverPinned) setIsHoverPinned(false);
    };
    if (measureStartY !== null) {
      window.addEventListener("mouseup", handleWindowMouseUp);
    }
    return () => {
      window.removeEventListener("mouseup", handleWindowMouseUp);
    };
  }, [measureStartY, isHoverPinned]);

  const CLIENT_COMPUTE = process.env.NEXT_PUBLIC_EV_CLIENT_COMPUTE !== '0';

  const normalizeCurve = useCallback((curve: CurvePoint[]): CurvePoint[] => {
    return curve.map((p) => {
      const safeActual = Number.isFinite(p.cumActual) ? p.cumActual : 0;
      const safeAdj = Number.isFinite(p.cumAdj) ? p.cumAdj : safeActual;
      return { ...p, cumActual: safeActual, cumAdj: safeAdj };
    });
  }, []);

  const downsampleCurve = useCallback((curve: CurvePoint[], threshold: number): CurvePoint[] => {
    const data = normalizeCurve(curve);
    const n = data.length;
    if (threshold >= n || threshold <= 0) return data;
    // Largest-Triangle-Three-Buckets based on cumAdj as primary Y
    const sampled: CurvePoint[] = [];
    const bucketSize = (n - 2) / (threshold - 2);
    let a = 0; // always add the first point
    sampled.push(data[a]);

    for (let i = 0; i < threshold - 2; i++) {
      const rangeStart = Math.floor((i + 1) * bucketSize) + 1;
      const rangeEnd = Math.floor((i + 2) * bucketSize) + 1;
      const rangeLeft = Math.min(Math.max(rangeStart, 1), n - 1);
      const rangeRight = Math.min(Math.max(rangeEnd, 1), n - 1);

      // Compute average for next bucket
      let avgX = 0;
      let avgY = 0;
      const avgRangeStart = rangeLeft;
      const avgRangeEnd = rangeRight;
      const avgRangeLength = Math.max(1, avgRangeEnd - avgRangeStart);
      for (let j = avgRangeStart; j < avgRangeEnd; j++) {
        avgX += j;
        avgY += data[j].cumAdj;
      }
      avgX /= avgRangeLength;
      avgY /= avgRangeLength;

      // Point a
      const aX = a;
      const aY = data[a].cumAdj;

      // Find point in this bucket with the largest triangle area
      const rangeCurrStart = Math.floor(i * bucketSize) + 1;
      const rangeCurrEnd = Math.floor((i + 1) * bucketSize) + 1;
      const currLeft = Math.min(Math.max(rangeCurrStart, 1), n - 1);
      const currRight = Math.min(Math.max(rangeCurrEnd, 1), n - 1);

      let maxArea = -1;
      let nextA = currLeft;
      for (let j = currLeft; j < currRight; j++) {
        const bX = j;
        const bY = data[j].cumAdj;
        const area = Math.abs((aX - avgX) * (bY - aY) - (aY - avgY) * (bX - aX));
        if (area > maxArea) {
          maxArea = area;
          nextA = j;
        }
      }
      sampled.push(data[nextA]);
      a = nextA;
    }

    // Always add last point
    sampled.push(data[n - 1]);
    return sampled;
  }, [normalizeCurve]);

  useEffect(() => {
    const controller = new AbortController();
    setIsLoading(true);
    setPoints([]);
    setError(null);

    const loadDataServer = async () => {
      try {
        const params = new URLSearchParams();
        if (period) {
          params.set('period', period);
        }
        if (period == null || (period as string) === 'custom') {
          if (dateFrom) params.set('dateFrom', dateFrom);
          if (dateTo) params.set('dateTo', dateTo);
          if (hoursFrom) params.set('hoursFrom', hoursFrom);
          if (hoursTo) params.set('hoursTo', hoursTo);
        }
        if (Array.isArray(buyIns)) for (const b of buyIns) params.append('buyIns', String(b));
        if (position) params.set('position', position);
        if (Array.isArray(huRoles)) for (const r of huRoles) params.append('huRole', r);
        if (Array.isArray(m3Roles)) for (const r of m3Roles) params.append('m3Role', r);
        if (effMinBB != null) params.set('effMin', String(effMinBB));
        if (effMaxBB != null) params.set('effMax', String(effMaxBB));
        if (phase) params.set('phase', phase);

        const res = await fetch(`/api/ev-curve${params.size ? `?${params.toString()}` : ''}`, { signal: controller.signal, cache: 'no-store' });
        if (!res.ok) throw new Error('failed');
        const payload: ApiResponse = await res.json();
        const raw = payload.points ?? [];
        setPoints(downsampleCurve(raw, 4000));
        setError(null);
        setIsLoading(false);
      } catch (_err) {
        if (!controller.signal.aborted) {
          setError('Unable to load EV curve.');
          setIsLoading(false);
        }
      }
    };

    const loadDataClient = async () => {
      try {
        let bootSrvPts: CurvePoint[] | null = null;
        // Affichage initial immédiat via serveur (rapide si EV en cache)
        try {
          const bootQs = new URLSearchParams();
          if (period) bootQs.set('period', period);
          if (dateFrom) bootQs.set('dateFrom', dateFrom);
          if (dateTo) bootQs.set('dateTo', dateTo);
          if (hoursFrom) bootQs.set('hoursFrom', hoursFrom);
          if (hoursTo) bootQs.set('hoursTo', hoursTo);
              if (Array.isArray(buyIns)) for (const b of buyIns) bootQs.append('buyIns', String(b));
          if (position) bootQs.set('position', position);
          if (Array.isArray(huRoles)) for (const r of huRoles) bootQs.append('huRole', r);
          if (Array.isArray(m3Roles)) for (const r of m3Roles) bootQs.append('m3Role', r);
          if (effMinBB != null) bootQs.set('effMin', String(effMinBB));
          if (effMaxBB != null) bootQs.set('effMax', String(effMaxBB));
          if (phase) bootQs.set('phase', phase);
          const bootRes = await fetch(`/api/ev-curve${bootQs.size ? `?${bootQs.toString()}` : ''}`, { signal: controller.signal, cache: 'no-store' });
          if (bootRes.ok) {
            const bootPayload: ApiResponse = await bootRes.json();
            bootSrvPts = (bootPayload.points ?? []) as CurvePoint[];
            setPoints(downsampleCurve(bootSrvPts, 4000));
            // Ne pas recalculer côté client si on a déjà les points serveur (stabilité d'allure)
            setIsLoading(false);
            return;
          }
        } catch {
          // ignore boot fetch failure
        }
        // 1) Fetch all ids (paginated)
        const buildQs = () => {
          const qs = new URLSearchParams();
          if (period) qs.set('period', period);
          if (dateFrom) qs.set('dateFrom', dateFrom);
          if (dateTo) qs.set('dateTo', dateTo);
          if (hoursFrom) qs.set('hoursFrom', hoursFrom);
          if (hoursTo) qs.set('hoursTo', hoursTo);
          if (Array.isArray(buyIns)) for (const b of buyIns) qs.append('buyIns', String(b));
          if (position) qs.set('position', position);
          if (Array.isArray(huRoles)) for (const r of huRoles) qs.append('huRole', r);
          if (Array.isArray(m3Roles)) for (const r of m3Roles) qs.append('m3Role', r);
          if (effMinBB != null) qs.set('effMin', String(effMinBB));
          if (effMaxBB != null) qs.set('effMax', String(effMaxBB));
          if (phase) qs.set('phase', phase);
          return qs;
        };
        const ids: Array<{ id: string }> = [];
        let cursor: string | null = null;
        let page = 0;
        const MAX_PAGES = 200; // cap ~2M ids (@10k/page)
        do {
          const qs = buildQs();
          qs.set('limit', '10000');
          if (cursor) qs.set('cursor', cursor);
          const res = await fetch(`/api/hands/ids?${qs.toString()}`, { signal: controller.signal, cache: 'no-store' });
          if (!res.ok) throw new Error('ids_failed');
          const j = await res.json();
          const batch = Array.isArray(j.ids) ? j.ids as string[] : [];
          for (const id of batch) ids.push({ id });
          cursor = j.nextCursor ?? null;
          page += 1;
        } while (cursor && page < MAX_PAGES && !controller.signal.aborted);

        if (controller.signal.aborted) return;

        // 2) Decide target samples dynamically (client policy mirrors server)
        const total = ids.length;
        const targetSamples = total >= 10000 ? 50 : total >= 3000 ? 100 : 250;

        // 3) Iterate ids in chunks; use cache; compute missing via workers
        const CHUNK = 1500;
        const BATCH_FETCH = 5000;
        const BATCH_EV = 10000;
        let cumActual = 0;
        let cumAdj = 0;
        const outPoints: CurvePoint[] = [{ handId: 'start', handNo: null, playedAt: null, cumActual: 0, cumAdj: 0 }];

        for (let i = 0; i < ids.length; i += CHUNK) {
          if (controller.signal.aborted) return;
          const slice = ids.slice(i, i + CHUNK).map((x) => x.id);
          const cached = await evCacheGetMany(slice);
          const needIds: string[] = [];
          const have: Array<{ id: string; realized: number | null; adjusted: number | null; samples: number }> = [];
          for (const id of slice) {
            const v = cached.get(id);
            if (v && (v.samples ?? 0) >= targetSamples) {
              have.push({ id, realized: v.realized, adjusted: v.adjusted, samples: v.samples });
            } else {
              needIds.push(id);
            }
          }

          // Try server EV-only for needIds first (cheap): accept only if samples >= target
          const fromServerEv: Array<{ id: string; realized: number | null; adjusted: number | null; samples: number }> = [];
          for (let j = 0; j < needIds.length; j += BATCH_EV) {
            if (controller.signal.aborted) return;
            const pack = needIds.slice(j, j + BATCH_EV);
            const resEv = await fetch('/api/hands/ev', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ ids: pack }),
              signal: controller.signal,
            });
            if (resEv.ok) {
              const evPayload = await resEv.json();
              const items = Array.isArray(evPayload.items) ? evPayload.items : [];
              for (const it of items) {
                const s = (it.evSamples ?? 0) as number;
                const realized = (it.evRealizedCents ?? null) as number | null;
                const adjusted = (it.evAllInAdjCents ?? null) as number | null;
                if (s >= targetSamples && (realized != null || adjusted != null)) {
                  fromServerEv.push({ id: it.id, realized, adjusted: adjusted ?? realized, samples: s });
                }
              }
            }
          }

          const fromServerEvIds = new Set(fromServerEv.map((r) => r.id));

          // Fetch details for remaining ids in batches, then compute locally in small steps
          const pendingIds = needIds.filter((id) => !fromServerEvIds.has(id));
          const computed: Array<{ id: string; realized: number | null; adjusted: number | null; samples: number }> = [];
          for (let j = 0; j < pendingIds.length; j += BATCH_FETCH) {
            if (controller.signal.aborted) return;
            const pack = pendingIds.slice(j, j + BATCH_FETCH);
            const res = await fetch('/api/hands/batch', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ ids: pack }),
              signal: controller.signal,
            });
            if (!res.ok) throw new Error('batch_failed');
            const data = await res.json();
            const hands = Array.isArray(data.hands) ? data.hands : [];
            for (let k = 0; k < hands.length; k += 250) {
              const portion = hands.slice(k, k + 250);
              // Yield to UI queue between sub-batches
              await new Promise((r) => setTimeout(r, 0));
              for (const h of portion) {
                const ev = computeEvClientForRecord(h, targetSamples);
                computed.push({ id: h.id, realized: ev.realized, adjusted: ev.adjusted, samples: targetSamples });
              }
            }
          }

          // Persist computed in cache
          const toPersist = [
            ...fromServerEv.map((r) => ({ id: r.id, value: { realized: r.realized, adjusted: r.adjusted, samples: r.samples, updatedAt: Date.now(), version: 1 as const } })),
            ...computed.map((r) => ({ id: r.id, value: { realized: r.realized, adjusted: r.adjusted, samples: r.samples, updatedAt: Date.now(), version: 1 as const } })),
          ];
          if (toPersist.length > 0) {
            await evCacheSetMany(
              toPersist,
            );
          }

          // Merge order-preserving
          const byId = new Map<string, { realized: number | null; adjusted: number | null }>();
          for (const r of have) byId.set(r.id, { realized: r.realized, adjusted: r.adjusted });
          for (const r of fromServerEv) byId.set(r.id, { realized: r.realized, adjusted: r.adjusted });
          for (const r of computed) byId.set(r.id, { realized: r.realized, adjusted: r.adjusted });

          for (const id of slice) {
            const v = byId.get(id) ?? { realized: 0, adjusted: null };
            const deltaActual = v.realized ?? 0;
            const deltaAdj = v.adjusted != null ? v.adjusted : deltaActual;
            cumActual += deltaActual;
            cumAdj += deltaAdj;
            outPoints.push({ handId: id, handNo: null, playedAt: null, cumActual, cumAdj });
          }

          // Pas de mise à jour progressive pour afficher les 2 courbes ensemble (client + overlay)
        }

        // Mise à jour unique: les deux courbes ensemble; préserver cumAdj serveur si on l'a
        if (bootSrvPts && bootSrvPts.length > 0) {
          const merged: CurvePoint[] = [{ handId: 'start', handNo: null, playedAt: null, cumActual: outPoints[0].cumActual, cumAdj: outPoints[0].cumAdj }];
          const max = Math.min(bootSrvPts.length, outPoints.length - 1);
          for (let i = 0; i < max; i++) {
            const src = outPoints[i + 1];
            const srvAdj = bootSrvPts[i]?.cumAdj;
            merged.push({ ...src, cumAdj: Number.isFinite(srvAdj as number) ? (srvAdj as number) : src.cumAdj });
          }
          setPoints(downsampleCurve(merged, 4000));
        } else {
          setPoints(downsampleCurve(outPoints, 4000));
        }

        setError(null);
        setIsLoading(false);
      } catch (_err) {
        if (!controller.signal.aborted) {
          setError('Unable to compute EV locally.');
          setIsLoading(false);
        }
      }
    };

    if (CLIENT_COMPUTE) void loadDataClient();
    else void loadDataServer();
    return () => controller.abort();
  }, [CLIENT_COMPUTE, period, dateFrom, dateTo, hoursFrom, hoursTo, buyIns, position, huRoles, m3Roles, effMinBB, effMaxBB, phase, downsampleCurve]);

  const chartSeries = useMemo(() => {
    const base = [{ cumActual: 0, cumAdj: 0, cumShowdown: 0, cumNoShowdown: 0 }, ...points];
    const netExpected: ChartSerie = {
        id: "Net Expected Chips Won",
        data: base.map((point, index) => ({
          x: index,
          y:
            typeof point.cumAdj === "number"
              ? point.cumAdj
              : typeof point.cumActual === "number"
                ? point.cumActual
                : 0,
        })),
    };
    const chipsWon: ChartSerie = {
      id: "Chips Won",
      data: base.map((point, index) => ({
        x: index,
        y: typeof point.cumActual === "number" ? point.cumActual : 0,
      })),
    };
    const chipsShowdown: ChartSerie = {
      id: "Chips Won With Showdown",
      data: base.map((point, index) => ({
        x: index,
        y: typeof point.cumShowdown === "number" ? point.cumShowdown : 0,
      })),
    };
    const chipsNoShowdown: ChartSerie = {
      id: "Chips Won Without Showdown",
      data: base.map((point, index) => ({
        x: index,
        y: typeof point.cumNoShowdown === "number" ? point.cumNoShowdown : 0,
      })),
    };
    // Ensure Net Expected is drawn last (on top)
    const all = [chipsWon, chipsShowdown, chipsNoShowdown, netExpected];
    return all.filter((s) => enabledSeries[s.id] !== false);
  }, [points, enabledSeries]);

  const endIndex = useMemo(() => {
    if (chartSeries.length === 0) return 0;
    const firstSerie = chartSeries[0];
    if (!firstSerie || firstSerie.data.length === 0) return 0;
    const lastPoint = firstSerie.data[firstSerie.data.length - 1];
    return typeof lastPoint.x === "number" ? lastPoint.x : 0;
  }, [chartSeries]);

  const xTickValues = useMemo(() => {
    if (!Number.isFinite(endIndex) || endIndex <= 0) return undefined;
    const maxTicks = 8;
    if (endIndex <= maxTicks) {
      const ticks = Array.from({ length: endIndex + 1 }, (_, index) => index);
      if (ticks.length >= 2) {
        const prev = ticks[ticks.length - 2] as number;
        const gap = endIndex - prev;
        if (gap <= 1) ticks.splice(ticks.length - 2, 1); // retire l'avant-dernière si trop proche
      }
      return ticks;
    }

    const step = Math.max(1, Math.round(endIndex / maxTicks));
    const ticks: number[] = [];
    for (let value = 0; value <= endIndex; value += step) {
      ticks.push(value);
    }
    if (ticks[ticks.length - 1] !== endIndex) ticks.push(endIndex);
    if (ticks.length >= 2) {
      const prev = ticks[ticks.length - 2];
      const minGap = Math.max(1, Math.floor(step * 0.6));
      if (endIndex - prev < minGap) ticks.splice(ticks.length - 2, 1);
    }
    return ticks;
  }, [endIndex]);

  const hasPoints = useMemo(() => points.length > 0, [points]);

  const legendItems = useMemo(
    () => [
      { id: "Chips Won", label: "Chips Won", color: SERIES_COLORS["Chips Won"] },
      { id: "Chips Won With Showdown", label: "Chips Won With Showdown", color: SERIES_COLORS["Chips Won With Showdown"] },
      { id: "Chips Won Without Showdown", label: "Chips Won Without Showdown", color: SERIES_COLORS["Chips Won Without Showdown"] },
      {
        id: "Net Expected Chips Won",
        label: "Net Expected Chips Won",
        color: SERIES_COLORS["Net Expected Chips Won"],
      },
    ],
    [],
  );

  const LayerCapture = ({ innerHeight, innerWidth, yScale, xScale }: { innerHeight: number; innerWidth: number; yScale: (value: number) => number; xScale: (value: number) => number }) => {
    yScaleRef.current = yScale;
    xScaleRef.current = xScale;
    innerHeightRef.current = innerHeight;
    innerWidthRef.current = innerWidth;
    return null;
  };

  return (
    <div className={cn("flex h-full w-full flex-col gap-4", className)}>
      {error && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      {hasPoints ? (
        <>
          <div
            className="flex-1 rounded-xl border border-border/70 bg-card shadow-lg shadow-black/40"
            style={{ minHeight: 320 }}
          >
            <div
              ref={chartRef}
              className="relative h-full select-none"
              onMouseMove={handleMouseMove}
              onMouseLeave={handleMouseLeave}
              onMouseDown={handleMouseDown}
            >
              {chartSeries.length > 0 ? (
              <ResponsiveLine
                data={chartSeries}
                theme={chartTheme}
                margin={CHART_MARGIN}
                yScale={{
                  type: "linear",
                  min: "auto",
                  max: "auto",
                  stacked: false,
                  reverse: false,
                }}
                  layers={[
                    "grid",
                    "markers",
                    "axes",
                    "areas",
                    "lines",
                    "points",
                    "slices",
                    "mesh",
                    "legends",
                    LayerCapture,
                  ]}
                axisBottom={{
                  legend: "Hands Played",
                  legendOffset: 40,
                  tickValues: xTickValues,
                  format: (value) => formatNumber(Number(value)),
                }}
                axisLeft={null}
                axisRight={{
                  legend: "Chips",
                  legendOffset: 60,
                  legendPosition: "middle",
                  format: (value) => formatNumber(Number(value)),
                }}
                enableGridX={false}
                enableGridY
                gridYValues={[0]}
                colors={({ id }) => SERIES_COLORS[String(id)] ?? "#f8fafc"}
                  lineWidth={2}
                enablePoints={false}
                pointSize={9}
                pointColor={{ theme: "background" }}
                pointBorderWidth={2}
                pointBorderColor={{ from: "serieColor" }}
                pointLabelYOffset={-12}
                enableSlices={false}
                enableCrosshair={false}
                enableTouchCrosshair={false}
                animate={false}
              />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center text-xs text-muted-foreground">
                  Enable at least one series to display the chart.
                </div>
              )}
              {chartSeries.length > 0 && measureStartY !== null && measureCurrentY !== null ? (
                (() => {
                  const top = Math.min(measureStartY, measureCurrentY);
                  const bottom = Math.max(measureStartY, measureCurrentY);
                  const height = bottom - top;
                  const toValue = (py: number) => {
                    const yScale = yScaleRef.current;
                    const innerH = innerHeightRef.current || 0;
                    if (!yScale || innerH <= 0) return 0;
                    const innerY = clampValue(py - CHART_MARGIN.top, 0, innerH);
                    const scaleWithInvert = yScale as unknown as { invert?: (value: number) => number; domain?: () => [number, number]; range?: () => [number, number] };
                    if (typeof scaleWithInvert.invert === "function") {
                      return scaleWithInvert.invert(innerY);
                    }
                    const domain = scaleWithInvert.domain ? scaleWithInvert.domain() : [0, 0];
                    const range = scaleWithInvert.range ? scaleWithInvert.range() : [0, innerH];
                    const [d0, d1] = domain as [number, number];
                    const [r0, r1] = range as [number, number];
                    const t = r1 === r0 ? 0 : (innerY - r0) / (r1 - r0);
                    return d0 + t * (d1 - d0);
                  };
                  const deltaChips = Math.round(Math.abs(toValue(bottom) - toValue(top)));
                  const labelY = top + height / 2;
                  return (
                    <>
                      <div
                        className="pointer-events-none absolute bg-primary/20"
                        style={{
                          left: `${CHART_MARGIN.left}px`,
                          right: `${CHART_MARGIN.right}px`,
                          top: `${top}px`,
                          height: `${height}px`,
                        }}
                      />
                      <div
                        className="pointer-events-none absolute h-px bg-primary"
                        style={{
                          left: `${CHART_MARGIN.left}px`,
                          right: `${CHART_MARGIN.right}px`,
                          top: `${top}px`,
                          transform: "translateY(-0.5px)",
                        }}
                      />
                      <div
                        className="pointer-events-none absolute h-px bg-primary"
                        style={{
                          left: `${CHART_MARGIN.left}px`,
                          right: `${CHART_MARGIN.right}px`,
                          top: `${bottom}px`,
                          transform: "translateY(-0.5px)",
                        }}
                      />
                      <div
                        className="pointer-events-none absolute -translate-y-1/2 rounded bg-primary px-2 py-0.5 text-[10px] font-semibold text-primary-foreground shadow"
                        style={{
                          left: `${CHART_MARGIN.left + 8}px`,
                          top: `${labelY}px`,
                        }}
                      >
                        {formatNumber(deltaChips)} chips
                      </div>
                    </>
                  );
                })()
              ) : null}
              {hoverPosition ? (
                <>
                  <div
                    className="pointer-events-none absolute w-px bg-primary"
                    style={{
                      left: `${hoverPosition.x}px`,
                      top: `${CHART_MARGIN.top}px`,
                      bottom: `${CHART_MARGIN.bottom}px`,
                      opacity: 0.75,
                      transform: "translateX(-0.5px)",
                    }}
                  />
                  <div
                    className="pointer-events-none absolute h-px bg-primary"
                    style={{
                      top: `${hoverPosition.y}px`,
                      left: `${CHART_MARGIN.left}px`,
                      right: `${CHART_MARGIN.right}px`,
                      opacity: 0.75,
                      transform: "translateY(-0.5px)",
                    }}
                  />
                  {(() => {
                    const yScale = yScaleRef.current;
                    const xScale = xScaleRef.current;
                    const innerW = innerWidthRef.current || 0;
                    const innerH = innerHeightRef.current || 0;
                    if (!yScale || innerW <= 0 || innerH <= 0) return null;

                    const innerX = clampValue(hoverPosition.x - CHART_MARGIN.left, 0, innerW);
                    const ratio = innerW > 0 ? innerX / innerW : 0;
                    const maxIndex = endIndex;
                    const idx = clampValue(Math.round(ratio * maxIndex), 0, maxIndex);

                    const items: Array<{ id: string; yVal: number; px: number; py: number; color: string }> = [];
                    for (const serie of chartSeries) {
                      const d = serie.data[idx];
                      if (!d || typeof d.y !== 'number') continue;
                      const value = d.y as number;
                      const yPxInner = yScale(value);
                      const py = CHART_MARGIN.top + yPxInner;
                      let px: number;
                      if (xScale) {
                        try {
                          const sx = xScale(d.x);
                          px = CHART_MARGIN.left + (typeof sx === 'number' ? sx : innerX);
                        } catch {
                          px = CHART_MARGIN.left + innerX;
                        }
                      } else {
                        px = CHART_MARGIN.left + innerX;
                      }
                      items.push({ id: String(serie.id), yVal: value, px, py, color: SERIES_COLORS[String(serie.id)] ?? '#f8fafc' });
                    }

                    if (items.length === 0) return null;
                    return (
                      <>
                        {items.map((it) => {
                          const label = `${formatNumber(it.yVal)} chips`;
                          const labelLeft = it.px + 8;
                          const labelTop = it.py - 10;
                          return (
                            <Fragment key={`group-${it.id}`}>
                              <div
                                className="pointer-events-none absolute h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 bg-background"
                                style={{ left: `${it.px}px`, top: `${it.py}px`, borderColor: it.color }}
                              />
                              <div
                                className="pointer-events-none absolute rounded px-1.5 py-0.5 text-[10px] font-semibold shadow"
                                style={{ left: `${labelLeft}px`, top: `${labelTop}px`, color: '#0b0b0b', backgroundColor: it.color }}
                              >
                                {label}
                              </div>
                            </Fragment>
                          );
                        })}
                      </>
                    );
                  })()}
                </>
              ) : null}
              {/* final labels intentionally removed by default */}
            </div>
          </div>
        </>
      ) : (
        <div
          className="flex-1 rounded-xl border border-border/70 bg-card shadow-lg shadow-black/40"
          style={{ minHeight: 320 }}
        >
          {isLoading ? (
            <div className="flex h-full items-center justify-center gap-2 text-sm text-muted-foreground">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-muted-foreground/40 border-t-primary" />
              <span>Loading EV curve…</span>
            </div>
          ) : (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            No data to display yet.
          </div>
          )}
        </div>
      )}
      {/* Legend: one small clickable tile per series */}
      <div className="flex flex-wrap items-center justify-center gap-2">
        {legendItems.map((item) => {
          const active = enabledSeries[item.id] !== false;
          return (
            <button
              key={item.id}
              type="button"
              className={cn(
                "flex items-center gap-2 rounded-md border border-border/70 bg-muted/40 px-3 py-1.5 text-xs font-medium text-muted-foreground transition-opacity",
                active ? "opacity-100" : "opacity-50",
              )}
              onClick={() =>
                setEnabledSeries((prev) => ({ ...prev, [item.id]: !active }))
              }
              aria-pressed={active}
            >
              <span
                className="inline-block h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: item.color }}
              />
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function formatNumber(value: number) {
  if (!Number.isFinite(value)) return "0";
  return integerFormatter.format(Math.round(value));
}
