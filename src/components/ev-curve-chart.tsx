"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
} from "react";
// Remove strict Theme typing to avoid version mismatch issues
import { ResponsiveLine } from "@nivo/line";
import { cn } from "@/lib/utils";

type CurvePoint = {
  handId: string;
  handNo: string | null;
  playedAt: string | null;
  cumActual: number;
  cumAdj: number;
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
  "Net Expected Chips Won": "#facc15",
};

export function EvCurveChart({ className, period, dateFrom, dateTo, hoursFrom, hoursTo }: { className?: string; period?: 'today' | 'yesterday' | 'this-week' | 'this-month'; dateFrom?: string; dateTo?: string; hoursFrom?: string; hoursTo?: string }) {
  const [points, setPoints] = useState<CurvePoint[]>([]);
  const [error, setError] = useState<string | null>(null);
  const chartRef = useRef<HTMLDivElement | null>(null);
  const [hoverPosition, setHoverPosition] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const [measureStartY, setMeasureStartY] = useState<number | null>(null);
  const [measureCurrentY, setMeasureCurrentY] = useState<number | null>(null);
  const yScaleRef = useRef<any>(null);
  const innerHeightRef = useRef<number>(0);

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
      setHoverPosition(null);
      return;
    }

    setHoverPosition({ x, y });
    if (measureStartY !== null) {
      setMeasureCurrentY(y);
    }
  };

  const handleMouseLeave = () => {
    setHoverPosition(null);
  };

  const handleMouseDown = (event: ReactMouseEvent<HTMLDivElement>) => {
    if (!chartRef.current) return;
    const rect = chartRef.current.getBoundingClientRect();
    const y = clampValue(event.clientY - rect.top, 0, rect.height);
    const withinY = y >= CHART_MARGIN.top && y <= rect.height - CHART_MARGIN.bottom;
    if (!withinY) return;
    setMeasureStartY(y);
    setMeasureCurrentY(y);
  };

  useEffect(() => {
    const handleWindowMouseUp = () => {
      if (measureStartY !== null) {
        setMeasureStartY(null);
        setMeasureCurrentY(null);
      }
    };
    if (measureStartY !== null) {
      window.addEventListener("mouseup", handleWindowMouseUp);
    }
    return () => {
      window.removeEventListener("mouseup", handleWindowMouseUp);
    };
  }, [measureStartY]);

  useEffect(() => {
    const controller = new AbortController();

    const loadData = async () => {
      try {
        const qs = new URLSearchParams();
        if (period) qs.set('period', period);
        if (dateFrom) qs.set('dateFrom', dateFrom);
        if (dateTo) qs.set('dateTo', dateTo);
        if (hoursFrom) qs.set('hoursFrom', hoursFrom);
        if (hoursTo) qs.set('hoursTo', hoursTo);
        const url = `/api/ev-curve${qs.size ? `?${qs.toString()}` : ''}`;
        const response = await fetch(url, {
          signal: controller.signal,
          cache: "no-store",
        });
        if (!response.ok) throw new Error("failed");
        const payload: ApiResponse = await response.json();
        setPoints(payload.points ?? []);
        setError(null);
      } catch (err) {
        if (!controller.signal.aborted) {
          setError("Unable to load the EV chart.");
        }
      }
    };

    loadData();
    return () => controller.abort();
  }, [period, dateFrom, dateTo, hoursFrom, hoursTo]);

  const chartSeries = useMemo(() => {
    const base = [{ cumActual: 0, cumAdj: 0 }, ...points];
    const series: ChartSerie[] = [
      {
        id: "Chips Won",
        data: base.map((point, index) => ({
          x: index,
          y: typeof point.cumActual === "number" ? point.cumActual : 0,
        })),
      },
      {
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
      },
    ] satisfies ChartSerie[];
    return series;
  }, [points]);

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
      return Array.from({ length: endIndex + 1 }, (_, index) => index);
    }

    const step = Math.max(1, Math.round(endIndex / maxTicks));
    const ticks: number[] = [];
    for (let value = 0; value <= endIndex; value += step) {
      ticks.push(value);
    }
    if (ticks[ticks.length - 1] !== endIndex) ticks.push(endIndex);
    return ticks;
  }, [endIndex]);

  const hasData = chartSeries.some((serie) => serie.data.length > 1);

  const legendItems = useMemo(
    () => [
      { id: "Chips Won", label: "Chips Won", color: SERIES_COLORS["Chips Won"] },
      {
        id: "Net Expected Chips Won",
        label: "Net Expected Chips Won",
        color: SERIES_COLORS["Net Expected Chips Won"],
      },
    ],
    [],
  );

  return (
    <div className={cn("flex h-full w-full flex-col gap-4", className)}>
      {error && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      {hasData ? (
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
                  // Capture the yScale used by Nivo to map pixels<->values for precise measurement
                  ((props: any) => {
                    yScaleRef.current = props.yScale;
                    innerHeightRef.current = props.innerHeight;
                    return null;
                  }) as any,
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
                enablePoints={false}
                pointSize={9}
                pointColor={{ theme: "background" }}
                pointBorderWidth={2}
                pointBorderColor={{ from: "serieColor" }}
                pointLabelYOffset={-12}
                enableSlices={false}
                enableCrosshair={false}
                enableTouchCrosshair={false}
                sliceTooltip={() => null}
                tooltip={() => null}
                animate={false}
              />
              {measureStartY !== null && measureCurrentY !== null ? (
                (() => {
                  const top = Math.min(measureStartY, measureCurrentY);
                  const bottom = Math.max(measureStartY, measureCurrentY);
                  const height = bottom - top;
                  const toValue = (py: number) => {
                    const yScale = yScaleRef.current;
                    const innerH = innerHeightRef.current || 0;
                    if (!yScale || typeof yScale.invert !== "function" || innerH <= 0) return 0;
                    const innerY = clampValue(py - CHART_MARGIN.top, 0, innerH);
                    return yScale.invert(innerY);
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
                </>
              ) : null}
            </div>
          </div>
          <div className="flex items-center justify-center gap-6 rounded-lg border border-border/70 bg-muted/40 px-6 py-3 text-xs font-medium text-muted-foreground">
            {legendItems.map((item) => (
              <div key={item.id} className="flex items-center gap-3">
                <span
                  className="inline-block h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: item.color }}
                />
                <span>{item.label}</span>
              </div>
            ))}
          </div>
        </>
      ) : (
        <div
          className="flex-1 rounded-xl border border-border/70 bg-card shadow-lg shadow-black/40"
          style={{ minHeight: 320 }}
        >
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            No data to display yet.
          </div>
        </div>
      )}
    </div>
  );
}

function formatNumber(value: number) {
  if (!Number.isFinite(value)) return "0";
  return integerFormatter.format(Math.round(value));
}
