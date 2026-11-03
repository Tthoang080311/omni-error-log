// File: src/lib/supabase-sync.ts
import { ErrorLogItem } from '@/types/error-log';

export const STORAGE_SUPABASE_URL_KEY = 'OMNI_CUSTOM_SUPABASE_URL';
export const STORAGE_SUPABASE_ANON_KEY = 'OMNI_CUSTOM_SUPABASE_ANON_KEY';
export const STORAGE_SUPABASE_TABLE_KEY = 'OMNI_CUSTOM_SUPABASE_TABLE';
export const TAXONOMY_META_ROW_ID = '__OMNI_TAXONOMY_META_V1__';

const TAXONOMY_META_ROW_UUID = '00000000-0000-4000-8000-000000000001';
const TAXONOMY_META_ROW_INT = 9007199254740001;

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export interface SupabaseRuntimeConfig {
  url: string;
  anonKey: string;
  tableName: string;
  isConfigured: boolean;
}

type IdFormat = 'text' | 'uuid' | 'int';

interface TableSchemaMemory {
  preferredStage: 1 | 2 | 3;
  idFormat: IdFormat;
  useOnConflict: boolean;
  unsupportedColumns: Set<string>;
}

const schemaCache = new Map<string, TableSchemaMemory>();
let lastSyncedMetaSnapshot = '';

function getSchemaMemory(tableKey: string): TableSchemaMemory {
  let mem = schemaCache.get(tableKey);
  if (!mem) {
    mem = {
      preferredStage: 1,
      idFormat: 'text',
      useOnConflict: true,
      unsupportedColumns: new Set<string>(),
    };
    schemaCache.set(tableKey, mem);
  }
  return mem;
}

function toDeterministicUuid(rawId: string): string {
  const clean = String(rawId || '').trim();
  if (UUID_REGEX.test(clean)) return clean.toLowerCase();
  if (clean === TAXONOMY_META_ROW_ID) return TAXONOMY_META_ROW_UUID;

  let h1 = 0xdeadbeef ^ clean.length;
  let h2 = 0x41c6ce57 ^ clean.length;
  let h3 = 0x1b873593 ^ clean.length;
  let h4 = 0x85ebca6b ^ clean.length;

  for (let i = 0; i < clean.length; i++) {
    const ch = clean.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
    h3 = Math.imul(h3 ^ ch, 2246822507);
    h4 = Math.imul(h4 ^ ch, 3266489909);
  }

  const hex = (n: number) => (n >>> 0).toString(16).padStart(8, '0');
  const full = `${hex(h1)}${hex(h2)}${hex(h3)}${hex(h4)}`;
  return `${full.slice(0, 8)}-${full.slice(8, 12)}-4${full.slice(13, 16)}-a${full.slice(17, 20)}-${full.slice(20, 32)}`;
}

function toDeterministicInt(rawId: string): number {
  const clean = String(rawId || '').trim();
  if (clean === TAXONOMY_META_ROW_ID) return TAXONOMY_META_ROW_INT;
  if (/^\d+$/.test(clean)) {
    const num = Number(clean);
    if (Number.isSafeInteger(num) && num > 0) return num;
  }

  let h1 = 0xdeadbeef ^ clean.length;
  let h2 = 0x41c6ce57 ^ clean.length;
  for (let i = 0; i < clean.length; i++) {
    const ch = clean.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 =
    Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^
    Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 =
    Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^
    Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return 4294967296 * (2097151 & h2) + (h1 >>> 0);
}

function formatDbId(rawId: string, format: IdFormat): string | number {
  if (format === 'uuid') return toDeterministicUuid(rawId);
  if (format === 'int') return toDeterministicInt(rawId);
  return String(rawId);
}

function isMetaRow(row: Record<string, any>): boolean {
  return (
    row?.id === TAXONOMY_META_ROW_ID ||
    row?.id === TAXONOMY_META_ROW_UUID ||
    Number(row?.id) === TAXONOMY_META_ROW_INT ||
    row?.payload?.id === TAXONOMY_META_ROW_ID
  );
}

function inspectSampleRowSchema(
  sample: Record<string, unknown>,
  mem: TableSchemaMemory
): void {
  if ('subject_id' in sample || 'question_text' in sample) {
    mem.preferredStage = 3;
  } else if ('updated_at' in sample) {
    mem.preferredStage = 1;
  } else {
    mem.preferredStage = 2;
  }

  if (typeof sample.id === 'number') {
    mem.idFormat = 'int';
  } else if (typeof sample.id === 'string' && UUID_REGEX.test(sample.id)) {
    const payloadId = (sample.payload as Record<string, unknown> | undefined)
      ?.id;
    if (
      sample.id === TAXONOMY_META_ROW_UUID ||
      (typeof payloadId === 'string' && !UUID_REGEX.test(payloadId))
    ) {
      mem.idFormat = 'uuid';
    }
  }
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
    if (Array.isArray(rows) && rows.length > 0 && rows[0]) {
      inspectSampleRowSchema(
        rows[0] as Record<string, unknown>,
        getSchemaMemory(`${cfg.url}::${cfg.tableName}`)
      );
    }

    const count = Array.isArray(rows)
      ? rows.filter((r) => r && !isMetaRow(r)).length
      : 0;
    return {
      ok: true,
      rowCount: count,
      message: `Kết nối thành công! Đang có ${count} bản ghi trên bảng "${cfg.tableName}".`,
    };
  } catch (err) {
    return {
      ok: false,
      message: `Không thể gọi tới Supabase URL: ${(err as Error).message}`,
    };
  }
}

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

    if (rows.length > 0 && typeof rows[0] === 'object' && rows[0] !== null) {
      inspectSampleRowSchema(
        rows[0] as Record<string, unknown>,
        getSchemaMemory(`${cfg.url}::${cfg.tableName}`)
      );
    }

    const metaRow = rows.find((r) => isMetaRow(r));
    if (metaRow?.payload && typeof window !== 'undefined') {
      try {
        const rawSubs = Array.isArray(metaRow.payload.subjects)
          ? JSON.stringify(metaRow.payload.subjects)
          : '';
        const rawSources = Array.isArray(metaRow.payload.sources)
          ? JSON.stringify(metaRow.payload.sources)
          : '';

        if (rawSubs) {
          window.localStorage.setItem('OMNI_SUBJECTS_AND_TOPICS_V2', rawSubs);
        }
        if (rawSources) {
          window.localStorage.setItem(
            'OMNI_CUSTOM_SOURCES_LIST_V1',
            rawSources
          );
        }
        if (rawSubs || rawSources) {
          lastSyncedMetaSnapshot = `${rawSubs}|||${rawSources}`;
        }
      } catch {
        // Bỏ qua
      }
    }

    const parsedItems = rows
      .filter((r) => r && !isMetaRow(r))
      .map((r) => {
        if (r.payload && typeof r.payload === 'object') {
          return {
            ...r,
            ...r.payload,
            id: String(r.payload.id || r.id),
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

    return parsedItems.sort(
      (a, b) =>
        new Date(b.updatedAt || b.createdAt || 0).getTime() -
        new Date(a.updatedAt || a.createdAt || 0).getTime()
    );
  } catch {
    return null;
  }
}

function buildRowByStage(
  it: ErrorLogItem,
  stage: 1 | 2 | 3,
  nowIso: string,
  mem: TableSchemaMemory
): Record<string, unknown> {
  const dbId = formatDbId(String(it.id), mem.idFormat);

  let row: Record<string, unknown>;
  if (stage === 1) {
    row = {
      id: dbId,
      payload: it,
      updated_at: it.updatedAt || nowIso,
    };
  } else if (stage === 2) {
    row = {
      id: dbId,
      payload: it,
    };
  } else {
    row = {
      id: dbId,
      subject_id: it.subjectId || 'MATH',
      subject_name: it.subjectName || 'Toán',
      topic: it.topic || '',
      question_text: it.questionText || '',
      leitner_box: Number(it.leitnerBox || 1),
      next_review_date: it.nextReviewDate || nowIso.slice(0, 10),
      is_resolved: Boolean(it.isResolved),
      payload: it,
      updated_at: it.updatedAt || nowIso,
    };
  }

  mem.unsupportedColumns.forEach((col) => {
    if (col !== 'id') delete row[col];
  });

  return row;
}

async function tryPostRowsWithFallback(
  baseUrl: string,
  anonKey: string,
  items: ErrorLogItem[],
  tableKey: string
): Promise<boolean> {
  const nowIso = new Date().toISOString();

  const uniqueMap = new Map<string, ErrorLogItem>();
  items.forEach((it) => {
    if (it && it.id) uniqueMap.set(String(it.id), it);
  });
  const uniqueItems = Array.from(uniqueMap.values());
  if (uniqueItems.length === 0) return true;

  const mem = getSchemaMemory(tableKey);
  const allStages: Array<1 | 2 | 3> = [1, 2, 3];
  const stageOrder: Array<1 | 2 | 3> = [
    mem.preferredStage,
    ...allStages.filter((s) => s !== mem.preferredStage),
  ];

  for (const stage of stageOrder) {
    for (let attempt = 0; attempt < 4; attempt++) {
      const endpoint = mem.useOnConflict
        ? `${baseUrl}?on_conflict=id`
        : baseUrl;
      const headers = buildSupabaseHeaders(
        anonKey,
        mem.useOnConflict
          ? 'resolution=merge-duplicates,return=minimal'
          : 'return=minimal'
      );

      const payloadRows = uniqueItems.map((it) =>
        buildRowByStage(it, stage, nowIso, mem)
      );

      const res = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(payloadRows),
      }).catch(() => null);

      if (res?.ok) {
        mem.preferredStage = stage;
        return true;
      }

      if (!res) break;

      const errData = await res.json().catch(() => null);
      const errCode = String(errData?.code || '');
      const errMsg = String(errData?.message || '');
      const errMsgLower = errMsg.toLowerCase();

      // 1. Cột `id` không có ràng buộc UNIQUE/PK cho on_conflict=id (42P10)
      if (errCode === '42P10' && mem.useOnConflict) {
        mem.useOnConflict = false;
        continue;
      }

      // 2. Xung đột kiểu dữ liệu cột `id` (UUID hoặc BIGINT/INT8) (22P02)
      if (errCode === '22P02') {
        if (errMsgLower.includes('uuid') && mem.idFormat !== 'uuid') {
          mem.idFormat = 'uuid';
          continue;
        }
        if (
          (errMsgLower.includes('int') || errMsgLower.includes('numeric')) &&
          mem.idFormat !== 'int'
        ) {
          mem.idFormat = 'int';
          continue;
        }
      }

      // 3. Cột gửi lên không tồn tại trên bảng Supabase (PGRST204 / 42703)
      if (errCode === 'PGRST204' || errCode === '42703') {
        const match =
          errMsg.match(/'([^']+)' column/) ||
          errMsg.match(/column "([^"]+)"/);
        const missingCol = match?.[1];
        if (missingCol && !mem.unsupportedColumns.has(missingCol)) {
          mem.unsupportedColumns.add(missingCol);
          continue;
        }
      }

      // 4. Bảng có các cột phẳng NOT NULL -> chuyển sang Stage 3
      if (errCode === '23502' && stage !== 3) {
        mem.preferredStage = 3;
        break;
      }

      break;
    }
  }

  return false;
}

export async function upsertLogsToSupabase(
  itemsOrSingle: ErrorLogItem | ErrorLogItem[]
): Promise<boolean> {
  const cfg = getSupabaseRuntimeConfig();
  if (!cfg.isConfigured) return false;

  const list = Array.isArray(itemsOrSingle) ? itemsOrSingle : [itemsOrSingle];
  const baseUrl = `${cfg.url}/rest/v1/${encodeURIComponent(cfg.tableName)}`;
  const tableKey = `${cfg.url}::${cfg.tableName}`;

  try {
    const logsOk = await tryPostRowsWithFallback(
      baseUrl,
      cfg.anonKey,
      list,
      tableKey
    );

    if (logsOk && typeof window !== 'undefined') {
      try {
        const rawSubs =
          window.localStorage.getItem('OMNI_SUBJECTS_AND_TOPICS_V2') || '';
        const rawSources =
          window.localStorage.getItem('OMNI_CUSTOM_SOURCES_LIST_V1') || '';
        const currentSnapshot = `${rawSubs}|||${rawSources}`;

        if (
          (rawSubs || rawSources) &&
          currentSnapshot !== lastSyncedMetaSnapshot
        ) {
          lastSyncedMetaSnapshot = currentSnapshot;
          const metaItem = {
            id: TAXONOMY_META_ROW_ID,
            subjectId: 'META',
            subjectName: 'META',
            topic: 'META',
            questionText: 'META',
            leitnerBox: 5,
            isResolved: true,
            subjects: rawSubs ? JSON.parse(rawSubs) : undefined,
            sources: rawSources ? JSON.parse(rawSources) : undefined,
            updatedAt: new Date().toISOString(),
          } as unknown as ErrorLogItem;

          void tryPostRowsWithFallback(
            baseUrl,
            cfg.anonKey,
            [metaItem],
            tableKey
          ).catch(() => false);
        }
      } catch {
        // Bỏ qua
      }
    }

    return logsOk;
  } catch {
    return false;
  }
}

export async function deleteLogFromSupabase(id: string): Promise<boolean> {
  const cfg = getSupabaseRuntimeConfig();
  if (!cfg.isConfigured || !id) return false;

  const mem = getSchemaMemory(`${cfg.url}::${cfg.tableName}`);
  const targetId = String(formatDbId(id, mem.idFormat));

  try {
    const endpoint = `${cfg.url}/rest/v1/${encodeURIComponent(
      cfg.tableName
    )}?id=eq.${encodeURIComponent(targetId)}`;
    const res = await fetch(endpoint, {
      method: 'DELETE',
      headers: buildSupabaseHeaders(cfg.anonKey, 'return=minimal'),
    });
    return res.ok;
  } catch {
    return false;
  }
}
