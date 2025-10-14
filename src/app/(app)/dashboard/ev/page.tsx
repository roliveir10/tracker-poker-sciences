"use client";

import { useEffect, useState } from 'react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';

type Point = { handId: string; handNo: string | null; playedAt: string | null; cumActual: number; cumAdj: number };

export default function EvDashboardPage() {
  const [points, setPoints] = useState<Point[]>([]);
  const [chipEv, setChipEv] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/ev-curve?limit=300')
      .then(async (r) => { if (!r.ok) throw new Error('failed'); return r.json(); })
      .then((data) => { setPoints(normalize(data.points || [])); setChipEv(data.chipEvAdjTotal || 0); })
      .catch(() => setError('Impossible de charger la courbe EV.'));
  }, []);

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-semibold">EV (All-in adjusted)</h1>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="grid grid-cols-2 gap-4">
        <Kpi label="Chip EV (ajusté)" value={formatChips(chipEv)} />
        <Kpi label="Mains" value={points.length} />
      </div>
      <div style={{ width: '100%', height: 360 }}>
        <ResponsiveContainer>
          <LineChart data={[{ handId: '__start__', handNo: null, playedAt: null, cumActual: 0, cumAdj: 0 }, ...points].map((p, i) => ({ ...p, index: i }))}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="index" />
            <YAxis />
            <Tooltip
              formatter={(v: number) => formatChips(v)}
              labelFormatter={(label, payload) => {
                const arr = payload as Array<{ payload: Point & { index: number } }> | undefined;
                const item = arr && arr.length > 0 ? arr[0] : undefined;
                const p: (Point & { index: number }) | undefined = item?.payload;
                if (p?.index === 0) return 'start';
                return (p?.handNo ?? p?.handId ?? String(label)) as string;
              }}
            />
            <Line type="monotone" dataKey="cumActual" stroke="#94a3b8" dot={false} name="Cumul réalisé" />
            <Line type="monotone" dataKey="cumAdj" stroke="#2563eb" dot={false} name="Cumul all-in adj" />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="p-4 rounded border border-gray-200">
      <div className="text-xs text-gray-500">{label}</div>
      <div className="text-xl font-semibold">{value}</div>
    </div>
  );
}

function formatChips(cents: number) {
  return new Intl.NumberFormat('fr-FR').format(cents);
}

function normalize(points: Point[]): Point[] {
  if (!points.length) return points;
  const baseA = points[0].cumActual || 0;
  const baseE = points[0].cumAdj || 0;
  return points.map(p => ({ ...p, cumActual: p.cumActual - baseA, cumAdj: p.cumAdj - baseE }));
}


