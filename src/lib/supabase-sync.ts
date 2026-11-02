// File: src/lib/supabase-sync.ts
import { ErrorLogItem } from '@/types/error-log';

const SUPABASE_REST_URL =
  process.env.NEXT_PUBLIC_SUPABASE_REST_URL ||
  'https://igetygmsrksbhfhismat.supabase.co/rest/v1';

const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlnZXR5Z21zcmtzYmhmaGlzbWF0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTIyODg5MTAsImV4cCI6MjEwNzg2NDkxMH0.KsK-fHAZrArAFzYgqXr96Ni9mClWxGJPGd9E88yCXD4';

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
  try {
    const res = await fetch(
      `${SUPABASE_REST_URL}/omni_error_logs?select=payload&order=updated_at.desc`,
      {
        method: 'GET',
        headers: getHeaders(),
        cache: 'no-store',
      }
    );
    if (!res.ok) return null;
    const rows: Array<{ payload: ErrorLogItem }> = await res.json();
    return rows.map((r) => r.payload);
  } catch {
    return null;
  }
}

export async function upsertLogsToSupabase(
  items: ErrorLogItem | ErrorLogItem[]
): Promise<boolean> {
  const list = Array.isArray(items) ? items : [items];
  if (list.length === 0) return true;

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
