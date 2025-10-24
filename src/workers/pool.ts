type MinimalHand = {
  id: string;
  playedAt: string | null;
  heroSeat: number | null;
  winnerSeat: number | null;
  dealtCards?: string | null;
  board?: string | null;
  boardFlop?: string | null;
  boardTurn?: string | null;
  boardRiver?: string | null;
  totalPotCents?: number | null;
  mainPotCents?: number | null;
  actions: Array<{ orderNo: number; seat: number | null; type: 'check'|'fold'|'call'|'bet'|'raise'|'push'; sizeCents: number | null; street: 'preflop'|'flop'|'turn'|'river'; isAllIn?: boolean | null }>;
  players: Array<{ seat: number; isHero?: boolean | null; hole?: string | null; startingStackCents?: number | null }>;
};

type JobIn = { jobId: string; hands: MinimalHand[]; samples: number; seed?: number };
type JobOut = { jobId: string; results: Array<{ id: string; realized: number | null; adjusted: number | null; samples: number }>; durationMs: number };

export class EvWorkerPool {
  private workers: Worker[] = [];
  private queue: Array<{ payload: JobIn; resolve: (v: JobOut) => void; reject: (e: unknown) => void } > = [];
  private inflight = new Map<string, { resolve: (v: JobOut) => void; reject: (e: unknown) => void }>();
  private roundRobin = 0;

  constructor(private url: string | URL, private size = Math.max(1, Math.min(4, Math.floor((navigator as any).hardwareConcurrency ? (navigator as any).hardwareConcurrency / 2 : 2)))) {
    for (let i = 0; i < size; i++) {
      const w = new Worker(this.url as any, { type: 'module' });
      w.onmessage = (evt: MessageEvent<JobOut>) => {
        const out = evt.data;
        const inflight = this.inflight.get(out.jobId);
        if (inflight) {
          this.inflight.delete(out.jobId);
          inflight.resolve(out);
        }
        this.pump();
      };
      w.onerror = (err) => {
        // eslint-disable-next-line no-console
        try {
          // @ts-expect-error different browsers produce different error shapes
          const details = { message: err?.message, filename: err?.filename, lineno: err?.lineno, colno: err?.colno };
          console.error('[EvWorkerPool] worker error', details);
        } catch {
          console.error('[EvWorkerPool] worker error');
        }
      };
      this.workers.push(w);
    }
  }

  private pump() {
    while (this.queue.length > 0) {
      const worker = this.workers[this.roundRobin++ % this.workers.length];
      const next = this.queue.shift();
      if (!next) break;
      this.inflight.set(next.payload.jobId, { resolve: next.resolve, reject: next.reject });
      worker.postMessage(next.payload);
    }
  }

  run(hands: MinimalHand[], samples: number, seed?: number): Promise<JobOut> {
    const jobId = Math.random().toString(36).slice(2);
    const payload: JobIn = { jobId, hands, samples, seed };
    return new Promise<JobOut>((resolve, reject) => {
      this.queue.push({ payload, resolve, reject });
      this.pump();
    });
  }

  terminate() {
    for (const w of this.workers) w.terminate();
    this.workers = [];
    this.inflight.clear();
    this.queue = [];
  }
}


