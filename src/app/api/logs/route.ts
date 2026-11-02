// File: src/app/api/logs/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Khởi tạo Supabase Client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

// Hàm tính toán Analytics trả về cho Frontend
function calculateAnalytics(logs: any[]) {
  const totalLogs = logs.length;
  const resolvedCount = logs.filter(l => l.leitnerBox > 5).length; // Giả định box > 5 là đã master
  
  // Tính Thuế Ẩu (Careless Tax)
  const carelessLogs = logs.filter(l => l.whyCodes?.includes('CARELESS') || l.whyCodes?.includes('W01'));
  const carelessTaxPercent = totalLogs === 0 ? 0 : Math.round((carelessLogs.length / totalLogs) * 100);

  // Phễu điểm gãy (Process Breakpoint Funnel)
  const funnels = [
    { id: 'DECODE', count: 0 },
    { id: 'PLAN', count: 0 },
    { id: 'EXECUTE', count: 0 },
    { id: 'VERIFY', count: 0 }
  ];
  logs.forEach(l => {
    const stage = funnels.find(f => f.id === l.processBreakpoint);
    if (stage) stage.count++;
  });

  return {
    totalLogs,
    resolvedCount,
    dueTodayCount: logs.filter(l => new Date(l.nextReviewDate) <= new Date()).length,
    carelessTaxPercent,
    subjectCarelessBreakdown: [], // Có thể bổ sung logic map theo môn học sau
    paretoWhyDistribution: [],    // Có thể bổ sung logic đếm nhóm WHY sau
    breakpointFunnel: funnels.map(f => ({
      stage: f.id,
      count: f.count,
      percentage: totalLogs === 0 ? 0 : Math.round((f.count / totalLogs) * 100)
    }))
  };
}

export async function GET() {
  try {
    const { data: logs, error } = await supabase
      .from('error_logs')
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
    const body = await req.json();
    
    // Đảm bảo parse các mảng/object thành JSON để lưu vào Supabase đúng kiểu định dạng
    const payload = {
      ...body,
      whyCodes: body.whyCodes || [],
      twinQuestions: body.twinQuestions || [],
      references: body.references || [],
    };

    const { data, error } = await supabase
      .from('error_logs')
      .insert([payload])
      .select()
      .single();

    if (error) throw error;

    // Lấy lại danh sách mới nhất để update analytics
    const { data: allLogs } = await supabase.from('error_logs').select('*');
    const analytics = calculateAnalytics(allLogs || []);

    return NextResponse.json({ ok: true, item: data, logs: allLogs, analytics });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const body = await req.json();
    const { updatedItem, id, action, rememberedCorrectly } = body;

    let payload = updatedItem;

    // Xử lý riêng cho trường hợp Review Leitner Box
    if (action === 'review' && id) {
      const { data: existing } = await supabase.from('error_logs').select('*').eq('id', id).single();
      if (existing) {
        let newBox = existing.leitnerBox || 1;
        if (rememberedCorrectly) newBox += 1;
        else newBox = 1;
        
        // Tính ngày ôn tiếp theo (công thức đơn giản)
        const nextDate = new Date();
        nextDate.setDate(nextDate.getDate() + (newBox * 2));

        payload = { 
          leitnerBox: newBox, 
          nextReviewDate: nextDate.toISOString().split('T')[0] 
        };
      }
    }

    const targetId = updatedItem?.id || id;
    const { data, error } = await supabase
      .from('error_logs')
      .update(payload)
      .eq('id', targetId)
      .select()
      .single();

    if (error) throw error;

    const { data: allLogs } = await supabase.from('error_logs').select('*').order('created_at', { ascending: false });
    return NextResponse.json({ ok: true, item: data, logs: allLogs, analytics: calculateAnalytics(allLogs || []) });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    
    if (!id) throw new Error("Missing ID");

    const { error } = await supabase.from('error_logs').delete().eq('id', id);
    if (error) throw error;

    const { data: allLogs } = await supabase.from('error_logs').select('*').order('created_at', { ascending: false });
    return NextResponse.json({ ok: true, logs: allLogs, analytics: calculateAnalytics(allLogs || []) });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}
