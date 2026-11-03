// File: src/lib/supabase-sync.ts
import { ErrorLogItem } from '@/types/error-log';

export const STORAGE_SUPABASE_URL_KEY = 'OMNI_CUSTOM_SUPABASE_URL';
export const STORAGE_SUPABASE_ANON_KEY = 'OMNI_CUSTOM_SUPABASE_ANON_KEY';
export const STORAGE_SUPABASE_TABLE_KEY = 'OMNI_CUSTOM_SUPABASE_TABLE';
export const TAXONOMY_META_ROW_ID = '__OMNI_TAXONOMY_META_V1__';

export interface SupabaseRuntimeConfig {
  url: string;
  anonKey: string;
  tableName: string;
  isConfigured: boolean;
}

export function getSupabaseRuntimeConfig(): SupabaseRuntimeConfig {
  if (typeof window === 'undefined') {
    const envUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim();
    const envKey = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '').trim();
    return {
      url: envUrl.replace(/\/+$/, ''),
      anonKey: envKey,
      tableName: 'error_logs',
      isConfigured: Boolean(envUrl && envKey),
    };
  }

  const localUrl = (
    window.localStorage.getItem(STORAGE_SUPABASE_URL_KEY) || ''
  ).trim();
  const localKey = (
    window.localStorage.getItem(STORAGE_SUPABASE_ANON_KEY) || ''
  ).trim();
  const localTable = (
    window.localStorage.getItem(STORAGE_SUPABASE_TABLE_KEY) || ''
  ).trim();

  const finalUrl = (
    localUrl ||
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    ''
  )
    .trim()
    .replace(/\/+$/, '');

  const finalKey = (
    localKey ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    ''
  ).trim();

  const finalTable = localTable || 'error_logs';

  return {
    url: finalUrl,
    anonKey: finalKey,
    tableName: finalTable,
    isConfigured: Boolean(finalUrl && finalKey),
  };
}

export function saveSupabaseRuntimeConfig(
  url: string,
  anonKey: string,
  tableName = 'error_logs'
): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(
    STORAGE_SUPABASE_URL_KEY,
    url.trim().replace(/\/+$/, '')
  );
  window.localStorage.setItem(STORAGE_SUPABASE_ANON_KEY, anonKey.trim());
  window.localStorage.setItem(
    STORAGE_SUPABASE_TABLE_KEY,
    tableName.trim() || 'error_logs'
  );
}

function buildSupabaseHeaders(anonKey: string, prefer?: string): HeadersInit {
  const headers: Record<string, string> = {
    apikey: anonKey,
    Authorization: `Bearer ${anonKey}`,
    'Content-Type': 'application/json',
  };
  if (prefer) {
    headers.Prefer = prefer;
  }
  return headers;
}

export async function testSupabaseConnection(): Promise<{
  ok: boolean;
  message: string;
  rowCount?: number;
}> {
  const cfg = getSupabaseRuntimeConfig();
  if (!cfg.isConfigured) {
    return {
      ok: false,
      message: 'Chưa nhập Supabase URL hoặc Anon Key.',
    };
  }

  try {
    const endpoint = `${cfg.url}/rest/v1/${encodeURIComponent(
      cfg.tableName
    )}?select=*&limit=1000`;
    const res = await fetch(endpoint, {
      method: 'GET',
      headers: buildSupabaseHeaders(cfg.anonKey),
      cache: 'no-store',
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      return {
        ok: false,
        message: `Lỗi kết nối Supabase (${res.status}): ${errText || res.statusText}`,
      };
    }

    const rows = await res.json();
    const count = Array.isArray(rows)
      ? rows.filter((r) => r?.id !== TAXONOMY_META_ROW_ID).length
      : 0;
    return {
      ok: true,
      rowCount: count,
      message: `Kết nối & Đồng bộ thành công! Đang có ${count} bản ghi trên bảng "${cfg.tableName}".`,
    };
  } catch (err) {
    return {
      ok: false,
      message: `Không thể gọi tới Supabase URL: ${(err as Error).message}`,
    };
  }
}

// Kéo toàn bộ bản ghi từ Supabase (Không phụ thuộc vào cột updated_at trên DB)
export async function fetchAllLogsFromSupabase(): Promise<
  ErrorLogItem[] | null
> {
  const cfg = getSupabaseRuntimeConfig();
  if (!cfg.isConfigured) return null;

  try {
    const endpoint = `${cfg.url}/rest/v1/${encodeURIComponent(
      cfg.tableName
    )}?select=*`;
    const res = await fetch(endpoint, {
      method: 'GET',
      headers: buildSupabaseHeaders(cfg.anonKey),
      cache: 'no-store',
    });

    if (!res.ok) return null;
    const rows = await res.json();
    if (!Array.isArray(rows)) return null;

    // Khôi phục danh mục Chuyên đề nhỏ & Nguồn đề nếu có bản ghi Meta trên Cloud
    const metaRow = rows.find((r) => r?.id === TAXONOMY_META_ROW_ID);
    if (metaRow?.payload && typeof window !== 'undefined') {
      try {
        if (Array.isArray(metaRow.payload.subjects)) {
          window.localStorage.setItem(
            'OMNI_SUBJECTS_AND_TOPICS_V2',
            JSON.stringify(metaRow.payload.subjects)
          );
        }
        if (Array.isArray(metaRow.payload.sources)) {
          window.localStorage.setItem(
            'OMNI_CUSTOM_SOURCES_LIST_V1',
            JSON.stringify(metaRow.payload.sources)
          );
        }
      } catch {
        // Bỏ qua lỗi ghi localStorage
      }
    }

    const parsedItems = rows
      .filter((r) => r && r.id !== TAXONOMY_META_ROW_ID)
      .map((r) => {
        if (r.payload && typeof r.payload === 'object') {
          return {
            ...r.payload,
            id: String(r.id || r.payload.id),
            updatedAt: String(
              r.updated_at ||
                r.payload.updatedAt ||
                r.created_at ||
                r.payload.createdAt ||
                new Date().toISOString()
            ),
          } as ErrorLogItem;
        }
        return r as ErrorLogItem;
      });

    // Sắp xếp trực tiếp bằng JS theo thời gian mới nhất
    return parsedItems.sort(
      (a, b) =>
        new Date(b.updatedAt || b.createdAt || 0).getTime() -
        new Date(a.updatedAt || a.createdAt || 0).getTime()
    );
  } catch {
    return null;
  }
}

// Đẩy bản ghi lên Supabase kèm cơ chế Fallback tự động nếu bảng không có cột updated_at
export async function upsertLogsToSupabase(
  itemsOrSingle: ErrorLogItem | ErrorLogItem[]
): Promise<boolean> {
  const cfg = getSupabaseRuntimeConfig();
  if (!cfg.isConfigured) return false;

  const list = Array.isArray(itemsOrSingle) ? itemsOrSingle : [itemsOrSingle];
  const nowIso = new Date().toISOString();

  const baseEntries: Array<{ id: string; payload: unknown; updated_at: string }> =
    list
      .filter((it) => it && it.id)
      .map((it) => ({
        id: String(it.id),
        payload: it,
        updated_at: it.updatedAt || nowIso,
      }));

  if (typeof window !== 'undefined') {
    try {
      const rawSubs = window.localStorage.getItem(
        'OMNI_SUBJECTS_AND_TOPICS_V2'
      );
      const rawSources = window.localStorage.getItem(
        'OMNI_CUSTOM_SOURCES_LIST_V1'
      );
      if (rawSubs || rawSources) {
        baseEntries.push({
          id: TAXONOMY_META_ROW_ID,
          payload: {
            subjects: rawSubs ? JSON.parse(rawSubs) : undefined,
            sources: rawSources ? JSON.parse(rawSources) : undefined,
            updatedAt: nowIso,
          },
          updated_at: nowIso,
        });
      }
    } catch {
      // Bỏ qua
    }
  }

  if (baseEntries.length === 0) return true;

  const endpoint = `${cfg.url}/rest/v1/${encodeURIComponent(
    cfg.tableName
  )}?on_conflict=id`;
  const headers = buildSupabaseHeaders(
    cfg.anonKey,
    'resolution=merge-duplicates,return=minimal'
  );

  try {
    // Lần 1: Thử đẩy đầy đủ { id, payload, updated_at }
    const resWithTimestamp = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(baseEntries),
    });

    if (resWithTimestamp.ok) return true;

    // Lần 2 (Fallback): Nếu bảng trên Supabase không có cột updated_at, chỉ gửi { id, payload }
    const rowsWithoutTimestamp = baseEntries.map(({ id, payload }) => ({
      id,
      payload,
    }));
    const resMinimal = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(rowsWithoutTimestamp),
    });

    return resMinimal.ok;
  } catch {
    return false;
  }
}

export async function deleteLogFromSupabase(id: string): Promise<boolean> {
  const cfg = getSupabaseRuntimeConfig();
  if (!cfg.isConfigured || !id) return false;

  try {
    const endpoint = `${cfg.url}/rest/v1/${encodeURIComponent(
      cfg.tableName
    )}?id=eq.${encodeURIComponent(id)}`;
    const res = await fetch(endpoint, {
      method: 'DELETE',
      headers: buildSupabaseHeaders(cfg.anonKey, 'return=minimal'),
    });
    return res.ok;
  } catch {
    return false;
  }
}
