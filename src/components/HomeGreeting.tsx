"use client";

import { useEffect, useState } from "react";
import { getMemberstackClient } from "@/lib/msClient";

type MemberstackMemberCandidate = {
  data?: Record<string, unknown> | null;
  customFields?: Record<string, unknown> | null;
  fullName?: unknown;
  name?: unknown;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const readString = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const readFromRecord = (record: Record<string, unknown> | null | undefined, key: string): string | null => {
  if (!record) return null;
  return readString(record[key]);
};

const pickMemberFromResponse = (input: unknown): MemberstackMemberCandidate | null => {
  if (!isRecord(input)) return null;
  if ("data" in input && isRecord((input as { data?: unknown }).data)) {
    return pickMemberFromResponse((input as { data?: unknown }).data);
  }
  return input as MemberstackMemberCandidate;
};

export default function HomeGreeting({ initialName }: { initialName: string }) {
  const [name, setName] = useState<string>(initialName);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const ms = await getMemberstackClient();
        if (!ms) return;
        // Tente de récupérer le membre courant pour obtenir le pseudo (champ personnalisé "Pseudo")
        try {
          const response = await ms.getCurrentMember?.({ useCache: true });
          const candidate = pickMemberFromResponse(response);
          if (!candidate) return;
          const data = isRecord(candidate.data) ? candidate.data : null;
          const customFields = isRecord(candidate.customFields) ? candidate.customFields : null;
          const pseudo =
            readFromRecord(data, "Pseudo") ??
            readFromRecord(data, "pseudo") ??
            readFromRecord(customFields, "Pseudo") ??
            readFromRecord(customFields, "pseudo");
          const fullName =
            readString(candidate.fullName) ??
            readString(candidate.name) ??
            readFromRecord(data, "fullName");
          const preferred = pseudo ?? fullName ?? null;
          if (!cancelled && preferred) {
            setName(preferred);
          }
        } catch {}
      } catch {}
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <h1 className="text-3xl font-semibold tracking-tight text-foreground">Bonjour, {name} 👋</h1>
  );
}

