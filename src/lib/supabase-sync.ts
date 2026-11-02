// File: src/lib/supabase-sync.ts
import { ErrorLogItem } from '@/types/error-log';

const SUPABASE_REST_URL =
  process.env.NEXT_PUBLIC_SUPABASE_REST_URL ||
  'https://igetygmsrksbhfhismat.supabase.co/rest/v1';

const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlnZXR5Z21zcmtzYmhmaGlzbWF0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTIyODg5MTAsImV4cCI6MjEwNzg2NDkxMH0.KsK-fHAZrArAFzYgqXr96Ni9mClWxGJPGd9E88yCXD4';

const LOCAL_MIRROR_KEY = 'OMNI_PERSISTENT_MIRROR_LOGS_V1';

function readLocalMirror(): ErrorLogItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(LOCAL_MIRROR_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeLocalMirror(items: ErrorLogItem[]) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(LOCAL_MIRROR_KEY, JSON.stringify(items));
  } catch {
    // Bỏ qua nếu bộ nhớ trình duyệt đầy
  }
}

function getHeaders(prefer?: string): HeadersInit {
  const headers: Record<string, string> = {
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    'Content-Type': 'application/json',
  };
  if (prefer) headers['Prefer'] = prefer;
  return headers;
}

export async function fetchAllLogsFromSupabase(): Promise<ErrorLogItem[] | null> {
  const mirrorLogs = readLocalMirror();
  try {
    const res = await fetch(
      `${SUPABASE_REST_URL}/omni_error_logs?select=payload&order=updated_at.desc`,
      {
        method: 'GET',
        headers: getHeaders(),
        cache: 'no-store',
      }
    );
    if (!res.ok) {
      return mirrorLogs.length > 0 ? mirrorLogs : null;
    }
    const rows: Array<{ payload: ErrorLogItem }> = await res.json();
    const cloudLogs = rows.map((r) => r.payload);

    // Hợp nhất giữa Cloud và bộ nhớ trình duyệt để không bao giờ mất bản ghi khi Vercel reset
    const mergedMap = new Map<string, ErrorLogItem>();
    mirrorLogs.forEach((item) => mergedMap.set(item.id, item));
    cloudLogs.forEach((item) => mergedMap.set(item.id, item));

    const combined = Array.from(mergedMap.values()).sort(
      (a, b) =>
        new Date(b.createdAt || 0).getTime() -
        new Date(a.createdAt || 0).getTime()
    );
    writeLocalMirror(combined);
    return combined;
  } catch {
    return mirrorLogs.length > 0 ? mirrorLogs : null;
  }
}

export async function upsertLogsToSupabase(
  items: ErrorLogItem | ErrorLogItem[]
): Promise<boolean> {
  const list = Array.isArray(items) ? items : [items];
  if (list.length === 0) return true;

  // Lưu ngay vào bộ nhớ bền vững trên trình duyệt trước khi gửi lên Cloud
  const currentMirror = readLocalMirror();
  const byId = new Map<string, ErrorLogItem>();
  currentMirror.forEach((it) => byId.set(it.id, it));
  list.forEach((it) => byId.set(it.id, it));
  writeLocalMirror(Array.from(byId.values()));

  const body = list.map((item) => ({
    id: item.id,
    subject_id: item.subjectId,
    payload: item,
    updated_at: item.updatedAt || new Date().toISOString(),
  }));

  try {
    const res = await fetch(
      `${SUPABASE_REST_URL}/omni_error_logs?on_conflict=id`,
      {
        method: 'POST',
        headers: getHeaders('resolution=merge-duplicates,return=minimal'),
        body: JSON.stringify(body),
      }
    );
    return res.ok;
  } catch {
    return false;
  }
}

export async function deleteLogFromSupabase(id: string): Promise<boolean> {
  const currentMirror = readLocalMirror().filter((it) => it.id !== id);
  writeLocalMirror(currentMirror);

  try {
    const res = await fetch(
      `${SUPABASE_REST_URL}/omni_error_logs?id=eq.${encodeURIComponent(id)}`,
      {
        method: 'DELETE',
        headers: getHeaders('return=minimal'),
      }
    );
    return res.ok;
  } catch {
    return false;
  }
}
