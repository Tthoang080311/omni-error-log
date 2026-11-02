// File: src/app/api/logs/route.ts
import { NextResponse } from 'next/server';
import { ErrorLogItem, DashboardAnalytics } from '@/types/error-log';
import { WHY_DICTIONARY, PROCESS_BREAKPOINTS, INITIAL_SUBJECTS } from '@/constants/taxonomy';

export const dynamic = 'force-dynamic';

const SUPABASE_REST_URL =
  process.env.NEXT_PUBLIC_SUPABASE_REST_URL ||
  process.env.SUPABASE_REST_URL ||
  'https://igetygmsrksbhfhismat.supabase.co/rest/v1';

const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6lnlnZXR5Z21zcmtzYmhmaGlzbWF0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTIyODg5MTAsImV4cCI6MjEwNzg2NDkxMH0.KsK-fHAZrArAFzYgqXr96Ni9mClWxGJPGd9E88yCXD4';

function getHeaders(prefer?: string): HeadersInit {
  const headers: Record<string, string> = {
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    'Content-Type': 'application/json',
  };
  if (prefer) headers['Prefer'] = prefer;
  return headers;
}

async function fetchLogsFromCloud(): Promise<ErrorLogItem[]> {
  try {
    const res = await fetch(
      `${SUPABASE_REST_URL}/omni_error_logs?select=payload&order=updated_at.desc`,
      {
        method: 'GET',
        headers: getHeaders(),
        cache: 'no-store',
      }
    );
    if (!res.ok) return [];
    const rows: Array<{ payload: ErrorLogItem }> = await res.json();
    return rows.map((r) => r.payload);
  } catch {
    return [];
  }
}

function computeAnalytics(items: ErrorLogItem[]): DashboardAnalytics {
  const totalLogs = items.length;
  const resolvedCount = items.filter((it) => (it.leitnerBox ?? 1) >= 4).length;
  const todayIso = new Date().toISOString().slice(0, 10);
  const dueTodayCount = items.filter((it) => {
    if ((it.leitnerBox ?? 1) >= 5 && it.isResolved) return false;
    if (!it.nextReviewDate) return true;
    return it.nextReviewDate <= todayIso;
  }).length;

  const carelessCount = items.filter((it) =>
    it.whyCodes?.some((c) => String(c).startsWith('A'))
  ).length;
  const carelessTaxPercent =
    totalLogs > 0 ? Math.round((carelessCount / totalLogs) * 100) : 0;

  const whyCounts = new Map<string, number>();
  let totalWhy = 0;
  items.forEach((it) => {
    (it.whyCodes || []).forEach((code) => {
      whyCounts.set(code, (whyCounts.get(code) || 0) + 1);
      totalWhy++;
    });
  });

  const paretoWhyDistribution = Array.from(whyCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([code, count]) => {
      const def = WHY_DICTIONARY.find((w) => w.code === code);
      const percent = totalWhy > 0 ? Math.round((count / totalWhy) * 100) : 0;
      return {
        code,
        whyCode: code,
        title: def ? def.title : code,
        label: def ? def.title : code,
        group: String(code).charAt(0) as 'A' | 'B' | 'C',
        count,
        percent,
        percentage: percent,
        cumulativePercent: percent,
        cumulativePercentage: percent,
        isTop80: true,
        isVitalFew: true,
        inPareto80: true,
      };
    });

  const breakpointFunnel = PROCESS_BREAKPOINTS.map((bp) => {
    const count = items.filter((it) => it.processBreakpoint === bp.id).length;
    const percent = totalLogs > 0 ? Math.round((count / totalLogs) * 100) : 0;
    return {
      id: bp.id,
      breakpoint: bp.id,
      breakpointId: bp.id,
      title: bp.title,
      label: bp.title,
      count,
      percent,
      percentage: percent,
    };
  });

  const subjectCarelessBreakdown = INITIAL_SUBJECTS.map((sub) => {
    const subList = items.filter((it) => it.subjectId === sub.id);
    const subTotal = subList.length;
    const subCareless = subList.filter((it) =>
      it.whyCodes?.some((c) => String(c).startsWith('A'))
    ).length;
    const carelessPercent =
      subTotal > 0 ? Math.round((subCareless / subTotal) * 100) : 0;
    return {
      subjectId: sub.id,
      subjectName: sub.name,
      total: subTotal,
      totalLogs: subTotal,
      count: subTotal,
      carelessCount: subCareless,
      knowledgeCount: subTotal - subCareless,
      deepCount: subTotal - subCareless,
      carelessPercent,
      carelessTaxPercent: carelessPercent,
      knowledgePercent: subTotal > 0 ? 100 - carelessPercent : 0,
      deepPercent: subTotal > 0 ? 100 - carelessPercent : 0,
    };
  });

  return {
    totalLogs,
    resolvedCount,
    dueTodayCount,
    carelessTaxPercent,
    subjectCarelessBreakdown: subjectCarelessBreakdown as any,
    paretoWhyDistribution: paretoWhyDistribution as any,
    breakpointFunnel: breakpointFunnel as any,
  };
}

export async function GET() {
  const logs = await fetchLogsFromCloud();
  const analytics = computeAnalytics(logs);
  return NextResponse.json({ ok: true, logs, analytics });
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const logs = await fetchLogsFromCloud();

    let targetItem: ErrorLogItem | null = null;

    if (body.updatedItem) {
      targetItem = body.updatedItem;
    } else if (body.id && body.action === 'review') {
      const item = logs.find((l) => l.id === body.id);
      if (item) {
        const currentBox = item.leitnerBox || 1;
        const nextBox = body.rememberedCorrectly ? Math.min(5, currentBox + 1) : 1;
        targetItem = {
          ...item,
          leitnerBox: nextBox as any,
          isResolved: nextBox >= 4,
          updatedAt: new Date().toISOString(),
        };
      }
    }

    if (targetItem) {
      await fetch(`${SUPABASE_REST_URL}/omni_error_logs?on_conflict=id`, {
        method: 'POST',
        headers: getHeaders('resolution=merge-duplicates,return=minimal'),
        body: JSON.stringify([
          {
            id: targetItem.id,
            subject_id: targetItem.subjectId,
            payload: targetItem,
            updated_at: targetItem.updatedAt || new Date().toISOString(),
          },
        ]),
      });
    }

    const updatedLogs = await fetchLogsFromCloud();
    const analytics = computeAnalytics(updatedLogs);
    return NextResponse.json({ ok: true, logs: updatedLogs, analytics, item: targetItem });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message || 'Server error' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (id) {
      await fetch(`${SUPABASE_REST_URL}/omni_error_logs?id=eq.${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers: getHeaders('return=minimal'),
      });
    }
    const updatedLogs = await fetchLogsFromCloud();
    const analytics = computeAnalytics(updatedLogs);
    return NextResponse.json({ ok: true, logs: updatedLogs, analytics });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message || 'Server error' }, { status: 500 });
  }
}
