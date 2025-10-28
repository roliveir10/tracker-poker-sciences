"use client";

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

type Usage = { tier: 'FREE' | 'LIMITED_50K' | 'UNLIMITED'; used: number; limit: number | null; remaining: number | null };

export default function UpgradeBanner() {
  const [usage, setUsage] = useState<Usage | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch('/api/billing/usage', { credentials: 'include', cache: 'no-store' });
        if (!r.ok) return;
        const j = await r.json();
        if (!cancelled) setUsage(j);
      } catch {
        // ignore
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  if (loading) return null;
  if (!usage) return null;
  const isUnlimited = usage.limit == null;
  const effectiveLimit = usage.limit ?? 0;
  const ratio = isUnlimited ? 0 : usage.used / Math.max(1, effectiveLimit);
  const shouldShow = !isUnlimited && ((usage.remaining ?? 0) <= 0 || ratio >= 0.8);
  if (!shouldShow) return null;

  return (
    <Card className="border-border/70 bg-muted/20 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <div className="text-sm font-medium text-foreground">
            { (usage.remaining ?? 0) <= 0 ? 'Quota atteint' : 'Vous approchez de votre limite' }
          </div>
          <div className="text-xs text-muted-foreground">
            {usage.limit != null ? `${usage.used} / ${usage.limit} mains utilisées sur 30 jours` : `${usage.used} mains`}.
          </div>
        </div>
        <div className="flex gap-2">
          <Button size="sm" onClick={() => { window.location.href = '/pricing'; }}>
            Voir les abonnements
          </Button>
        </div>
      </div>
    </Card>
  );
}

