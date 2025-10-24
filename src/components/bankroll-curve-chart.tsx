"use client";

import { useEffect, useMemo, useRef, useState, Fragment } from "react";
import { ResponsiveLine } from "@nivo/line";
import { cn } from "@/lib/utils";

type Point = { tournamentId: string; startedAt: string | null; cumProfitCents: number; cumExpectedCents?: number };
type ApiResponse = { points?: Point[] };

const CHART_MARGIN = { top: 48, right: 72, bottom: 56, left: 32 } as const;

const chartTheme = {
  background: "transparent",
  textColor: "#f8fafc",
  fontSize: 12,
  fontFamily: "var(--font-inter), sans-serif",
  axis: {
    domain: { line: { stroke: "transparent" } },
    ticks: { line: { stroke: "transparent" }, text: { fill: "#f8fafc", fontFamily: "var(--font-inter), sans-serif", fontSize: 12, fontWeight: 500 } },
    legend: { text: { fill: "#f8fafc", fontFamily: "var(--font-inter), sans-serif", fontSize: 12, fontWeight: 500 } },
  },
  grid: { line: { stroke: "#f8fafcbf", strokeWidth: 1.5, strokeLinecap: "round" } },
  legends: { text: { fill: "#f8fafc", fontFamily: "var(--font-inter), sans-serif", fontSize: 12, fontWeight: 500 } },
} as const;

const integerFormatter = new Intl.NumberFormat("en-US");
const euroFormatter = new Intl.NumberFormat("en-US", { style: "currency", currency: "EUR" });
const SERIES_STORAGE_KEY = 'bankroll-curve:series:v1';

const safeLocalStorage = () => {
  if (typeof window === 'undefined' || typeof window.localStorage === 'undefined') return null;
  return window.localStorage;
};

const loadBankrollSettings = () => {
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

const persistBankrollSettings = (value: Record<string, boolean>) => {
  try {
    const storage = safeLocalStorage();
    if (storage) storage.setItem(SERIES_STORAGE_KEY, JSON.stringify(value));
  } catch {
    // ignore
  }
};

export function BankrollCurveChart({ className, period, dateFrom, dateTo, hoursFrom, hoursTo, buyIns }: { className?: string; period?: 'today' | 'yesterday' | 'this-week' | 'this-month'; dateFrom?: string; dateTo?: string; hoursFrom?: string; hoursTo?: string; buyIns?: number[] }) {
  const [points, setPoints] = useState<Point[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const chartRef = useRef<HTMLDivElement | null>(null);
  const [hoverPosition, setHoverPosition] = useState<{ x: number; y: number } | null>(null);
  const [isHoverPinned, setIsHoverPinned] = useState<boolean>(false);
  const yScaleRef = useRef<((value: number) => number) | null>(null);
  const xScaleRef = useRef<((value: number) => number) | null>(null);
  const innerHeightRef = useRef<number>(0);
  const innerWidthRef = useRef<number>(0);
  const [measureStartY, setMeasureStartY] = useState<number | null>(null);
  const [measureCurrentY, setMeasureCurrentY] = useState<number | null>(null);
  const saved = loadBankrollSettings();
  const [enabledSeries, setEnabledSeries] = useState<Record<string, boolean>>(() => ({
    '$ Won': saved?.['$ Won'] ?? true,
    'Net Expected $ Won': saved?.['Net Expected $ Won'] ?? true,
  }));
  useEffect(() => {
    persistBankrollSettings(enabledSeries);
  }, [enabledSeries]);

  useEffect(() => {
    const controller = new AbortController();
    setIsLoading(true);
    setError(null);
    setPoints([]);
    (async () => {
      try {
        const qs = new URLSearchParams();
        if (period) qs.set('period', period);
        if (dateFrom) qs.set('dateFrom', dateFrom);
        if (dateTo) qs.set('dateTo', dateTo);
        if (hoursFrom) qs.set('hoursFrom', hoursFrom);
        if (hoursTo) qs.set('hoursTo', hoursTo);
        if (Array.isArray(buyIns)) for (const b of buyIns) qs.append('buyIns', String(b));
        const url = `/api/bankroll-curve${qs.size ? `?${qs.toString()}` : ''}`;
        const res = await fetch(url, { signal: controller.signal, cache: 'no-store' });
        if (!res.ok) throw new Error('failed');
        const payload: ApiResponse = await res.json();
        setPoints((payload.points ?? []).map((p) => ({ ...p })));
        setIsLoading(false);
      } catch {
        if (!controller.signal.aborted) {
          setError('Unable to load bankroll curve.');
          setIsLoading(false);
        }
      }
    })();
    return () => controller.abort();
  }, [period, dateFrom, dateTo, hoursFrom, hoursTo, buyIns]);

  const serie = useMemo(() => {
    const base = [{ cumProfitCents: 0, cumExpectedCents: 0 }, ...points];
    return [
      { id: '$ Won', data: base.map((p, i) => ({ x: i, y: (p.cumProfitCents ?? 0) / 100 })) },
      { id: 'Net Expected $ Won', data: base.map((p, i) => ({ x: i, y: (p.cumExpectedCents ?? 0) / 100 })) },
    ];
  }, [points]);
  const chartSeries = useMemo(() => serie.filter((s) => enabledSeries[String(s.id)] !== false), [serie, enabledSeries]);

  const endIndex = useMemo(() => {
    const src = chartSeries[0] ?? serie[0];
    if (!src || !src.data.length) return 0;
    const last = src.data[src.data.length - 1];
    return typeof last.x === 'number' ? (last.x as number) : 0;
  }, [chartSeries, serie]);
  const xTickValues = useMemo(() => {
    if (!Number.isFinite(endIndex) || endIndex <= 0) return undefined;
    const maxTicks = 8;
    if (endIndex <= maxTicks) {
      const ticks = Array.from({ length: endIndex + 1 }, (_, i) => i);
      if (ticks.length >= 2) {
        const prev = ticks[ticks.length - 2] as number;
        const gap = endIndex - prev;
        if (gap <= 1) ticks.splice(ticks.length - 2, 1);
      }
      return ticks;
    }
    const step = Math.max(1, Math.round(endIndex / maxTicks));
    const ticks: number[] = [];
    for (let v = 0; v <= endIndex; v += step) ticks.push(v);
    if (ticks[ticks.length - 1] !== endIndex) ticks.push(endIndex);
    if (ticks.length >= 2) {
      const prev = ticks[ticks.length - 2];
      const minGap = Math.max(1, Math.floor(step * 0.6));
      if (endIndex - prev < minGap) ticks.splice(ticks.length - 2, 1);
    }
    return ticks;
  }, [endIndex]);

  const hasData = serie[0]?.data.length > 1;

  const handleMouseMove = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!chartRef.current) return;
    const rect = chartRef.current.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    const x = Math.min(Math.max(event.clientX - rect.left, 0), rect.width);
    const y = Math.min(Math.max(event.clientY - rect.top, 0), rect.height);
    const withinX = x >= CHART_MARGIN.left && x <= rect.width - CHART_MARGIN.right;
    const withinY = y >= CHART_MARGIN.top && y <= rect.height - CHART_MARGIN.bottom;
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
    if (measureStartY !== null) setMeasureCurrentY(y);
  };

  const handleMouseLeave = () => {
    if (!isHoverPinned) setHoverPosition(null);
  };

  const handleMouseDown = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!chartRef.current) return;
    const rect = chartRef.current.getBoundingClientRect();
    const y = Math.min(Math.max(event.clientY - rect.top, 0), rect.height);
    const withinY = y >= CHART_MARGIN.top && y <= rect.height - CHART_MARGIN.bottom;
    if (!withinY) return;
    setIsHoverPinned(true);
    setMeasureStartY(y);
    setMeasureCurrentY(y);
  };

  useEffect(() => {
    const onUp = () => {
      if (measureStartY !== null) {
        setMeasureStartY(null);
        setMeasureCurrentY(null);
      }
      if (isHoverPinned) setIsHoverPinned(false);
    };
    if (measureStartY !== null) window.addEventListener('mouseup', onUp);
    return () => window.removeEventListener('mouseup', onUp);
  }, [measureStartY, isHoverPinned]);

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
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</div>
      )}
      {hasData ? (
        <>
          <div className="flex-1 rounded-xl border border-border/70 bg-card shadow-lg shadow-black/40" style={{ minHeight: 320 }}>
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
                yScale={{ type: 'linear', min: 'auto', max: 'auto', stacked: false, reverse: false }}
                layers={[
                  'grid',
                  'markers',
                  'axes',
                  'areas',
                  'lines',
                  'points',
                  'slices',
                  'mesh',
                  'legends',
                  LayerCapture,
                ]}
                axisBottom={{ legend: 'Tournaments', legendOffset: 40, tickValues: xTickValues, format: (v) => integerFormatter.format(Number(v)) }}
                axisLeft={null}
              axisRight={{ legend: 'EUR', legendOffset: 60, legendPosition: 'middle', format: (v) => euroFormatter.format(Number(v)) }}
                enableGridX={false}
                enableGridY
                gridYValues={[0]}
              colors={({ id }) => (String(id) === '$ Won' ? '#3b82f6' : '#fb923c')}
                lineWidth={2}
                enablePoints={false}
                enableSlices={false}
                enableCrosshair={false}
                animate={false}
                tooltip={({ point }) => {
                  const rawSeriesId = (point as { seriesId?: string | number }).seriesId;
                  const serieId = String(rawSeriesId ?? point.id);
                  const y = typeof point.data.y === 'number' ? point.data.y : Number(point.data.y);
                  const tournamentIdx = typeof point.data.x === 'number' ? point.data.x : Number(point.data.x);
                  const source = points[tournamentIdx - 1] ?? null;
                  return (
                    <div className="rounded-md border border-border/70 bg-card px-3 py-2 text-xs text-muted-foreground">
                      <div className="font-semibold text-primary">{source?.tournamentId}</div>
                      <div className="text-muted-foreground">
                        {source?.startedAt ? new Date(source.startedAt).toLocaleDateString() : 'N/A'}
                      </div>
                      <div className="font-semibold text-primary">
                        {serieId === '$ Won' ? euroFormatter.format(y) : euroFormatter.format(y)}
                      </div>
                    </div>
                  );
                }}
              />) : (
                <div className="absolute inset-0 flex items-center justify-center text-xs text-muted-foreground">Enable at least one series to display the chart.</div>
              )}
              {measureStartY !== null && measureCurrentY !== null ? (
                (() => {
                  const top = Math.min(measureStartY, measureCurrentY);
                  const bottom = Math.max(measureStartY, measureCurrentY);
                  const height = bottom - top;
                  const toValue = (py: number) => {
                    const yScale = yScaleRef.current;
                    const innerH = innerHeightRef.current || 0;
                    if (!yScale || innerH <= 0) return 0;
                    const innerY = Math.min(Math.max(py - CHART_MARGIN.top, 0), innerH);
                    const scaleWithInvert = yScale as unknown as { invert?: (value: number) => number; domain?: () => [number, number]; range?: () => [number, number] };
                    if (typeof scaleWithInvert.invert === 'function') {
                      return scaleWithInvert.invert(innerY);
                    }
                    const domain = scaleWithInvert.domain ? scaleWithInvert.domain() : [0, 0];
                    const range = scaleWithInvert.range ? scaleWithInvert.range() : [0, innerH];
                    const [d0, d1] = domain as [number, number];
                    const [r0, r1] = range as [number, number];
                    const t = r1 === r0 ? 0 : (innerY - r0) / (r1 - r0);
                    return d0 + t * (d1 - d0);
                  };
                  const delta = Math.abs(toValue(bottom) - toValue(top));
                  const labelY = top + height / 2;
                  return (
                    <>
                      <div
                        className="pointer-events-none absolute bg-primary/20"
                        style={{ left: `${CHART_MARGIN.left}px`, right: `${CHART_MARGIN.right}px`, top: `${top}px`, height: `${height}px` }}
                      />
                      <div
                        className="pointer-events-none absolute h-px bg-primary"
                        style={{ left: `${CHART_MARGIN.left}px`, right: `${CHART_MARGIN.right}px`, top: `${top}px`, transform: 'translateY(-0.5px)' }}
                      />
                      <div
                        className="pointer-events-none absolute h-px bg-primary"
                        style={{ left: `${CHART_MARGIN.left}px`, right: `${CHART_MARGIN.right}px`, top: `${bottom}px`, transform: 'translateY(-0.5px)' }}
                      />
                      <div
                        className="pointer-events-none absolute -translate-y-1/2 rounded bg-primary px-2 py-0.5 text-[10px] font-semibold text-primary-foreground shadow"
                        style={{ left: `${CHART_MARGIN.left + 8}px`, top: `${labelY}px` }}
                      >
                        {euroFormatter.format(Math.round(delta))}
                      </div>
                    </>
                  );
                })()
              ) : null}
              {hoverPosition ? (
                <>
                  <div
                    className="pointer-events-none absolute w-px bg-primary"
                    style={{ left: `${hoverPosition.x}px`, top: `${CHART_MARGIN.top}px`, bottom: `${CHART_MARGIN.bottom}px`, opacity: 0.75, transform: 'translateX(-0.5px)' }}
                  />
                  <div
                    className="pointer-events-none absolute h-px bg-primary"
                    style={{ top: `${hoverPosition.y}px`, left: `${CHART_MARGIN.left}px`, right: `${CHART_MARGIN.right}px`, opacity: 0.75, transform: 'translateY(-0.5px)' }}
                  />
                  {(() => {
                    const yScale = yScaleRef.current;
                    const xScale = xScaleRef.current;
                    const innerW = innerWidthRef.current || 0;
                    const innerH = innerHeightRef.current || 0;
                    if (!yScale || !xScale || innerW <= 0 || innerH <= 0) return null;

                    const innerX = Math.min(Math.max(hoverPosition.x - CHART_MARGIN.left, 0), innerW);
                    const ratio = innerW > 0 ? innerX / innerW : 0;
                    const maxIndex = endIndex;
                    const idx = Math.min(Math.max(Math.round(ratio * maxIndex), 0), maxIndex);

                    const items: Array<{ id: string; value: number; px: number; py: number; color: string }> = [];
                    for (const s of chartSeries) {
                      const dataPoint = s.data[idx];
                      if (!dataPoint) continue;
                      const xValue = typeof dataPoint.x === 'number' ? dataPoint.x : Number(dataPoint.x);
                      const yValue = typeof dataPoint.y === 'number' ? dataPoint.y : Number(dataPoint.y);
                      if (!Number.isFinite(xValue) || !Number.isFinite(yValue)) continue;
                      const value = yValue;
                      const yPxInner = yScale(value);
                      const py = CHART_MARGIN.top + yPxInner;
                      let px: number;
                      try {
                        const sx = typeof xScale === 'function' ? xScale(xValue) : null;
                        px = CHART_MARGIN.left + (typeof sx === 'number' ? sx : innerX);
                      } catch {
                        px = CHART_MARGIN.left + innerX;
                      }
                      const color = String(s.id) === '$ Won' ? '#3b82f6' : '#fb923c';
                      items.push({ id: String(s.id), value, px, py, color });
                    }
                    if (items.length === 0) return null;
                    return (
                      <>
                        {items.map((it) => {
                          const label = euroFormatter.format(it.value);
                          const labelLeft = it.px + 8;
                          const labelTop = it.py - 10;
                          return (
                            <Fragment key={`br-${it.id}`}>
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
          <div className="flex flex-wrap items-center justify-center gap-2">
            {[{ id: '$ Won', color: '#3b82f6', label: '$ Won' }, { id: 'Net Expected $ Won', color: '#fb923c', label: 'Net Expected $ Won' }].map((item) => {
              const active = enabledSeries[item.id] !== false;
              return (
                <button
                  key={item.id}
                  type="button"
                  className={"flex items-center gap-2 rounded-md border border-border/70 bg-muted/40 px-3 py-1.5 text-xs font-medium text-muted-foreground transition-opacity " + (active ? "opacity-100" : "opacity-50")}
                  onClick={() => setEnabledSeries((prev) => ({ ...prev, [item.id]: !active }))}
                  aria-pressed={active}
                >
                  <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>
        </>
      ) : (
        <div className="flex-1 rounded-xl border border-border/70 bg-card shadow-lg shadow-black/40" style={{ minHeight: 320 }}>
          {isLoading ? (
            <div className="flex h-full items-center justify-center gap-2 text-sm text-muted-foreground">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-muted-foreground/40 border-t-primary" />
              <span>Loading bankroll…</span>
            </div>
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">No data to display yet.</div>
          )}
        </div>
      )}
    </div>
  );
}


