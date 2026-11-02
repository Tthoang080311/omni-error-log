// File: src/app/api/logs/route.ts
import { NextResponse } from 'next/server';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Bắt buộc Next.js luôn lấy dữ liệu mới nhất, không cache tĩnh trên Vercel
export const dynamic = 'force-dynamic';

const rawUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '').trim();
const supabaseKey = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '').trim();

// 1. Tự động làm sạch URL: Cắt bỏ đuôi /rest/v1/... nếu biến môi trường bị dán dư
function getCleanSupabaseUrl(url: string): string {
  if (!url) return '';
  try {
    return new URL(url).origin; // Chỉ lấy đúng https://<project-id>.supabase.co
  } catch {
    return url.replace(/\/rest\/v1.*$/i, '').replace(/\/+$/, '');
  }
}

let supabaseInstance: SupabaseClient | null = null;

function getSupabase(): SupabaseClient {
  if (!supabaseInstance) {
    const cleanUrl = getCleanSupabaseUrl(rawUrl);
    if (!cleanUrl || !supabaseKey) {
      throw new Error('Thiếu cấu hình NEXT_PUBLIC_SUPABASE_URL hoặc NEXT_PUBLIC_SUPABASE_ANON_KEY trên Vercel.');
    }
    supabaseInstance = createClient(cleanUrl, supabaseKey);
  }
  return supabaseInstance;
}

// 2. Tự động nhận diện tên bảng ('omni_error_logs' hoặc 'error_logs')
let cachedTableName: string | null = null;

async function getTableName(supabase: SupabaseClient): Promise<string> {
  if (cachedTableName) return cachedTableName;

  const candidates = rawUrl.includes('omni_error_logs')
    ? ['omni_error_logs', 'error_logs']
    : ['error_logs', 'omni_error_logs'];

  for (const table of candidates) {
    const { error } = await supabase.from(table).select('*').limit(1);
    if (!error) {
      cachedTableName = table;
      return table;
    }
  }

  return candidates[0];
}

// Hàm tính toán Analytics trả về cho Frontend
function calculateAnalytics(logs: any[]) {
  const safeLogs = Array.isArray(logs) ? logs : [];
  const totalLogs = safeLogs.length;
  const resolvedCount = safeLogs.filter(l => (l.leitnerBox ?? 0) > 5).length;

  // Tính Thuế Ẩu (Careless Tax)
  const carelessLogs = safeLogs.filter(
    l => Array.isArray(l.whyCodes) && (l.whyCodes.includes('CARELESS') || l.whyCodes.includes('W01'))
  );
  const carelessTaxPercent = totalLogs === 0 ? 0 : Math.round((carelessLogs.length / totalLogs) * 100);

  // Phễu điểm gãy (Process Breakpoint Funnel)
  const funnels = [
    { id: 'DECODE', count: 0 },
    { id: 'PLAN', count: 0 },
    { id: 'EXECUTE', count: 0 },
    { id: 'VERIFY', count: 0 }
  ];

  safeLogs.forEach(l => {
    const stage = funnels.find(f => f.id === l.processBreakpoint);
    if (stage) stage.count++;
  });

  const now = new Date();
  const dueTodayCount = safeLogs.filter(l => {
    if (!l.nextReviewDate) return false;
    const reviewDate = new Date(l.nextReviewDate);
    return !isNaN(reviewDate.getTime()) && reviewDate <= now;
  }).length;

  return {
    totalLogs,
    resolvedCount,
    dueTodayCount,
    carelessTaxPercent,
    subjectCarelessBreakdown: [],
    paretoWhyDistribution: [],
    breakpointFunnel: funnels.map(f => ({
      stage: f.id,
      count: f.count,
      percentage: totalLogs === 0 ? 0 : Math.round((f.count / totalLogs) * 100)
    }))
  };
}

export async function GET() {
  try {
    const supabase = getSupabase();
    const table = await getTableName(supabase);

    const { data: logs, error } = await supabase
      .from(table)
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    const analytics = calculateAnalytics(logs || []);
    return NextResponse.json({ ok: true, logs: logs || [], analytics });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const supabase = getSupabase();
    const table = await getTableName(supabase);
    const body = await req.json();

    const payload = {
      ...body,
      whyCodes: Array.isArray(body.whyCodes) ? body.whyCodes : [],
      twinQuestions: Array.isArray(body.twinQuestions) ? body.twinQuestions : [],
      references: Array.isArray(body.references) ? body.references : [],
    };

    const { data, error } = await supabase
      .from(table)
      .insert([payload])
      .select()
      .single();

    if (error) throw error;

    const { data: allLogs } = await supabase
      .from(table)
      .select('*')
      .order('created_at', { ascending: false });

    const analytics = calculateAnalytics(allLogs || []);

    return NextResponse.json({ ok: true, item: data, logs: allLogs || [], analytics });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const supabase = getSupabase();
    const table = await getTableName(supabase);
    const body = await req.json();
    const { updatedItem, id, action, rememberedCorrectly } = body;

    let payload = updatedItem;

    // Xử lý riêng cho trường hợp Review Leitner Box
    if (action === 'review' && id) {
      const { data: existing, error: fetchErr } = await supabase
        .from(table)
        .select('*')
        .eq('id', id)
        .single();

      if (fetchErr) throw fetchErr;

      if (existing) {
        let newBox = existing.leitnerBox || 1;
        if (rememberedCorrectly) newBox += 1;
        else newBox = 1;

        const nextDate = new Date();
        nextDate.setDate(nextDate.getDate() + newBox * 2);

        payload = {
          leitnerBox: newBox,
          nextReviewDate: nextDate.toISOString().split('T')[0]
        };
      }
    }

    const targetId = updatedItem?.id || id;
    if (!targetId) throw new Error('Missing target ID for update');

    const { data, error } = await supabase
      .from(table)
      .update(payload)
      .eq('id', targetId)
      .select()
      .single();

    if (error) throw error;

    const { data: allLogs } = await supabase
      .from(table)
      .select('*')
      .order('created_at', { ascending: false });

    return NextResponse.json({
      ok: true,
      item: data,
      logs: allLogs || [],
      analytics: calculateAnalytics(allLogs || [])
    });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const supabase = getSupabase();
    const table = await getTableName(supabase);
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) throw new Error('Missing ID');

    const { error } = await supabase.from(table).delete().eq('id', id);
    if (error) throw error;

    const { data: allLogs } = await supabase
      .from(table)
      .select('*')
      .order('created_at', { ascending: false });

    return NextResponse.json({
      ok: true,
      logs: allLogs || [],
      analytics: calculateAnalytics(allLogs || [])
    });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}
