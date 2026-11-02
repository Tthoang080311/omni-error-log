import {
  ErrorLogItem,
  DashboardAnalytics,
  WhyCode,
  ProcessBreakpoint,
} from '@/types/error-log';
import {
  WHY_DICTIONARY,
  PROCESS_BREAKPOINTS,
  LEITNER_INTERVAL_DAYS,
} from '@/constants/taxonomy';

const SUPABASE_PROJECT_URL = 'https://igetygmsrksbhfhismat.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlnZXR5Z21zcmtzYmhmaGlzbWF0Iiwicm9sZSI6ImFub24iOjE3OTIyODg5MTAsImV4cCI6MjEwNzg2NDkxMH0.KsK-fHAZrArAFzYgqXr96Ni9mClWxGJPGd9E88yCXD4';
const SUPABASE_TABLE_ENDPOINT = `${SUPABASE_PROJECT_URL}/rest/v1/error_logs`;

function getSupabaseHeaders() {
  return {
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    'Content-Type': 'application/json',
  };
}

function addDaysToDate(dateStr: string, days: number): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

export function getTodayDateString(): string {
  return new Date().toISOString().split('T')[0];
}

export async function getAllErrorLogs(): Promise<ErrorLogItem[]> {
  try {
    const res = await fetch(
      `${SUPABASE_TABLE_ENDPOINT}?select=id,updated_at,payload&order=updated_at.desc`,
      {
        method: 'GET',
        headers: getSupabaseHeaders(),
        cache: 'no-store',
      }
    );
    if (res.ok) {
      const rows = (await res.json()) as Array<{ payload: ErrorLogItem }>;
      return rows.map((r) => r.payload).filter(Boolean);
    }
  } catch {
    // Fallback
  }
  return [];
}

export async function getErrorLogById(id: string): Promise<ErrorLogItem | null> {
  const logs = await getAllErrorLogs();
  return logs.find((l) => l.id === id) || null;
}

export async function upsertErrorLog(item: ErrorLogItem): Promise<ErrorLogItem> {
  try {
    await fetch(SUPABASE_TABLE_ENDPOINT, {
      method: 'POST',
      headers: {
        ...getSupabaseHeaders(),
        Prefer: 'resolution=merge-duplicates,return=minimal',
      },
      body: JSON.stringify({
        id: item.id,
        updated_at: item.updatedAt,
        payload: item,
      }),
      cache: 'no-store',
    });
  } catch {
    // Fallback
  }
  return item;
}

export async function deleteErrorLog(id: string): Promise<boolean> {
  try {
    await fetch(`${SUPABASE_TABLE_ENDPOINT}?id=eq.${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: getSupabaseHeaders(),
      cache: 'no-store',
    });
  } catch {
    // Fallback
  }
  return true;
}

export async function updateLeitnerReview(
  id: string,
  rememberedCorrectly: boolean
): Promise<ErrorLogItem | null> {
  const existing = await getErrorLogById(id);
  if (!existing) return null;

  const today = getTodayDateString();
  const nextBox = rememberedCorrectly
    ? (Math.min(5, existing.leitnerBox + 1) as 1 | 2 | 3 | 4 | 5)
    : 1;
  const intervalDays = LEITNER_INTERVAL_DAYS[nextBox];

  const updated: ErrorLogItem = {
    ...existing,
    updatedAt: new Date().toISOString(),
    leitnerBox: nextBox,
    nextReviewDate: addDaysToDate(today, intervalDays),
    reviewCount: existing.reviewCount + 1,
    isResolved: nextBox >= 4 && rememberedCorrectly,
  };

  return await upsertErrorLog(updated);
}

export function computeDashboardAnalytics(logs: ErrorLogItem[]): DashboardAnalytics {
  const totalLogs = logs.length;
  const today = getTodayDateString();

  if (totalLogs === 0) {
    return {
      totalLogs: 0,
      resolvedCount: 0,
      dueTodayCount: 0,
      carelessTaxPercent: 0,
      subjectCarelessBreakdown: [],
      paretoWhyDistribution: [],
      breakpointFunnel: PROCESS_BREAKPOINTS.map((b) => ({
        stage: b.id,
        label: b.title,
        count: 0,
        percentage: 0,
      })),
    };
  }

  const resolvedCount = logs.filter((l) => l.isResolved).length;
  const dueTodayCount = logs.filter(
    (l) => !l.isResolved && l.nextReviewDate <= today
  ).length;

  const logsWithCareless = logs.filter((l) =>
    l.whyCodes.some((code) => code.startsWith('A'))
  );
  const carelessTaxPercent = Math.round((logsWithCareless.length / totalLogs) * 100);

  const subjectMap = new Map<
    string,
    { total: number; carelessCount: number; knowledgeCount: number; trapCount: number }
  >();

  for (const log of logs) {
    const current = subjectMap.get(log.subjectName) || {
      total: 0,
      carelessCount: 0,
      knowledgeCount: 0,
      trapCount: 0,
    };
    current.total += 1;
    if (log.whyCodes.some((c) => c.startsWith('A'))) current.carelessCount += 1;
    if (log.whyCodes.some((c) => c.startsWith('B'))) current.knowledgeCount += 1;
    if (log.whyCodes.some((c) => c.startsWith('C'))) current.trapCount += 1;
    subjectMap.set(log.subjectName, current);
  }

  const subjectCarelessBreakdown = Array.from(subjectMap.entries()).map(
    ([subjectName, stats]) => ({
      subjectName,
      ...stats,
      carelessPercent: Math.round((stats.carelessCount / stats.total) * 100),
    })
  );

  const whyCounter = new Map<WhyCode, number>();
  let totalWhyTagsSelected = 0;

  for (const log of logs) {
    for (const code of log.whyCodes) {
      whyCounter.set(code, (whyCounter.get(code) || 0) + 1);
      totalWhyTagsSelected += 1;
    }
  }

  const sortedWhyEntries = Array.from(whyCounter.entries()).sort(
    (a, b) => b[1] - a[1]
  );

  let runningCumulative = 0;
  const paretoWhyDistribution = sortedWhyEntries.map(([code, count]) => {
    const def = WHY_DICTIONARY.find((d) => d.code === code);
    const percentage =
      totalWhyTagsSelected > 0
        ? Math.round((count / totalWhyTagsSelected) * 1000) / 10
        : 0;
    runningCumulative = Math.min(
      100,
      Math.round((runningCumulative + percentage) * 10) / 10
    );

    return {
      code,
      label: def ? def.title : code,
      group: def ? def.group : 'GROUP_A_CARELESS',
      count,
      percentage,
      cumulativePercentage: runningCumulative,
    };
  });

  const stageCounts = new Map<ProcessBreakpoint, number>();
  for (const log of logs) {
    stageCounts.set(
      log.processBreakpoint,
      (stageCounts.get(log.processBreakpoint) || 0) + 1
    );
  }

  const breakpointFunnel = PROCESS_BREAKPOINTS.map((bp) => {
    const count = stageCounts.get(bp.id) || 0;
    return {
      stage: bp.id,
      label: bp.title,
      count,
      percentage: Math.round((count / totalLogs) * 100),
    };
  });

  return {
    totalLogs,
    resolvedCount,
    dueTodayCount,
    carelessTaxPercent,
    subjectCarelessBreakdown,
    paretoWhyDistribution,
    breakpointFunnel,
  };
}
