// File: src/app/api/logs/route.ts
import { NextResponse } from 'next/server';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const rawUrl = (
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  process.env.SUPABASE_URL ||
  ''
).trim();
const supabaseKey = (
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  ''
).trim();

function getCleanSupabaseUrl(url: string): string {
  if (!url) return '';
  try {
    return new URL(url).origin;
  } catch {
    return url.replace(/\/rest\/v1.*$/i, '').replace(/\/+$/, '');
  }
}

let supabaseInstance: SupabaseClient | null = null;

function getSupabase(): SupabaseClient | null {
  if (!supabaseInstance) {
    const cleanUrl = getCleanSupabaseUrl(rawUrl);
    if (!cleanUrl || !supabaseKey) return null;
    supabaseInstance = createClient(cleanUrl, supabaseKey, {
      auth: { persistSession: false },
    });
  }
  return supabaseInstance;
}

// Chuẩn hóa bản ghi để đảm bảo không bao giờ bị undefined .twinQuestions.length, .whyCodes, .references
function normalizeLogItem(raw: any): any {
  if (!raw || typeof raw !== 'object') return null;
  // Hỗ trợ trường hợp bảng omni_error_logs lưu dữ liệu trong cột JSON `payload` hoặc `data`
  const base =
    raw.payload && typeof raw.payload === 'object'
      ? { ...raw, ...raw.payload }
      : raw.data && typeof raw.data === 'object'
        ? { ...raw, ...raw.data }
        : { ...raw };

  delete base.payload;
  delete base.data;

  const leitnerBox = Number(base.leitnerBox ?? base.leitner_box ?? 1) || 1;

  return {
    ...base,
    id: String(base.id || `log_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`),
    subjectId: base.subjectId ?? base.subject_id ?? base.subject ?? 'MATH',
    subjectName: base.subjectName ?? base.subject_name ?? base.subject ?? 'Toán học',
    topic: base.topic ?? '',
    questionText: base.questionText ?? base.question_text ?? base.question ?? '',
    problemImageUrl: base.problemImageUrl ?? base.problem_image_url ?? base.imageUrl ?? '',
    myWrongStep: base.myWrongStep ?? base.my_wrong_step ?? base.myAnswer ?? '',
    correctSolution: base.correctSolution ?? base.correct_solution ?? base.correctAnswer ?? '',
    processBreakpoint: base.processBreakpoint ?? base.process_breakpoint ?? 'DECODE',
    whyCodes: Array.isArray(base.whyCodes)
      ? base.whyCodes
      : Array.isArray(base.why_codes)
        ? base.why_codes
        : [],
    ifTrigger: base.ifTrigger ?? base.if_trigger ?? '',
    thenAction: base.thenAction ?? base.then_action ?? base.actionPlan ?? '',
    twinQuestions: Array.isArray(base.twinQuestions)
      ? base.twinQuestions
      : Array.isArray(base.twin_questions)
        ? base.twin_questions
        : [],
    references: Array.isArray(base.references) ? base.references : [],
    leitnerBox,
    nextReviewDate:
      base.nextReviewDate ??
      base.next_review_date ??
      new Date().toISOString().slice(0, 10),
    isResolved: Boolean(base.isResolved ?? base.is_resolved ?? leitnerBox >= 4),
    createdAt: base.createdAt ?? base.created_at ?? new Date().toISOString(),
    updatedAt: base.updatedAt ?? base.updated_at ?? new Date().toISOString(),
  };
}

function calculateAnalytics(logs: any[]) {
  const safeLogs = Array.isArray(logs) ? logs : [];
  const totalLogs = safeLogs.length;
  const resolvedCount = safeLogs.filter((l) => (l.leitnerBox ?? 1) >= 4).length;

  const carelessLogs = safeLogs.filter(
    (l) =>
      Array.isArray(l.whyCodes) &&
      l.whyCodes.some(
        (c: string) =>
          String(c).startsWith('A') || c === 'CARELESS' || c === 'W01'
      )
  );
  const carelessTaxPercent =
    totalLogs === 0 ? 0 : Math.round((carelessLogs.length / totalLogs) * 100);

  const funnels = [
    { id: 'DECODE', count: 0 },
    { id: 'PLAN', count: 0 },
    { id: 'EXECUTE', count: 0 },
    { id: 'VERIFY', count: 0 },
  ];

  safeLogs.forEach((l) => {
    const stage = funnels.find((f) => f.id === l.processBreakpoint);
    if (stage) stage.count++;
  });

  const todayIso = new Date().toISOString().slice(0, 10);
  const dueTodayCount = safeLogs.filter((l) => {
    if ((l.leitnerBox ?? 1) >= 5 && l.isResolved) return false;
    if (!l.nextReviewDate) return true;
    return String(l.nextReviewDate).slice(0, 10) <= todayIso;
  }).length;

  return {
    totalLogs,
    resolvedCount,
    dueTodayCount,
    carelessTaxPercent,
    subjectCarelessBreakdown: [],
    paretoWhyDistribution: [],
    breakpointFunnel: funnels.map((f) => ({
      id: f.id,
      stage: f.id,
      count: f.count,
      percent: totalLogs === 0 ? 0 : Math.round((f.count / totalLogs) * 100),
      percentage: totalLogs === 0 ? 0 : Math.round((f.count / totalLogs) * 100),
    })),
  };
}

async function fetchAllNormalizedLogs(supabase: SupabaseClient): Promise<{
  table: string;
  logs: any[];
}> {
  const candidateTables = ['omni_error_logs', 'error_logs'];

  for (const table of candidateTables) {
    const { data, error } = await supabase.from(table).select('*');
    if (!error && Array.isArray(data)) {
      const normalized = data
        .map(normalizeLogItem)
        .filter(Boolean)
        .sort(
          (a, b) =>
            new Date(b.createdAt || 0).getTime() -
            new Date(a.createdAt || 0).getTime()
        );
      return { table, logs: normalized };
    }
  }

  return { table: 'omni_error_logs', logs: [] };
}

async function smartUpsertItem(supabase: SupabaseClient, item: any) {
  const cleanItem = normalizeLogItem(item);
  const candidateTables = ['omni_error_logs', 'error_logs'];

  for (const table of candidateTables) {
    // Thử 1: Upsert trực tiếp bản ghi phẳng
    const { data: flatData, error: flatErr } = await supabase
      .from(table)
      .upsert([cleanItem], { onConflict: 'id' })
      .select()
      .maybeSingle();

    if (!flatErr) {
      return normalizeLogItem(flatData || cleanItem);
    }

    // Thử 2: Nếu bảng dùng cột JSON `payload` (id, payload, updated_at)
    const { data: payloadData, error: payloadErr } = await supabase
      .from(table)
      .upsert(
        [
          {
            id: cleanItem.id,
            payload: cleanItem,
            updated_at: cleanItem.updatedAt,
          },
        ],
        { onConflict: 'id' }
      )
      .select()
      .maybeSingle();

    if (!payloadErr) {
      return normalizeLogItem(payloadData || cleanItem);
    }
  }

  return cleanItem;
}

export async function GET() {
  try {
    const supabase = getSupabase();
    if (!supabase) {
      return NextResponse.json({
        ok: true,
        logs: [],
        analytics: calculateAnalytics([]),
      });
    }

    const { logs } = await fetchAllNormalizedLogs(supabase);
    const analytics = calculateAnalytics(logs);

    return NextResponse.json({ ok: true, logs, analytics });
  } catch (error: any) {
    return NextResponse.json({
      ok: true,
      logs: [],
      analytics: calculateAnalytics([]),
      warning: error?.message,
    });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const cleanItem = normalizeLogItem(body);
    const supabase = getSupabase();

    if (!supabase) {
      return NextResponse.json({
        ok: true,
        item: cleanItem,
        logs: [cleanItem],
        analytics: calculateAnalytics([cleanItem]),
      });
    }

    const saved = await smartUpsertItem(supabase, cleanItem);
    const { logs } = await fetchAllNormalizedLogs(supabase);
    const finalLogs = logs.length > 0 ? logs : [saved];

    return NextResponse.json({
      ok: true,
      item: saved,
      logs: finalLogs,
      analytics: calculateAnalytics(finalLogs),
    });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 }
    );
  }
}

export async function PATCH(req: Request) {
  try {
    const body = await req.json();
    const { updatedItem, id, action, rememberedCorrectly } = body;
    const supabase = getSupabase();

    const targetId = updatedItem?.id || id;
    if (!targetId) {
      return NextResponse.json(
        { ok: false, error: 'Missing target ID' },
        { status: 400 }
      );
    }

    if (!supabase) {
      const fallback = normalizeLogItem(updatedItem || { id: targetId });
      return NextResponse.json({
        ok: true,
        item: fallback,
        logs: [fallback],
        analytics: calculateAnalytics([fallback]),
      });
    }

    const { logs: existingLogs } = await fetchAllNormalizedLogs(supabase);
    const existingItem = existingLogs.find((it) => it.id === targetId);

    let mergedToSave = normalizeLogItem({
      ...(existingItem || {}),
      ...(updatedItem || {}),
      id: targetId,
      updatedAt: new Date().toISOString(),
    });

    if (action === 'review') {
      const currentBox = mergedToSave.leitnerBox || 1;
      const nextBox = rememberedCorrectly ? Math.min(5, currentBox + 1) : 1;
      const intervals: Record<number, number> = {
        1: 1,
        2: 3,
        3: 7,
        4: 14,
        5: 30,
      };
      const nextDate = new Date();
      nextDate.setDate(nextDate.getDate() + (intervals[nextBox] || 1));

      mergedToSave = {
        ...mergedToSave,
        leitnerBox: nextBox,
        nextReviewDate: nextDate.toISOString().slice(0, 10),
        isResolved: nextBox >= 4,
        updatedAt: new Date().toISOString(),
      };
    }

    const saved = await smartUpsertItem(supabase, mergedToSave);
    const { logs: allLogs } = await fetchAllNormalizedLogs(supabase);

    return NextResponse.json({
      ok: true,
      item: saved,
      logs: allLogs,
      analytics: calculateAnalytics(allLogs),
    });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 }
    );
  }
}

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json(
        { ok: false, error: 'Missing ID' },
        { status: 400 }
      );
    }

    const supabase = getSupabase();
    if (supabase) {
      await Promise.allSettled([
        supabase.from('omni_error_logs').delete().eq('id', id),
        supabase.from('error_logs').delete().eq('id', id),
      ]);
      const { logs } = await fetchAllNormalizedLogs(supabase);
      return NextResponse.json({
        ok: true,
        logs,
        analytics: calculateAnalytics(logs),
      });
    }

    return NextResponse.json({
      ok: true,
      logs: [],
      analytics: calculateAnalytics([]),
    });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 }
    );
  }
}
