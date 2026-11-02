import path from 'path';
import fs from 'fs';
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

function getStorageFilePath(): string {
  const isVercel = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
  const baseDir = isVercel ? '/tmp' : path.join(process.cwd(), 'data');
  try {
    if (!fs.existsSync(baseDir)) {
      fs.mkdirSync(baseDir, { recursive: true });
    }
  } catch {
    return '/tmp/error_logs.json';
  }
  return path.join(baseDir, 'error_logs.json');
}

function addDaysToDate(dateStr: string, days: number): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

export function getTodayDateString(): string {
  return new Date().toISOString().split('T')[0];
}

function readLocalCache(): ErrorLogItem[] {
  const filePath = getStorageFilePath();
  try {
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, JSON.stringify([], null, 2), 'utf-8');
      return [];
    }
    const raw = fs.readFileSync(filePath, 'utf-8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeLocalCache(logs: ErrorLogItem[]): void {
  const filePath = getStorageFilePath();
  try {
    fs.writeFileSync(filePath, JSON.stringify(logs, null, 2), 'utf-8');
  } catch {
    // Ignore
  }
}

function getSupabaseConfig(headers?: Headers | Record<string, string>) {
  let url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  let key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (headers) {
    const customUrl = headers instanceof Headers ? headers.get('x-supabase-url') : headers['x-supabase-url'];
    const customKey = headers instanceof Headers ? headers.get('x-supabase-key') : headers['x-supabase-key'];
    if (customUrl) url = customUrl;
    if (customKey) key = customKey;
  }

  const cleanUrl = (url || '').replace(/\/rest\/v1\/?$/, '').replace(/\/$/, '');
  return {
    endpoint: cleanUrl ? `${cleanUrl}/rest/v1/error_logs` : '',
    headers: {
      apikey: key || '',
      Authorization: `Bearer ${key || ''}`,
      'Content-Type': 'application/json',
    },
  };
}

export async function getAllErrorLogs(headers?: Headers | Record<string, string>): Promise<ErrorLogItem[]> {
  const { endpoint, headers: sbHeaders } = getSupabaseConfig(headers);
  if (endpoint && sbHeaders.apikey) {
    try {
      const res = await fetch(`${endpoint}?select=id,updated_at,payload&order=updated_at.desc`, {
        method: 'GET',
        headers: sbHeaders,
        cache: 'no-store',
      });
      if (res.ok) {
        const rows = (await res.json()) as Array<{ payload: ErrorLogItem }>;
        const cloudLogs = rows.map((r) => r.payload).filter(Boolean);
        writeLocalCache(cloudLogs);
        return cloudLogs;
      }
    } catch {
      // Fallback local
    }
  }
  return readLocalCache().sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

async function pushToSupabase(item: ErrorLogItem, headers?: Headers | Record<string, string>) {
  const { endpoint, headers: sbHeaders } = getSupabaseConfig(headers);
  if (!endpoint || !sbHeaders.apikey) return;
  try {
    await fetch(endpoint, {
      method: 'POST',
      headers: { ...sbHeaders, Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify({ id: item.id, updated_at: item.updatedAt, payload: item }),
      cache: 'no-store',
    });
  } catch {
    // Ignore
  }
}

export async function getErrorLogById(id: string, headers?: Headers | Record<string, string>): Promise<ErrorLogItem | null> {
  const logs = await getAllErrorLogs(headers);
  return logs.find((l) => l.id === id) || null;
}

export async function upsertErrorLog(item: ErrorLogItem, headers?: Headers | Record<string, string>): Promise<ErrorLogItem> {
  await pushToSupabase(item, headers);
  const logs = readLocalCache();
  const idx = logs.findIndex((l) => l.id === item.id);
  if (idx >= 0) {
    logs[idx] = item;
  } else {
    logs.unshift(item);
  }
  writeLocalCache(logs);
  return item;
}

export async function deleteErrorLog(id: string, headers?: Headers | Record<string, string>): Promise<boolean> {
  const { endpoint, headers: sbHeaders } = getSupabaseConfig(headers);
  if (endpoint && sbHeaders.apikey) {
    try {
      await fetch(`${endpoint}?id=eq.${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers: sbHeaders,
        cache: 'no-store',
      });
    } catch {
      // Ignore
    }
  }
  const logs = readLocalCache();
  const next = logs.filter((l) => l.id !== id);
  writeLocalCache(next);
  return true;
}

export async function updateLeitnerReview(id: string, rememberedCorrectly: boolean, headers?: Headers | Record<string, string>): Promise<ErrorLogItem | null> {
  const existing = await getErrorLogById(id, headers);
  if (!existing) return null;
  const today = getTodayDateString();
  const nextBox = rememberedCorrectly ? (Math.min(5, existing.leitnerBox + 1) as 1 | 2 | 3 | 4 | 5) : 1;
  const intervalDays = LEITNER_INTERVAL_DAYS[nextBox];
  const updated: ErrorLogItem = {
    ...existing,
    updatedAt: new Date().toISOString(),
    leitnerBox: nextBox,
    nextReviewDate: addDaysToDate(today, intervalDays),
    reviewCount: existing.reviewCount + 1,
    isResolved: nextBox >= 4 && rememberedCorrectly,
  };
  return await upsertErrorLog(updated, headers);
}

export function computeDashboardAnalytics(logs: ErrorLogItem[]): DashboardAnalytics {
  const totalLogs = logs.length;
  const today = getTodayDateString();
  if (totalLogs === 0) {
    return {
      totalLogs: 0, resolvedCount: 0, dueTodayCount: 0, carelessTaxPercent: 0,
      subjectCarelessBreakdown: [], paretoWhyDistribution: [],
      breakpointFunnel: PROCESS_BREAKPOINTS.map((b) => ({ stage: b.id, label: b.title, count: 0, percentage: 0 })),
    };
  }
  const resolvedCount = logs.filter((l) => l.isResolved).length;
  const dueTodayCount = logs.filter((l) => !l.isResolved && l.nextReviewDate <= today).length;
  const logsWithCareless = logs.filter((l) => l.whyCodes.some((code) => code.startsWith('A')));
  const carelessTaxPercent = Math.round((logsWithCareless.length / totalLogs) * 100);

  const subjectMap = new Map<string, { total: number; carelessCount: number; knowledgeCount: number; trapCount: number }>();
  for (const log of logs) {
    const current = subjectMap.get(log.subjectName) || { total: 0, carelessCount: 0, knowledgeCount: 0, trapCount: 0 };
    current.total += 1;
    if (log.whyCodes.some((c) => c.startsWith('A'))) current.carelessCount += 1;
    if (log.whyCodes.some((c) => c.startsWith('B'))) current.knowledgeCount += 1;
    if (log.whyCodes.some((c) => c.startsWith('C'))) current.trapCount += 1;
    subjectMap.set(log.subjectName, current);
  }

  const subjectCarelessBreakdown = Array.from(subjectMap.entries()).map(([subjectName, stats]) => ({
    subjectName, ...stats, carelessPercent: Math.round((stats.carelessCount / stats.total) * 100),
  }));

  const whyCounter = new Map<WhyCode, number>();
  let totalWhyTagsSelected = 0;
  for (const log of logs) {
    for (const code of log.whyCodes) {
      whyCounter.set(code, (whyCounter.get(code) || 0) + 1);
      totalWhyTagsSelected += 1;
    }
  }

  const sortedWhyEntries = Array.from(whyCounter.entries()).sort((a, b) => b[1] - a[1]);
  let runningCumulative = 0;
  const paretoWhyDistribution = sortedWhyEntries.map(([code, count]) => {
    const def = WHY_DICTIONARY.find((d) => d.code === code);
    const percentage = totalWhyTagsSelected > 0 ? Math.round((count / totalWhyTagsSelected) * 1000) / 10 : 0;
    runningCumulative = Math.min(100, Math.round((runningCumulative + percentage) * 10) / 10);
    return { code, label: def ? def.title : code, group: def ? def.group : 'GROUP_A_CARELESS', count, percentage, cumulativePercentage: runningCumulative };
  });

  const stageCounts = new Map<ProcessBreakpoint, number>();
  for (const log of logs) {
    stageCounts.set(log.processBreakpoint, (stageCounts.get(log.processBreakpoint) || 0) + 1);
  }

  const breakpointFunnel = PROCESS_BREAKPOINTS.map((bp) => {
    const count = stageCounts.get(bp.id) || 0;
    return { stage: bp.id, label: bp.title, count, percentage: Math.round((count / totalLogs) * 100) };
  });

  return { totalLogs, resolvedCount, dueTodayCount, carelessTaxPercent, subjectCarelessBreakdown, paretoWhyDistribution, breakpointFunnel };
}
