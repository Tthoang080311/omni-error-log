// File: src/app/page.tsx
'use client';

import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
  useDeferredValue,
  memo,
} from 'react';
import { ErrorLogItem, DashboardAnalytics } from '@/types/error-log';
import {
  INITIAL_SUBJECTS,
  WHY_DICTIONARY,
  PROCESS_BREAKPOINTS,
} from '@/constants/taxonomy';
import ErrorEntryForm from '@/components/ErrorEntryForm';
import CommandPalette from '@/components/CommandPalette';
import AiForensicModal from '@/components/AiForensicModal';
import AnalyticsDashboard from '@/components/AnalyticsDashboard';
import RedemptionReview, {
  exportLogsToAnkiCsv,
} from '@/components/RedemptionReview';
import MathText from '@/components/MathText';
import {
  buildDeepYoutubeUrl,
  formatSecondsToMinSec,
} from '@/components/ReferenceLocator';
import {
  fetchAllLogsFromSupabase,
  upsertLogsToSupabase,
  deleteLogFromSupabase,
} from '@/lib/supabase-sync';
import {
  BookOpen,
  BarChart3,
  Flame,
  ShieldCheck,
  Search,
  Sparkles,
  KeyRound,
  Download,
  Edit3,
  Trash2,
  Youtube,
  Clock,
  Command,
  RefreshCw,
  Wifi,
  WifiOff,
  Keyboard,
  Delete,
  CornerDownLeft,
  Space,
} from 'lucide-react';

type ActiveWorkspaceTab = 'WORKSTATION' | 'ANALYTICS' | 'REVIEW' | 'CHECKLIST';
type VnImeMode = 'OFF' | 'TELEX' | 'VNI';
type LiveSyncStatus =
  | 'LIVE_CLOUD'
  | 'LIVE_LOCAL'
  | 'SYNCING'
  | 'OFFLINE_QUEUE'
  | 'ERROR';

interface OfflineOutboxAction {
  id: string;
  timestamp: number;
  type: 'PATCH_ITEM' | 'REVIEW_GRADE' | 'DELETE_ITEM';
  payload: Record<string, unknown>;
}

const SYNC_CHANNEL_NAME = 'OMNI_ERROR_LOG_LIVE_SYNC_V1';
const LOCAL_CACHE_KEY = 'OMNI_ERROR_LOG_SNAPSHOT_V1';
const LOCAL_OUTBOX_KEY = 'OMNI_ERROR_LOG_OUTBOX_V1';
const LOCAL_IME_MODE_KEY = 'OMNI_VN_IME_MODE';

// ============================================================================
// HÀM CHUẨN HÓA DỮ LIỆU CHỐNG SẬP (.twinQuestions.length, .whyCodes, .references)
// ============================================================================
function sanitizeLogItem(raw: any): ErrorLogItem {
  const base =
    raw?.payload && typeof raw.payload === 'object'
      ? { ...raw, ...raw.payload }
      : { ...(raw || {}) };

  const subId = base.subjectId || base.subject_id || base.subject || 'MATH';
  const subDef = INITIAL_SUBJECTS.find((s) => s.id === subId);
  const leitnerBox = (Number(base.leitnerBox ?? base.leitner_box ?? 1) ||
    1) as ErrorLogItem['leitnerBox'];

  return {
    ...base,
    id: String(
      base.id || `log_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
    ),
    subjectId: subId,
    subjectName:
      base.subjectName || base.subject_name || subDef?.name || String(subId),
    topic: String(base.topic ?? ''),
    questionText: String(
      base.questionText ?? base.question_text ?? base.question ?? ''
    ),
    problemImageUrl: base.problemImageUrl ?? base.problem_image_url ?? undefined,
    myWrongStep: String(
      base.myWrongStep ?? base.my_wrong_step ?? base.myAnswer ?? ''
    ),
    correctSolution: String(
      base.correctSolution ?? base.correct_solution ?? base.correctAnswer ?? ''
    ),
    processBreakpoint:
      base.processBreakpoint ?? base.process_breakpoint ?? 'DECODE',
    whyCodes: Array.isArray(base.whyCodes)
      ? base.whyCodes
      : Array.isArray(base.why_codes)
        ? base.why_codes
        : [],
    ifTrigger: String(base.ifTrigger ?? base.if_trigger ?? ''),
    thenAction: String(
      base.thenAction ?? base.then_action ?? base.actionPlan ?? ''
    ),
    twinQuestions: Array.isArray(base.twinQuestions)
      ? base.twinQuestions
      : Array.isArray(base.twin_questions)
        ? base.twin_questions
        : [],
    references: Array.isArray(base.references) ? base.references : [],
    leitnerBox,
    nextReviewDate: String(
      base.nextReviewDate ??
        base.next_review_date ??
        getLocalTodayDateString()
    ),
    isResolved: Boolean(base.isResolved ?? base.is_resolved ?? leitnerBox >= 4),
    createdAt: String(
      base.createdAt ?? base.created_at ?? new Date().toISOString()
    ),
    updatedAt: String(
      base.updatedAt ?? base.updated_at ?? new Date().toISOString()
    ),
  };
}

function sanitizeLogList(list: unknown): ErrorLogItem[] {
  if (!Array.isArray(list)) return [];
  return list
    .filter((item) => item && typeof item === 'object')
    .map((item) => sanitizeLogItem(item));
}

// ============================================================================
// COMPONENT ĐỒNG HỒ REALTIME (MEMO HÓA ĐỂ KHÔNG GÂY RE-RENDER TOÀN TRANG)
// ============================================================================
const RealtimeClockBadge = memo(function RealtimeClockBadge() {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const timer = window.setInterval(() => {
      setNow(new Date());
    }, 1000);
    return () => window.clearInterval(timer);
  }, []);

  if (!now) {
    return (
      <div className="inline-flex items-center gap-1.5 rounded-lg border border-botanical-border bg-botanical-canvas px-2.5 py-1 font-mono text-[11px] font-bold text-botanical-ink">
        <Clock className="h-3.5 w-3.5 text-botanical-sage" />
        <span>--:--:--</span>
      </div>
    );
  }

  const timeStr = now.toLocaleTimeString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  const dateStr = now.toLocaleDateString('vi-VN', {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });

  return (
    <div
      title="Đồng hồ thời gian thực (Realtime Clock)"
      className="inline-flex items-center gap-1.5 rounded-lg border border-botanical-border bg-botanical-canvas px-2.5 py-1 text-[11px] shadow-sm"
    >
      <Clock className="h-3.5 w-3.5 animate-pulse text-botanical-sage" />
      <span className="font-mono font-extrabold tracking-tight text-botanical-ink">
        {timeStr}
      </span>
      <span className="hidden border-l border-botanical-border pl-1.5 font-medium text-botanical-muted sm:inline">
        {dateStr}
      </span>
    </div>
  );
});

// ============================================================================
// 0. ENGINE TÍNH TOÁN THỐNG KÊ PARETO 80/20, THUẾ ẨU & LEITNER TRỰC TIẾP
// ============================================================================
function getLocalTodayDateString(): string {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function computeRealtimeAnalytics(
  rawItems: ErrorLogItem[],
  serverAnalytics?: DashboardAnalytics
): DashboardAnalytics {
  const items = sanitizeLogList(rawItems);

  if (
    serverAnalytics &&
    serverAnalytics.totalLogs === items.length &&
    items.length > 0 &&
    serverAnalytics.paretoWhyDistribution?.length > 0
  ) {
    return serverAnalytics;
  }

  const totalLogs = items.length;
  const todayLocal = getLocalTodayDateString();
  const todayIso = new Date().toISOString().slice(0, 10);

  const resolvedCount = items.filter((it) => (it.leitnerBox ?? 1) >= 4).length;

  const dueTodayCount = items.filter((it) => {
    if ((it.leitnerBox ?? 1) >= 5 && it.isResolved) return false;
    if (!it.nextReviewDate) return true;
    return it.nextReviewDate <= todayLocal || it.nextReviewDate <= todayIso;
  }).length;

  // 1. Tính Thuế Ẩu (Tỷ lệ bản ghi dính ít nhất 1 mã lỗi Nhóm A)
  const carelessItemsCount = items.filter((it) =>
    (it.whyCodes || []).some((code) => String(code).startsWith('A'))
  ).length;
  const carelessTaxPercent =
    totalLogs > 0 ? Math.round((carelessItemsCount / totalLogs) * 100) : 0;

  // 2. Tính Phân phối Pareto 80/20 theo Mã lỗi WHY
  const whyCounts = new Map<string, number>();
  let totalWhyOccurrences = 0;

  items.forEach((it) => {
    (it.whyCodes || []).forEach((code) => {
      whyCounts.set(code, (whyCounts.get(code) || 0) + 1);
      totalWhyOccurrences += 1;
    });
  });

  const sortedWhyEntries = Array.from(whyCounts.entries()).sort(
    (a, b) => b[1] - a[1]
  );

  let runningCount = 0;
  const paretoWhyDistribution = sortedWhyEntries.map(([code, count]) => {
    const def = WHY_DICTIONARY.find((w) => w.code === code);
    const prevCumulativePercent =
      totalWhyOccurrences > 0
        ? Math.round((runningCount / totalWhyOccurrences) * 100)
        : 0;
    runningCount += count;
    const percent =
      totalWhyOccurrences > 0
        ? Math.round((count / totalWhyOccurrences) * 100)
        : 0;
    const cumulativePercent =
      totalWhyOccurrences > 0
        ? Math.min(100, Math.round((runningCount / totalWhyOccurrences) * 100))
        : 0;
    const isTop80 = prevCumulativePercent < 80;
    const group = String(code).charAt(0) as 'A' | 'B' | 'C';

    return {
      code,
      whyCode: code,
      title: def ? def.title : code,
      label: def ? def.title : code,
      group,
      category: def?.category || group,
      count,
      percent,
      percentage: percent,
      cumulativePercent,
      cumulativePercentage: cumulativePercent,
      isTop80,
      isVitalFew: isTop80,
      inPareto80: isTop80,
    };
  });

  // 3. Tính Phễu Điểm Gãy Quy Trình Tư Duy (Giai đoạn 1 -> 4)
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

  // 4. Tính Tỷ trọng "Thuế Ẩu" vs "Hổng Kiến Thức" theo từng Môn học
  const subjectMap = new Map<
    string,
    { subjectId: string; subjectName: string; list: ErrorLogItem[] }
  >();

  items.forEach((it) => {
    const existing = subjectMap.get(it.subjectId);
    if (existing) {
      existing.list.push(it);
    } else {
      const subDef = INITIAL_SUBJECTS.find((s) => s.id === it.subjectId);
      subjectMap.set(it.subjectId, {
        subjectId: it.subjectId,
        subjectName: it.subjectName || subDef?.name || it.subjectId,
        list: [it],
      });
    }
  });

  const subjectCarelessBreakdown = Array.from(subjectMap.values()).map(
    ({ subjectId, subjectName, list }) => {
      const subTotal = list.length;
      const carelessCount = list.filter((it) =>
        (it.whyCodes || []).some((c) => String(c).startsWith('A'))
      ).length;
      const knowledgeCount = subTotal - carelessCount;
      const carelessPercent =
        subTotal > 0 ? Math.round((carelessCount / subTotal) * 100) : 0;
      const knowledgePercent = subTotal > 0 ? 100 - carelessPercent : 0;

      return {
        subjectId,
        subjectName,
        total: subTotal,
        totalLogs: subTotal,
        count: subTotal,
        carelessCount,
        knowledgeCount,
        deepCount: knowledgeCount,
        carelessPercent,
        carelessTaxPercent: carelessPercent,
        knowledgePercent,
        deepPercent: knowledgePercent,
      };
    }
  );

  return {
    totalLogs,
    resolvedCount,
    dueTodayCount,
    carelessTaxPercent,
    subjectCarelessBreakdown:
      subjectCarelessBreakdown as unknown as DashboardAnalytics['subjectCarelessBreakdown'],
    paretoWhyDistribution:
      paretoWhyDistribution as unknown as DashboardAnalytics['paretoWhyDistribution'],
    breakpointFunnel:
      breakpointFunnel as unknown as DashboardAnalytics['breakpointFunnel'],
  };
}

// ============================================================================
// 1. ENGINE BỘ GÕ TIẾNG VIỆT DỰ PHÒNG (TELEX / VNI) — O(1) ZERO-RENDER
// ============================================================================
const VN_VOWEL_TABLE: readonly string[][] = [
  ['a', 'á', 'à', 'ả', 'ã', 'ạ'],
  ['ă', 'ắ', 'ằ', 'ẳ', 'ẵ', 'ặ'],
  ['â', 'ấ', 'ầ', 'ẩ', 'ẫ', 'ậ'],
  ['e', 'é', 'è', 'ẻ', 'ẽ', 'ẹ'],
  ['ê', 'ế', 'ề', 'ể', 'ễ', 'ệ'],
  ['i', 'í', 'ì', 'ỉ', 'ĩ', 'ị'],
  ['o', 'ó', 'ò', 'ỏ', 'õ', 'ọ'],
  ['ô', 'ố', 'ồ', 'ổ', 'ỗ', 'ộ'],
  ['ơ', 'ớ', 'ờ', 'ở', 'ỡ', 'ợ'],
  ['u', 'ú', 'ù', 'ủ', 'ũ', 'ụ'],
  ['ư', 'ứ', 'ừ', 'ử', 'ữ', 'ự'],
  ['y', 'ý', 'ỳ', 'ỷ', 'ỹ', 'ỵ'],
];

interface VowelLookupInfo {
  baseIdx: number;
  toneIdx: number;
  isUpper: boolean;
}

const CHAR_TO_VOWEL_MAP = new Map<string, VowelLookupInfo>();
VN_VOWEL_TABLE.forEach((row, baseIdx) => {
  row.forEach((ch, toneIdx) => {
    CHAR_TO_VOWEL_MAP.set(ch, { baseIdx, toneIdx, isUpper: false });
    CHAR_TO_VOWEL_MAP.set(ch.toUpperCase(), {
      baseIdx,
      toneIdx,
      isUpper: true,
    });
  });
});

function buildVowelChar(
  baseIdx: number,
  toneIdx: number,
  isUpper: boolean
): string {
  const ch = VN_VOWEL_TABLE[baseIdx]?.[toneIdx] ?? '';
  return isUpper ? ch.toUpperCase() : ch;
}

function findPrimaryToneTargetIndex(
  chars: string[],
  vowelIndices: number[]
): number {
  if (vowelIndices.length === 0) return -1;
  if (vowelIndices.length === 1) return vowelIndices[0];

  const accentedPositions = vowelIndices.filter((idx) => {
    const info = CHAR_TO_VOWEL_MAP.get(chars[idx]);
    return info && [1, 2, 4, 7, 8, 10].includes(info.baseIdx);
  });
  if (accentedPositions.length > 0) {
    return accentedPositions[accentedPositions.length - 1];
  }

  const wordLower = chars.join('').toLowerCase();
  let effectiveVowels = [...vowelIndices];
  if (
    (wordLower.startsWith('qu') || wordLower.startsWith('gi')) &&
    effectiveVowels.length > 1 &&
    effectiveVowels[0] === 1
  ) {
    effectiveVowels = effectiveVowels.slice(1);
  }
  if (effectiveVowels.length === 1) return effectiveVowels[0];

  const lastVowelPos = effectiveVowels[effectiveVowels.length - 1];
  const hasEndingConsonant = lastVowelPos < chars.length - 1;
  if (hasEndingConsonant || effectiveVowels.length >= 3) {
    return effectiveVowels[effectiveVowels.length - 2];
  }

  const pairBases = effectiveVowels
    .map((idx) => CHAR_TO_VOWEL_MAP.get(chars[idx])?.baseIdx)
    .join('-');
  if (pairBases === '6-0' || pairBases === '6-3' || pairBases === '9-11') {
    return effectiveVowels[1];
  }

  return effectiveVowels[0];
}

function transformVietnameseWord(
  rawWord: string,
  keyTyped: string,
  mode: VnImeMode
): string | null {
  if (mode === 'OFF' || !rawWord || keyTyped.length !== 1) return null;

  const lowerKey = keyTyped.toLowerCase();
  const chars = Array.from(rawWord);

  if (
    (mode === 'TELEX' && lowerKey === 'd') ||
    (mode === 'VNI' && lowerKey === '9')
  ) {
    const firstChar = chars[0];
    if (firstChar === 'd' || firstChar === 'D') {
      chars[0] = firstChar === 'D' ? 'Đ' : 'đ';
      return chars.join('');
    }
    if (firstChar === 'đ' || firstChar === 'Đ') {
      chars[0] = firstChar === 'Đ' ? 'D' : 'd';
      return chars.join('') + keyTyped;
    }
  }

  const vowelIndices: number[] = [];
  chars.forEach((ch, idx) => {
    if (CHAR_TO_VOWEL_MAP.has(ch)) vowelIndices.push(idx);
  });

  if (vowelIndices.length === 0) return null;

  const isCircumflexTrigger =
    (mode === 'TELEX' && ['a', 'e', 'o'].includes(lowerKey)) ||
    (mode === 'VNI' && lowerKey === '6');
  const isBreveOrHornTrigger =
    (mode === 'TELEX' && lowerKey === 'w') ||
    (mode === 'VNI' && (lowerKey === '7' || lowerKey === '8'));

  if (isCircumflexTrigger) {
    for (let i = vowelIndices.length - 1; i >= 0; i--) {
      const idx = vowelIndices[i];
      const info = CHAR_TO_VOWEL_MAP.get(chars[idx])!;
      if (mode === 'TELEX') {
        if (lowerKey === 'a' && info.baseIdx === 0) {
          chars[idx] = buildVowelChar(2, info.toneIdx, info.isUpper);
          return chars.join('');
        }
        if (lowerKey === 'a' && info.baseIdx === 2) {
          chars[idx] = buildVowelChar(0, info.toneIdx, info.isUpper);
          return chars.join('') + keyTyped;
        }
        if (lowerKey === 'e' && info.baseIdx === 3) {
          chars[idx] = buildVowelChar(4, info.toneIdx, info.isUpper);
          return chars.join('');
        }
        if (lowerKey === 'e' && info.baseIdx === 4) {
          chars[idx] = buildVowelChar(3, info.toneIdx, info.isUpper);
          return chars.join('') + keyTyped;
        }
        if (lowerKey === 'o' && info.baseIdx === 6) {
          chars[idx] = buildVowelChar(7, info.toneIdx, info.isUpper);
          return chars.join('');
        }
        if (lowerKey === 'o' && info.baseIdx === 7) {
          chars[idx] = buildVowelChar(6, info.toneIdx, info.isUpper);
          return chars.join('') + keyTyped;
        }
      } else {
        if (info.baseIdx === 0) {
          chars[idx] = buildVowelChar(2, info.toneIdx, info.isUpper);
          return chars.join('');
        }
        if (info.baseIdx === 3) {
          chars[idx] = buildVowelChar(4, info.toneIdx, info.isUpper);
          return chars.join('');
        }
        if (info.baseIdx === 6) {
          chars[idx] = buildVowelChar(7, info.toneIdx, info.isUpper);
          return chars.join('');
        }
        if ([2, 4, 7].includes(info.baseIdx)) {
          const revertMap: Record<number, number> = { 2: 0, 4: 3, 7: 6 };
          chars[idx] = buildVowelChar(
            revertMap[info.baseIdx],
            info.toneIdx,
            info.isUpper
          );
          return chars.join('') + keyTyped;
        }
      }
    }
  }

  if (isBreveOrHornTrigger) {
    for (let i = 0; i < vowelIndices.length - 1; i++) {
      const idx1 = vowelIndices[i];
      const idx2 = vowelIndices[i + 1];
      const info1 = CHAR_TO_VOWEL_MAP.get(chars[idx1])!;
      const info2 = CHAR_TO_VOWEL_MAP.get(chars[idx2])!;
      if (
        idx2 === idx1 + 1 &&
        (info1.baseIdx === 9 || info1.baseIdx === 10) &&
        (info2.baseIdx === 6 || info2.baseIdx === 7 || info2.baseIdx === 8) &&
        (mode === 'TELEX' || lowerKey === '7')
      ) {
        if (info1.baseIdx === 10 && info2.baseIdx === 8) {
          chars[idx1] = buildVowelChar(9, info1.toneIdx, info1.isUpper);
          chars[idx2] = buildVowelChar(6, info2.toneIdx, info2.isUpper);
          return chars.join('') + keyTyped;
        }
        chars[idx1] = buildVowelChar(10, info1.toneIdx, info1.isUpper);
        chars[idx2] = buildVowelChar(8, info2.toneIdx, info2.isUpper);
        return chars.join('');
      }
    }

    for (let i = vowelIndices.length - 1; i >= 0; i--) {
      const idx = vowelIndices[i];
      const info = CHAR_TO_VOWEL_MAP.get(chars[idx])!;
      if (mode === 'TELEX' || lowerKey === '8') {
        if (info.baseIdx === 0 || info.baseIdx === 2) {
          chars[idx] = buildVowelChar(1, info.toneIdx, info.isUpper);
          return chars.join('');
        }
        if (info.baseIdx === 1) {
          chars[idx] = buildVowelChar(0, info.toneIdx, info.isUpper);
          return chars.join('') + keyTyped;
        }
      }
      if (mode === 'TELEX' || lowerKey === '7') {
        if (info.baseIdx === 6 || info.baseIdx === 7) {
          chars[idx] = buildVowelChar(8, info.toneIdx, info.isUpper);
          return chars.join('');
        }
        if (info.baseIdx === 8) {
          chars[idx] = buildVowelChar(6, info.toneIdx, info.isUpper);
          return chars.join('') + keyTyped;
        }
        if (info.baseIdx === 9) {
          chars[idx] = buildVowelChar(10, info.toneIdx, info.isUpper);
          return chars.join('');
        }
        if (info.baseIdx === 10) {
          chars[idx] = buildVowelChar(9, info.toneIdx, info.isUpper);
          return chars.join('') + keyTyped;
        }
      }
    }
  }

  const telexToneMap: Record<string, number> = {
    z: 0,
    s: 1,
    f: 2,
    r: 3,
    x: 4,
    j: 5,
  };
  const vniToneMap: Record<string, number> = {
    '0': 0,
    '1': 1,
    '2': 2,
    '3': 3,
    '4': 4,
    '5': 5,
  };
  const targetTone =
    mode === 'TELEX' ? telexToneMap[lowerKey] : vniToneMap[lowerKey];

  if (targetTone !== undefined) {
    const targetVowelIdx = findPrimaryToneTargetIndex(chars, vowelIndices);
    if (targetVowelIdx === -1) return null;

    let existingToneIdx = 0;
    let existingPos = targetVowelIdx;
    for (const vIdx of vowelIndices) {
      const info = CHAR_TO_VOWEL_MAP.get(chars[vIdx])!;
      if (info.toneIdx !== 0) {
        existingToneIdx = info.toneIdx;
        existingPos = vIdx;
        break;
      }
    }

    if (targetTone === 0) {
      if (existingToneIdx === 0) return null;
      const oldInfo = CHAR_TO_VOWEL_MAP.get(chars[existingPos])!;
      chars[existingPos] = buildVowelChar(oldInfo.baseIdx, 0, oldInfo.isUpper);
      return chars.join('');
    }

    if (existingToneIdx === targetTone) {
      const oldInfo = CHAR_TO_VOWEL_MAP.get(chars[existingPos])!;
      chars[existingPos] = buildVowelChar(oldInfo.baseIdx, 0, oldInfo.isUpper);
      return chars.join('') + keyTyped;
    }

    if (existingToneIdx !== 0 && existingPos !== targetVowelIdx) {
      const oldInfo = CHAR_TO_VOWEL_MAP.get(chars[existingPos])!;
      chars[existingPos] = buildVowelChar(oldInfo.baseIdx, 0, oldInfo.isUpper);
    }

    const targetInfo = CHAR_TO_VOWEL_MAP.get(chars[targetVowelIdx])!;
    chars[targetVowelIdx] = buildVowelChar(
      targetInfo.baseIdx,
      targetTone,
      targetInfo.isUpper
    );
    return chars.join('');
  }

  return null;
}

function setReactInputValue(
  el: HTMLInputElement | HTMLTextAreaElement,
  nextValue: string,
  nextCursorPos: number
) {
  const proto =
    el instanceof HTMLTextAreaElement
      ? window.HTMLTextAreaElement.prototype
      : window.HTMLInputElement.prototype;
  const nativeValueSetter = Object.getOwnPropertyDescriptor(
    proto,
    'value'
  )?.set;

  if (nativeValueSetter) {
    nativeValueSetter.call(el, nextValue);
  } else {
    el.value = nextValue;
  }

  el.dispatchEvent(new Event('input', { bubbles: true }));
  try {
    el.setSelectionRange(nextCursorPos, nextCursorPos);
  } catch {
    // Bỏ qua nếu input không hỗ trợ setSelectionRange
  }
}

// ============================================================================
// 2. COMPONENT THẺ BẢN GHI ĐƯỢC MEMO HÓA ĐỂ ĐẢM BẢO 60FPS KHI GÕ PHÍM
// ============================================================================
interface MemoizedLogCardProps {
  item: ErrorLogItem;
  onOpenForensic: (item: ErrorLogItem) => void;
  onStartEdit: (item: ErrorLogItem) => void;
  onDelete: (id: string) => void;
}

const MemoizedLogCard = memo(function MemoizedLogCard({
  item,
  onOpenForensic,
  onStartEdit,
  onDelete,
}: MemoizedLogCardProps) {
  const bpTitle =
    PROCESS_BREAKPOINTS.find((b) => b.id === item.processBreakpoint)?.title ||
    item.processBreakpoint;

  const twinCount = Array.isArray(item.twinQuestions)
    ? item.twinQuestions.length
    : 0;
  const safeWhyCodes = Array.isArray(item.whyCodes) ? item.whyCodes : [];
  const safeReferences = Array.isArray(item.references) ? item.references : [];

  const subDef = INITIAL_SUBJECTS.find((s) => s.id === item.subjectId);
  const subjectBadgeClass =
    subDef?.badgeBg || 'bg-botanical-sage text-white';

  return (
    <article
      style={{ contentVisibility: 'auto', containIntrinsicSize: '260px' }}
      className="botanical-paper-card rounded-xl p-5"
    >
      {/* Dòng meta trên cùng của thẻ */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-botanical-border pb-2.5">
        <div className="flex flex-wrap items-center gap-2">
          <span className={`rounded-md px-2.5 py-0.5 font-mono text-xs font-bold ${subjectBadgeClass}`}>
            {subDef?.name || item.subjectName}
          </span>
          <span className="rounded-md bg-botanical-chipBg px-2.5 py-0.5 text-xs font-semibold text-botanical-chipText">
            {item.topic}
          </span>
          <span className="rounded border border-botanical-border bg-botanical-canvas px-2 py-0.5 text-[11px] font-medium text-botanical-muted">
            {bpTitle}
          </span>
          <span className="rounded border border-botanical-border bg-botanical-canvas px-2 py-0.5 font-mono text-[11px] text-botanical-eucalyptus">
            Hộp Leitner {item.leitnerBox} (Ôn: {item.nextReviewDate})
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => onOpenForensic(item)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-botanical-terracotta bg-botanical-terracottaBg px-3 py-1 text-xs font-bold text-botanical-terracotta transition hover:bg-botanical-terracotta hover:text-white"
          >
            <Sparkles className="h-3.5 w-3.5" />
            Phòng Khám AI &amp; Bài Tập Sinh Đôi ({twinCount})
          </button>

          <button
            type="button"
            onClick={() => onStartEdit(item)}
            className="rounded-lg border border-botanical-border bg-botanical-canvas p-1.5 text-botanical-muted hover:text-botanical-ink"
            title="Chỉnh sửa bản ghi"
          >
            <Edit3 className="h-3.5 w-3.5" />
          </button>

          <button
            type="button"
            onClick={() => onDelete(item.id)}
            className="rounded-lg border border-botanical-border bg-botanical-canvas p-1.5 text-botanical-muted hover:text-botanical-terracotta"
            title="Xóa bản ghi"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Nội dung 3 cột thu gọn: WHAT - WHY - HOW */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        {/* Cột 1: Đề bài, Bước sai, Lời giải & Ảnh */}
        <div className="space-y-2.5 text-xs lg:col-span-5">
          <div className="rounded-lg border border-botanical-border bg-botanical-canvas p-3">
            <span className="mb-1 block font-mono text-[10px] font-bold uppercase text-botanical-muted">
              Đề bài:
            </span>
            <MathText content={item.questionText} />
          </div>

          {item.problemImageUrl && (
            <img
              src={item.problemImageUrl}
              alt="Annotated mistake"
              loading="lazy"
              className="max-h-48 w-full rounded-lg border border-botanical-border bg-botanical-canvas object-contain p-1"
            />
          )}
        </div>

        {/* Cột 2: Bước sai vs Lời giải chuẩn + Mã WHY */}
        <div className="space-y-2.5 text-xs lg:col-span-4">
          <div className="rounded-lg border border-botanical-terracotta/40 bg-botanical-terracottaBg/40 p-2.5">
            <span className="font-bold text-botanical-terracotta">
              Bước làm sai:{' '}
            </span>
            <MathText content={item.myWrongStep} />
          </div>

          <div className="rounded-lg border border-botanical-matcha/40 bg-botanical-matchaBg/40 p-2.5">
            <span className="font-bold text-botanical-matcha">
              Lời giải chuẩn:{' '}
            </span>
            <MathText content={item.correctSolution} />
          </div>

          <div className="flex flex-wrap gap-1.5 pt-1">
            {safeWhyCodes.map((code) => {
              const def = WHY_DICTIONARY.find((w) => w.code === code);
              return (
                <span
                  key={code}
                  className="rounded-md border border-botanical-terracotta/40 bg-botanical-terracottaBg px-2 py-0.5 text-[11px] font-semibold text-botanical-terracotta"
                >
                  {def ? def.title : code}
                </span>
              );
            })}
          </div>
        </div>

        {/* Cột 3: Phản xạ NẾU - THÌ & Link định vị YouTube */}
        <div className="flex flex-col justify-between space-y-2.5 rounded-lg border border-botanical-sage/30 bg-botanical-mossMist/40 p-3 text-xs lg:col-span-3">
          <div className="space-y-2">
            <span className="inline-block rounded bg-botanical-sage px-2 py-0.5 font-mono text-[10px] font-bold uppercase text-white">
              PHÁC ĐỒ NẾU — THÌ
            </span>
            <div>
              <strong className="text-botanical-ochre">NẾU: </strong>
              <MathText content={item.ifTrigger} className="inline" />
            </div>
            <div>
              <strong className="text-botanical-matcha">THÌ: </strong>
              <MathText content={item.thenAction} className="inline" />
            </div>
          </div>

          {/* Nguồn tham chiếu YouTube ?t= / Sách */}
          {safeReferences.length > 0 && (
            <div className="space-y-1 border-t border-botanical-border pt-2">
              {safeReferences.map((ref) => (
                <div
                  key={ref.id}
                  className="flex items-center justify-between gap-1 text-[11px]"
                >
                  <span className="truncate font-medium text-botanical-ink">
                    • {ref.title}
                  </span>
                  {ref.type === 'YOUTUBE' && ref.url && (
                    <a
                      href={buildDeepYoutubeUrl(
                        ref.url,
                        ref.youtubeTimestampSec
                      )}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex shrink-0 items-center gap-1 rounded bg-botanical-terracotta px-1.5 py-0.5 font-mono text-[10px] font-bold text-white"
                    >
                      <Youtube className="h-3 w-3" />
                      <Clock className="h-2.5 w-2.5" />
                      {formatSecondsToMinSec(ref.youtubeTimestampSec) || 'Mở'}
                    </a>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </article>
  );
});

// ============================================================================
// 3. TRANG CHÍNH OMNI ERROR LOG APP PAGE
// ============================================================================
export default function OmniErrorLogAppPage() {
  const [logs, setLogs] = useState<ErrorLogItem[]>([]);
  const [analytics, setAnalytics] = useState<DashboardAnalytics>(() =>
    computeRealtimeAnalytics([])
  );
  const [isLoading, setIsLoading] = useState(true);

  // Điều hướng Tab & Modal
  const [activeTab, setActiveTab] = useState<ActiveWorkspaceTab>('WORKSTATION');
  const [isCmdKOpen, setIsCmdKOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ErrorLogItem | null>(null);
  const [forensicModalItem, setForensicModalItem] =
    useState<ErrorLogItem | null>(null);

  // Bộ lọc danh sách bản ghi
  const [subjectFilter, setSubjectFilter] = useState<string>('ALL');
  const [whyFilter, setWhyFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const deferredSearchQuery = useDeferredValue(searchQuery);
  const deferredSubjectFilter = useDeferredValue(subjectFilter);
  const deferredWhyFilter = useDeferredValue(whyFilter);

  // Cấu hình nhanh Gemini API Key trên giao diện
  const [customApiKey, setCustomApiKey] = useState<string>('');
  const [showApiKeyModal, setShowApiKeyModal] = useState<boolean>(false);

  // --- STATE ĐỒNG BỘ TRỰC TIẾP (SQLITE + SUPABASE CLOUD + MULTI-TAB) ---
  const [syncStatus, setSyncStatus] = useState<LiveSyncStatus>('LIVE_LOCAL');
  const [lastSyncedAt, setLastSyncedAt] = useState<string>('');
  const [syncLatencyMs, setSyncLatencyMs] = useState<number | null>(null);
  const [pendingOutboxCount, setPendingOutboxCount] = useState<number>(0);
  const [autoLiveSync, setAutoLiveSync] = useState<boolean>(true);
  const broadcastChannelRef = useRef<BroadcastChannel | null>(null);
  const lastPayloadSignatureRef = useRef<string>('');
  const isFetchingRef = useRef<boolean>(false);

  // --- STATE BÀN PHÍM TIẾNG VIỆT DỰ PHÒNG ---
  const [vnImeMode, setVnImeMode] = useState<VnImeMode>('OFF');
  const [showVirtualKeyboard, setShowVirtualKeyboard] =
    useState<boolean>(false);
  const [virtualShift, setVirtualShift] = useState<boolean>(false);
  const lastFocusedInputRef = useRef<
    HTMLInputElement | HTMLTextAreaElement | null
  >(null);

  // Hàm đồng bộ nhất quán cả danh sách `logs` lẫn `analytics` trên toàn ứng dụng
  const applyLogsAndAnalytics = useCallback(
    (
      rawNextLogs: ErrorLogItem[],
      serverAnalytics?: DashboardAnalytics,
      shouldBroadcast = true
    ) => {
      const nextLogs = sanitizeLogList(rawNextLogs);
      const computedAnalytics = computeRealtimeAnalytics(
        nextLogs,
        serverAnalytics
      );
      const signature = `${nextLogs.length}_${nextLogs[0]?.updatedAt || ''}_${computedAnalytics.resolvedCount}_${computedAnalytics.dueTodayCount}_${computedAnalytics.carelessTaxPercent}`;
      lastPayloadSignatureRef.current = signature;

      setLogs(nextLogs);
      setAnalytics(computedAnalytics);

      try {
        window.localStorage.setItem(
          LOCAL_CACHE_KEY,
          JSON.stringify({
            logs: nextLogs,
            analytics: computedAnalytics,
            updatedAt: new Date().toISOString(),
          })
        );
      } catch {
        // Bỏ qua nếu bộ nhớ trình duyệt đầy
      }

      if (shouldBroadcast && broadcastChannelRef.current) {
        broadcastChannelRef.current.postMessage({
          type: 'STATE_SYNC',
          signature,
          logs: nextLogs,
          analytics: computedAnalytics,
          timestamp: Date.now(),
        });
      }
    },
    []
  );

  const flushOfflineOutbox = useCallback(async () => {
    try {
      const raw = window.localStorage.getItem(LOCAL_OUTBOX_KEY);
      if (!raw) {
        setPendingOutboxCount(0);
        return;
      }
      const queue: OfflineOutboxAction[] = JSON.parse(raw);
      if (!Array.isArray(queue) || queue.length === 0) {
        setPendingOutboxCount(0);
        return;
      }

      setSyncStatus('SYNCING');
      const remaining: OfflineOutboxAction[] = [];

      for (const action of queue) {
        try {
          if (action.type === 'PATCH_ITEM') {
            const res = await fetch('/api/logs', {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(action.payload),
            }).catch(() => null);
            const cloudOk = action.payload.updatedItem
              ? await upsertLogsToSupabase(
                  sanitizeLogItem(action.payload.updatedItem)
                ).catch(() => false)
              : false;
            if (!res?.ok && !cloudOk) remaining.push(action);
          } else if (action.type === 'REVIEW_GRADE') {
            const res = await fetch('/api/logs', {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(action.payload),
            }).catch(() => null);
            if (!res?.ok) remaining.push(action);
          } else if (action.type === 'DELETE_ITEM') {
            const id = String(action.payload.id || '');
            const res = await fetch(
              `/api/logs?id=${encodeURIComponent(id)}`,
              { method: 'DELETE' }
            ).catch(() => null);
            const cloudOk = await deleteLogFromSupabase(id).catch(() => false);
            if (!res?.ok && !cloudOk) remaining.push(action);
          }
        } catch {
          remaining.push(action);
        }
      }

      if (remaining.length > 0) {
        window.localStorage.setItem(
          LOCAL_OUTBOX_KEY,
          JSON.stringify(remaining)
        );
        setPendingOutboxCount(remaining.length);
        setSyncStatus('OFFLINE_QUEUE');
      } else {
        window.localStorage.removeItem(LOCAL_OUTBOX_KEY);
        setPendingOutboxCount(0);
      }
    } catch {
      // Giữ nguyên hàng đợi nếu lỗi parse
    }
  }, []);

  const enqueueOfflineAction = useCallback(
    (
      type: OfflineOutboxAction['type'],
      payload: Record<string, unknown>
    ) => {
      try {
        const raw = window.localStorage.getItem(LOCAL_OUTBOX_KEY);
        const queue: OfflineOutboxAction[] = raw ? JSON.parse(raw) : [];
        queue.push({
          id: `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          timestamp: Date.now(),
          type,
          payload,
        });
        window.localStorage.setItem(LOCAL_OUTBOX_KEY, JSON.stringify(queue));
        setPendingOutboxCount(queue.length);
        setSyncStatus('OFFLINE_QUEUE');
      } catch {
        setSyncStatus('ERROR');
      }
    },
    []
  );

  const fetchAllData = useCallback(
    async (silent = false) => {
      if (isFetchingRef.current) return;
      isFetchingRef.current = true;
      if (!silent) setIsLoading(true);
      setSyncStatus('SYNCING');
      const startPerf = performance.now();

      try {
        await flushOfflineOutbox();
        const [localRes, rawCloudLogs] = await Promise.all([
          fetch('/api/logs', { cache: 'no-store' })
            .then((r) => r.json())
            .catch(() => ({ ok: false, logs: [] })),
          fetchAllLogsFromSupabase().catch(() => null),
        ]);

        const localLogs: ErrorLogItem[] =
          localRes && localRes.ok && Array.isArray(localRes.logs)
            ? sanitizeLogList(localRes.logs)
            : [];

        const cloudLogs =
          rawCloudLogs !== null ? sanitizeLogList(rawCloudLogs) : null;

        if (localRes?.ok || cloudLogs !== null) {
          let mergedLogs: ErrorLogItem[] = [...localLogs];

          // Hợp nhất 2 chiều giữa API và Supabase Cloud
          if (cloudLogs !== null) {
            const byId = new Map<string, ErrorLogItem>();
            mergedLogs.forEach((item) => byId.set(item.id, item));

            const toPushToCloud: ErrorLogItem[] = [];
            const cloudIdSet = new Set<string>();

            cloudLogs.forEach((cItem) => {
              cloudIdSet.add(cItem.id);
              const existingLocal = byId.get(cItem.id);
              if (
                !existingLocal ||
                new Date(cItem.updatedAt || 0).getTime() >=
                  new Date(existingLocal.updatedAt || 0).getTime()
              ) {
                byId.set(cItem.id, cItem);
              }
            });

            mergedLogs.forEach((lItem) => {
              if (!cloudIdSet.has(lItem.id)) {
                toPushToCloud.push(lItem);
              }
            });

            if (toPushToCloud.length > 0) {
              void upsertLogsToSupabase(toPushToCloud).catch(() => false);
            }

            mergedLogs = Array.from(byId.values()).sort(
              (a, b) =>
                new Date(b.createdAt || 0).getTime() -
                new Date(a.createdAt || 0).getTime()
            );
          }

          const computedAnalytics = computeRealtimeAnalytics(
            mergedLogs,
            localRes?.analytics
          );
          const nextSig = `${mergedLogs.length}_${mergedLogs[0]?.updatedAt || ''}_${computedAnalytics.resolvedCount}_${computedAnalytics.dueTodayCount}_${computedAnalytics.carelessTaxPercent}`;

          if (!silent || nextSig !== lastPayloadSignatureRef.current) {
            applyLogsAndAnalytics(mergedLogs, localRes?.analytics, true);
          }

          setSyncLatencyMs(Math.round(performance.now() - startPerf));
          setLastSyncedAt(
            new Date().toLocaleTimeString('vi-VN', {
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
            })
          );
          setSyncStatus(
            cloudLogs !== null || localRes?.ok ? 'LIVE_CLOUD' : 'LIVE_LOCAL'
          );
        } else {
          setSyncStatus('ERROR');
        }
      } catch {
        try {
          const cached = window.localStorage.getItem(LOCAL_CACHE_KEY);
          if (cached && logs.length === 0) {
            const parsed = JSON.parse(cached);
            if (Array.isArray(parsed.logs)) {
              applyLogsAndAnalytics(
                sanitizeLogList(parsed.logs),
                parsed.analytics,
                false
              );
            }
          }
        } catch {
          // Bỏ qua lỗi đọc cache
        }
        setSyncStatus(pendingOutboxCount > 0 ? 'OFFLINE_QUEUE' : 'ERROR');
      } finally {
        isFetchingRef.current = false;
        if (!silent) setIsLoading(false);
      }
    },
    [
      applyLogsAndAnalytics,
      flushOfflineOutbox,
      logs.length,
      pendingOutboxCount,
    ]
  );

  useEffect(() => {
    void fetchAllData(false);
    const savedKey = window.localStorage.getItem('OMNI_CUSTOM_GEMINI_KEY');
    if (savedKey) setCustomApiKey(savedKey);

    const savedIme = window.localStorage.getItem(
      LOCAL_IME_MODE_KEY
    ) as VnImeMode | null;
    if (savedIme && ['OFF', 'TELEX', 'VNI'].includes(savedIme)) {
      setVnImeMode(savedIme);
    }

    const rawOutbox = window.localStorage.getItem(LOCAL_OUTBOX_KEY);
    if (rawOutbox) {
      try {
        const parsed = JSON.parse(rawOutbox);
        if (Array.isArray(parsed)) setPendingOutboxCount(parsed.length);
      } catch {
        // Bỏ qua
      }
    }
  }, [fetchAllData]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    if ('BroadcastChannel' in window) {
      const ch = new BroadcastChannel(SYNC_CHANNEL_NAME);
      ch.onmessage = (event) => {
        const msg = event.data;
        if (
          msg &&
          msg.type === 'STATE_SYNC' &&
          msg.signature !== lastPayloadSignatureRef.current
        ) {
          lastPayloadSignatureRef.current = msg.signature;
          const incomingLogs = sanitizeLogList(msg.logs);
          setLogs(incomingLogs);
          setAnalytics(
            computeRealtimeAnalytics(incomingLogs, msg.analytics)
          );
          setLastSyncedAt(
            new Date(msg.timestamp || Date.now()).toLocaleTimeString('vi-VN', {
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
            })
          );
        }
      };
      broadcastChannelRef.current = ch;
    }

    const handleVisibilityOrOnline = () => {
      if (document.visibilityState === 'visible' && autoLiveSync) {
        void fetchAllData(true);
      }
    };

    window.addEventListener('visibilitychange', handleVisibilityOrOnline);
    window.addEventListener('online', handleVisibilityOrOnline);
    window.addEventListener('focus', handleVisibilityOrOnline);

    const intervalId = window.setInterval(() => {
      if (
        autoLiveSync &&
        document.visibilityState === 'visible' &&
        !editingItem &&
        !forensicModalItem
      ) {
        void fetchAllData(true);
      }
    }, 12000);

    return () => {
      broadcastChannelRef.current?.close();
      window.removeEventListener('visibilitychange', handleVisibilityOrOnline);
      window.removeEventListener('online', handleVisibilityOrOnline);
      window.removeEventListener('focus', handleVisibilityOrOnline);
      window.clearInterval(intervalId);
    };
  }, [autoLiveSync, editingItem, fetchAllData, forensicModalItem]);

  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsCmdKOpen((prev) => !prev);
        return;
      }
      if (
        (e.ctrlKey || e.metaKey) &&
        e.shiftKey &&
        e.key.toLowerCase() === 'v'
      ) {
        e.preventDefault();
        setVnImeMode((prev) => {
          const next: VnImeMode =
            prev === 'OFF' ? 'TELEX' : prev === 'TELEX' ? 'VNI' : 'OFF';
          window.localStorage.setItem(LOCAL_IME_MODE_KEY, next);
          return next;
        });
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, []);

  useEffect(() => {
    const trackFocusTarget = (e: FocusEvent) => {
      const target = e.target;
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement
      ) {
        if (
          target.type !== 'password' &&
          target.type !== 'file' &&
          target.type !== 'checkbox' &&
          target.type !== 'radio'
        ) {
          lastFocusedInputRef.current = target;
        }
      }
    };

    const handleVietnameseKeyDown = (e: KeyboardEvent) => {
      if (vnImeMode === 'OFF') return;
      if (e.ctrlKey || e.metaKey || e.altKey || e.isComposing) return;
      if (e.key.length !== 1) return;

      const target = e.target;
      if (
        !(
          target instanceof HTMLInputElement ||
          target instanceof HTMLTextAreaElement
        )
      ) {
        return;
      }
      if (
        target.readOnly ||
        target.disabled ||
        target.type === 'password' ||
        target.type === 'number' ||
        target.type === 'email'
      ) {
        return;
      }

      const start = target.selectionStart;
      const end = target.selectionEnd;
      if (start === null || end === null || start !== end || start === 0) {
        return;
      }

      const value = target.value;
      let wordStart = start;
      while (wordStart > 0 && /[\p{L}]/u.test(value[wordStart - 1])) {
        wordStart--;
      }

      const currentWord = value.slice(wordStart, start);
      if (!currentWord) return;

      const transformed = transformVietnameseWord(
        currentWord,
        e.key,
        vnImeMode
      );
      if (transformed && transformed !== currentWord + e.key) {
        e.preventDefault();
        const nextValue =
          value.slice(0, wordStart) + transformed + value.slice(end);
        const nextCursor = wordStart + transformed.length;
        setReactInputValue(target, nextValue, nextCursor);
      }
    };

    document.addEventListener('focusin', trackFocusTarget, true);
    document.addEventListener('keydown', handleVietnameseKeyDown, true);
    return () => {
      document.removeEventListener('focusin', trackFocusTarget, true);
      document.removeEventListener('keydown', handleVietnameseKeyDown, true);
    };
  }, [vnImeMode]);

  const handleVirtualKeyInsert = useCallback(
    (keyToken: string) => {
      const target = lastFocusedInputRef.current;
      if (!target) return;

      target.focus();
      const start = target.selectionStart ?? target.value.length;
      const end = target.selectionEnd ?? target.value.length;
      const value = target.value;

      if (keyToken === 'BACKSPACE') {
        if (start === end && start > 0) {
          const nextVal = value.slice(0, start - 1) + value.slice(end);
          setReactInputValue(target, nextVal, start - 1);
        } else if (start !== end) {
          const nextVal = value.slice(0, start) + value.slice(end);
          setReactInputValue(target, nextVal, start);
        }
        return;
      }

      if (keyToken === 'SPACE') {
        const nextVal = value.slice(0, start) + ' ' + value.slice(end);
        setReactInputValue(target, nextVal, start + 1);
        return;
      }

      if (keyToken === 'ENTER') {
        if (target instanceof HTMLTextAreaElement) {
          const nextVal = value.slice(0, start) + '\n' + value.slice(end);
          setReactInputValue(target, nextVal, start + 1);
        }
        return;
      }

      const charToInsert = virtualShift ? keyToken.toUpperCase() : keyToken;

      if (vnImeMode !== 'OFF' && start === end && start > 0) {
        let wordStart = start;
        while (wordStart > 0 && /[\p{L}]/u.test(value[wordStart - 1])) {
          wordStart--;
        }
        const currentWord = value.slice(wordStart, start);
        if (currentWord) {
          const transformed = transformVietnameseWord(
            currentWord,
            charToInsert,
            vnImeMode
          );
          if (transformed) {
            const nextVal =
              value.slice(0, wordStart) + transformed + value.slice(end);
            setReactInputValue(target, nextVal, wordStart + transformed.length);
            return;
          }
        }
      }

      const nextVal =
        value.slice(0, start) + charToInsert + value.slice(end);
      setReactInputValue(target, nextVal, start + charToInsert.length);
    },
    [virtualShift, vnImeMode]
  );

  const filteredLogs = useMemo(() => {
    const q = deferredSearchQuery.trim().toLowerCase();
    return logs.filter((item) => {
      if (
        deferredSubjectFilter !== 'ALL' &&
        item.subjectId !== deferredSubjectFilter
      ) {
        return false;
      }
      if (
        deferredWhyFilter !== 'ALL' &&
        !(item.whyCodes || []).includes(deferredWhyFilter as never)
      ) {
        return false;
      }
      if (q) {
        const hay = `${item.subjectName} ${item.topic} ${item.questionText} ${item.myWrongStep} ${item.ifTrigger} ${item.thenAction}`.toLowerCase();
        return hay.includes(q);
      }
      return true;
    });
  }, [logs, deferredSubjectFilter, deferredWhyFilter, deferredSearchQuery]);

  const handleUpdateLogItem = useCallback(
    async (rawUpdated: ErrorLogItem) => {
      const updated = sanitizeLogItem(rawUpdated);
      const optimisticLogs = logs.map((it) =>
        it.id === updated.id ? updated : it
      );
      applyLogsAndAnalytics(optimisticLogs);

      if (forensicModalItem?.id === updated.id) {
        setForensicModalItem(updated);
      }

      try {
        setSyncStatus('SYNCING');
        const [res, cloudOk] = await Promise.all([
          fetch('/api/logs', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ updatedItem: updated }),
          }).catch(() => null),
          upsertLogsToSupabase(updated).catch(() => false),
        ]);
        const data = res ? await res.json().catch(() => null) : null;
        if (data?.ok || cloudOk) {
          if (forensicModalItem?.id === updated.id && data?.item) {
            setForensicModalItem(sanitizeLogItem(data.item));
          }
          setSyncStatus(cloudOk || data?.ok ? 'LIVE_CLOUD' : 'LIVE_LOCAL');
          setLastSyncedAt(
            new Date().toLocaleTimeString('vi-VN', {
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
            })
          );
          await fetchAllData(true);
        }
      } catch {
        enqueueOfflineAction('PATCH_ITEM', { updatedItem: updated });
      }
    },
    [
      applyLogsAndAnalytics,
      enqueueOfflineAction,
      fetchAllData,
      forensicModalItem?.id,
      logs,
    ]
  );

  const handleReviewGrade = useCallback(
    async (id: string, rememberedCorrectly: boolean) => {
      const intervals: Record<number, number> = {
        1: 1,
        2: 3,
        3: 7,
        4: 14,
        5: 30,
      };
      let updatedTargetItem: ErrorLogItem | null = null;

      const optimisticLogs = logs.map((it) => {
        if (it.id !== id) return it;
        const currentBox = it.leitnerBox || 1;
        const nextBox = rememberedCorrectly
          ? Math.min(5, currentBox + 1)
          : 1;
        const daysToAdd = intervals[nextBox] || 1;
        const nextDate = new Date();
        nextDate.setDate(nextDate.getDate() + daysToAdd);
        const nextReviewDate = nextDate.toISOString().slice(0, 10);

        updatedTargetItem = sanitizeLogItem({
          ...it,
          leitnerBox: nextBox as ErrorLogItem['leitnerBox'],
          nextReviewDate,
          isResolved: nextBox >= 4,
          updatedAt: new Date().toISOString(),
        });
        return updatedTargetItem;
      });

      applyLogsAndAnalytics(optimisticLogs);

      try {
        setSyncStatus('SYNCING');
        const [res, cloudOk] = await Promise.all([
          fetch('/api/logs', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              id,
              action: 'review',
              rememberedCorrectly,
            }),
          }).catch(() => null),
          updatedTargetItem
            ? upsertLogsToSupabase(updatedTargetItem).catch(() => false)
            : Promise.resolve(false),
        ]);
        const data = res ? await res.json().catch(() => null) : null;
        if (data?.ok || cloudOk) {
          setSyncStatus(cloudOk || data?.ok ? 'LIVE_CLOUD' : 'LIVE_LOCAL');
          setLastSyncedAt(
            new Date().toLocaleTimeString('vi-VN', {
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
            })
          );
          await fetchAllData(true);
        }
      } catch {
        enqueueOfflineAction('REVIEW_GRADE', {
          id,
          action: 'review',
          rememberedCorrectly,
        });
      }
    },
    [applyLogsAndAnalytics, enqueueOfflineAction, fetchAllData, logs]
  );

  const handleDeleteLog = useCallback(
    async (id: string) => {
      const nextLogs = logs.filter((item) => item.id !== id);
      applyLogsAndAnalytics(nextLogs);

      try {
        setSyncStatus('SYNCING');
        const [res, cloudOk] = await Promise.all([
          fetch(`/api/logs?id=${encodeURIComponent(id)}`, {
            method: 'DELETE',
          }).catch(() => null),
          deleteLogFromSupabase(id).catch(() => false),
        ]);
        const data = res ? await res.json().catch(() => null) : null;
        if (data?.ok || cloudOk) {
          setSyncStatus(cloudOk || data?.ok ? 'LIVE_CLOUD' : 'LIVE_LOCAL');
          setLastSyncedAt(
            new Date().toLocaleTimeString('vi-VN', {
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
            })
          );
        }
      } catch {
        enqueueOfflineAction('DELETE_ITEM', { id });
      }
    },
    [applyLogsAndAnalytics, enqueueOfflineAction, logs]
  );

  const handleStartEditCard = useCallback((item: ErrorLogItem) => {
    setEditingItem(sanitizeLogItem(item));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  return (
    <div className="min-h-screen bg-botanical-canvas text-botanical-ink">
      {/* HEADER ĐIỀU HƯỚNG BOTANICAL PAPER STUDIO */}
      <header className="sticky top-0 z-30 border-b border-botanical-border bg-botanical-surface/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-botanical-sage text-white shadow-sm">
              <BookOpen className="h-5 w-5" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-base font-extrabold tracking-tight text-botanical-ink">
                  OMNI-SUBJECT SMART ERROR LOG
                </h1>
                <span className="rounded bg-botanical-mossMist px-2 py-0.5 font-mono text-[10px] font-bold text-botanical-sage">
                  Botanical Paper Studio
                </span>
              </div>
              <p className="text-xs text-botanical-muted">
                Trạm Phân tích Lỗi sai Đa môn học &amp; Chẩn đoán Nhận thức AI • Local-First SQLite &amp; Supabase
              </p>
            </div>
          </div>

          {/* 4 Tab Chế độ Làm việc Chính */}
          <nav className="flex flex-wrap items-center gap-1 rounded-xl border border-botanical-border bg-botanical-canvas p-1">
            <button
              type="button"
              onClick={() => setActiveTab('WORKSTATION')}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                activeTab === 'WORKSTATION'
                  ? 'bg-botanical-sage text-white shadow-sm'
                  : 'text-botanical-ink hover:bg-botanical-mossMist'
              }`}
            >
              <BookOpen className="h-3.5 w-3.5" />
              Trạm Nhập Lỗi &amp; Sổ Tay ({analytics.totalLogs})
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('ANALYTICS')}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                activeTab === 'ANALYTICS'
                  ? 'bg-botanical-sage text-white shadow-sm'
                  : 'text-botanical-ink hover:bg-botanical-mossMist'
              }`}
            >
              <BarChart3 className="h-3.5 w-3.5" />
              Pareto 80/20 &amp; Thuế Ẩu ({analytics.carelessTaxPercent}%)
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('REVIEW')}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                activeTab === 'REVIEW'
                  ? 'bg-botanical-terracotta text-white shadow-sm'
                  : 'text-botanical-ink hover:bg-botanical-mossMist'
              }`}
            >
              <Flame className="h-3.5 w-3.5" />
              Phục Thù Leitner ({analytics.dueTodayCount})
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('CHECKLIST')}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                activeTab === 'CHECKLIST'
                  ? 'bg-botanical-matcha text-white shadow-sm'
                  : 'text-botanical-ink hover:bg-botanical-mossMist'
              }`}
            >
              <ShieldCheck className="h-3.5 w-3.5" />
              Checklist 5 Phút Phòng Thi
            </button>
          </nav>

          {/* Đồng hồ Realtime, Nút Đồng bộ Trực tiếp, Bộ gõ Tiếng Việt dự phòng, Cmd+K, Xuất Anki & Cài đặt AI Key */}
          <div className="flex flex-wrap items-center gap-1.5">
            {/* ĐỒNG HỒ REALTIME */}
            <RealtimeClockBadge />

            <div className="inline-flex items-center rounded-lg border border-botanical-border bg-botanical-canvas p-0.5 text-[11px]">
              <button
                type="button"
                onClick={() => void fetchAllData(false)}
                title={
                  lastSyncedAt
                    ? `Đồng bộ trực tiếp lần cuối lúc ${lastSyncedAt} (${syncLatencyMs ?? 0}ms). Bấm để đồng bộ ngay.`
                    : 'Bấm để đồng bộ dữ liệu trực tiếp'
                }
                className="inline-flex items-center gap-1 rounded-md px-2 py-1 font-semibold text-botanical-ink hover:bg-botanical-mossMist"
              >
                {syncStatus === 'SYNCING' ? (
                  <RefreshCw className="h-3.5 w-3.5 animate-spin text-botanical-sage" />
                ) : syncStatus === 'LIVE_CLOUD' ||
                  syncStatus === 'LIVE_LOCAL' ? (
                  <Wifi className="h-3.5 w-3.5 text-botanical-matcha" />
                ) : (
                  <WifiOff className="h-3.5 w-3.5 text-botanical-terracotta" />
                )}
                <span>
                  {syncStatus === 'LIVE_CLOUD'
                    ? 'Cloud + SQLite'
                    : syncStatus === 'LIVE_LOCAL'
                      ? 'Local Sync'
                      : syncStatus === 'SYNCING'
                        ? 'Đang đồng bộ...'
                        : pendingOutboxCount > 0
                          ? `Chờ đồng bộ (${pendingOutboxCount})`
                          : 'Offline Cache'}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setAutoLiveSync((prev) => !prev)}
                className={`rounded px-1.5 py-0.5 font-mono text-[10px] font-bold transition ${
                  autoLiveSync
                    ? 'bg-botanical-sage text-white'
                    : 'text-botanical-muted hover:text-botanical-ink'
                }`}
                title="Bật/Tắt tự động đồng bộ thời gian thực giữa các Tab, SQLite & Supabase"
              >
                {autoLiveSync ? 'AUTO' : 'MANUAL'}
              </button>
            </div>

            <div className="inline-flex items-center rounded-lg border border-botanical-border bg-botanical-canvas p-0.5 text-[11px]">
              <button
                type="button"
                onClick={() => {
                  setVnImeMode((prev) => {
                    const next: VnImeMode =
                      prev === 'OFF'
                        ? 'TELEX'
                        : prev === 'TELEX'
                          ? 'VNI'
                          : 'OFF';
                    window.localStorage.setItem(LOCAL_IME_MODE_KEY, next);
                    return next;
                  });
                }}
                title="Bộ gõ Tiếng Việt nội bộ dự phòng khi bộ gõ hệ điều hành bị lỗi (Phím tắt: Ctrl+Shift+V)"
                className={`inline-flex items-center gap-1 rounded-md px-2 py-1 font-bold transition ${
                  vnImeMode !== 'OFF'
                    ? 'bg-botanical-terracotta text-white shadow-sm'
                    : 'text-botanical-ink hover:bg-botanical-mossMist'
                }`}
              >
                <Keyboard className="h-3.5 w-3.5" />
                <span>
                  {vnImeMode === 'OFF'
                    ? 'Gõ Việt: TẮT'
                    : `Gõ Việt: ${vnImeMode}`}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setShowVirtualKeyboard((prev) => !prev)}
                title="Mở/Đóng Bàn phím ảo Tiếng Việt trên màn hình (dùng khi liệt phím vật lý)"
                className={`rounded px-1.5 py-0.5 font-mono text-[10px] font-bold transition ${
                  showVirtualKeyboard
                    ? 'bg-botanical-sage text-white'
                    : 'text-botanical-muted hover:text-botanical-ink'
                }`}
              >
                Ảo
              </button>
            </div>

            <button
              type="button"
              onClick={() => setIsCmdKOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-botanical-border bg-botanical-canvas px-2.5 py-1.5 text-xs font-semibold text-botanical-ink hover:border-botanical-sage"
            >
              <Command className="h-3.5 w-3.5 text-botanical-eucalyptus" />
              <span>Lệnh nhanh</span>
              <kbd className="rounded border border-botanical-border bg-botanical-surface px-1 font-mono text-[10px]">
                ⌘K
              </kbd>
            </button>

            <button
              type="button"
              onClick={() => exportLogsToAnkiCsv(logs)}
              className="inline-flex items-center gap-1 rounded-lg border border-botanical-border bg-botanical-canvas px-2.5 py-1.5 text-xs font-semibold text-botanical-sage hover:border-botanical-sage"
              title="Xuất toàn bộ ra file Anki CSV"
            >
              <Download className="h-3.5 w-3.5" /> Anki .CSV
            </button>

            <button
              type="button"
              onClick={() => setShowApiKeyModal((p) => !p)}
              className="inline-flex items-center gap-1 rounded-lg border border-botanical-border bg-botanical-canvas px-2.5 py-1.5 text-xs font-medium text-botanical-muted hover:text-botanical-ink"
              title="Cấu hình Gemini API Key"
            >
              <KeyRound className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Thanh nhập nhanh API Key nếu người dùng mở */}
        {showApiKeyModal && (
          <div className="border-t border-botanical-border bg-botanical-mossMist/70 px-6 py-2.5">
            <div className="mx-auto flex max-w-4xl items-center gap-3 text-xs">
              <span className="font-semibold text-botanical-sage">
                Gemini API Key (Tùy chọn — Mặc định đã tích hợp sẵn trong .env.local):
              </span>
              <input
                type="password"
                value={customApiKey}
                onChange={(e) => {
                  setCustomApiKey(e.target.value);
                  window.localStorage.setItem(
                    'OMNI_CUSTOM_GEMINI_KEY',
                    e.target.value
                  );
                }}
                placeholder="AIzaSy..."
                className="flex-1 rounded border border-botanical-border bg-botanical-surface px-2.5 py-1 text-xs"
              />
              <button
                type="button"
                onClick={() => setShowApiKeyModal(false)}
                className="rounded bg-botanical-sage px-3 py-1 font-semibold text-white"
              >
                Lưu &amp; Đóng
              </button>
            </div>
          </div>
        )}
      </header>

      {/* KHU VỰC LÀM VIỆC CHÍNH */}
      <main className="mx-auto max-w-[1440px] space-y-8 px-4 py-6 sm:px-6">
        {activeTab === 'WORKSTATION' && (
          <>
            {/* 1. Form Nhập Lỗi 3 Cột WHAT - WHY - HOW */}
            <ErrorEntryForm
              editingItem={editingItem}
              customApiKey={customApiKey}
              onCancelEdit={() => setEditingItem(null)}
              onSaveSuccess={async (rawSavedItem, openTwinModal) => {
                const savedItem = sanitizeLogItem(rawSavedItem);
                setEditingItem(null);
                // Cập nhật Optimistic tức thì cả danh sách và bộ chỉ số Analytics (0ms)
                const nextLogs = [
                  savedItem,
                  ...logs.filter((it) => it.id !== savedItem.id),
                ];
                applyLogsAndAnalytics(nextLogs);

                if (openTwinModal) {
                  setForensicModalItem(savedItem);
                }

                // Chờ đẩy xong lên Supabase rồi mới đồng bộ lại
                await upsertLogsToSupabase(savedItem).catch(() => false);
                await fetchAllData(true);
              }}
            />

            {/* 2. Kho Lưu Trữ Sổ Tay Lỗi Sai Đa Môn Học */}
            <section className="space-y-4 pt-2">
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-botanical-border bg-botanical-surface px-4 py-3 shadow-paper">
                <div>
                  <h3 className="text-sm font-bold text-botanical-ink">
                    KHO HỒ SƠ LỖI SAI ĐÃ MỔ XẺ ({filteredLogs.length} bản ghi)
                  </h3>
                  <p className="text-xs text-botanical-muted">
                    Bấm vào nút{' '}
                    <strong>
                      &ldquo;Phòng Khám AI &amp; Bài Tập Sinh Đôi&rdquo;
                    </strong>{' '}
                    trên từng thẻ để giải bài tương tự phục thù tại chỗ.
                  </p>
                </div>

                {/* Bộ lọc Tìm kiếm, Môn học & Mã lỗi WHY */}
                <div className="flex flex-wrap items-center gap-2">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-botanical-muted" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Tìm đề bài, quy tắc NẾU-THÌ..."
                      className="rounded-lg border border-botanical-border bg-botanical-canvas py-1.5 pl-8 pr-3 text-xs text-botanical-ink focus:border-botanical-sage focus:outline-none"
                    />
                  </div>

                  <select
                    value={subjectFilter}
                    onChange={(e) => setSubjectFilter(e.target.value)}
                    className="rounded-lg border border-botanical-border bg-botanical-canvas px-2.5 py-1.5 text-xs font-medium text-botanical-ink"
                  >
                    <option value="ALL">Tất cả Môn học</option>
                    {INITIAL_SUBJECTS.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>

                  <select
                    value={whyFilter}
                    onChange={(e) => setWhyFilter(e.target.value)}
                    className="rounded-lg border border-botanical-border bg-botanical-canvas px-2.5 py-1.5 text-xs font-medium text-botanical-ink"
                  >
                    <option value="ALL">Tất cả Mã lỗi WHY</option>
                    {WHY_DICTIONARY.map((w) => (
                      <option key={w.code} value={w.code}>
                        {w.title}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {isLoading ? (
                <div className="py-12 text-center text-xs text-botanical-muted">
                  Đang tải cơ sở dữ liệu SQLite &amp; Supabase...
                </div>
              ) : filteredLogs.length === 0 ? (
                <div className="botanical-paper-card rounded-xl p-8 text-center text-xs text-botanical-muted">
                  Không có bản ghi nào khớp với bộ lọc hiện tại.
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredLogs.map((item) => (
                    <MemoizedLogCard
                      key={item.id}
                      item={item}
                      onOpenForensic={setForensicModalItem}
                      onStartEdit={handleStartEditCard}
                      onDelete={handleDeleteLog}
                    />
                  ))}
                </div>
              )}
            </section>
          </>
        )}

        {activeTab === 'ANALYTICS' && (
          <AnalyticsDashboard
            analytics={analytics}
            onSelectWhyFilter={(code) => {
              setWhyFilter(code);
              setActiveTab('WORKSTATION');
            }}
          />
        )}

        {activeTab === 'REVIEW' && (
          <RedemptionReview
            logs={logs}
            mode="REVIEW"
            onReviewGrade={handleReviewGrade}
          />
        )}

        {activeTab === 'CHECKLIST' && (
          <RedemptionReview
            logs={logs}
            mode="CHECKLIST"
            onReviewGrade={handleReviewGrade}
          />
        )}
      </main>

      {/* BÀN PHÍM ẢO TIẾNG VIỆT NỔI */}
      {showVirtualKeyboard && (
        <aside className="fixed bottom-4 right-4 z-40 w-full max-w-xl rounded-2xl border border-botanical-border bg-botanical-surface/95 p-3.5 shadow-2xl backdrop-blur">
          <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2 border-b border-botanical-border pb-2">
            <div className="flex items-center gap-2">
              <Keyboard className="h-4 w-4 text-botanical-sage" />
              <span className="text-xs font-extrabold text-botanical-ink">
                Bàn Phím Tiếng Việt Dự Phòng (Ký tự &amp; Toán học)
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              {(['OFF', 'TELEX', 'VNI'] as VnImeMode[]).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    setVnImeMode(mode);
                    window.localStorage.setItem(LOCAL_IME_MODE_KEY, mode);
                  }}
                  className={`rounded px-2 py-0.5 font-mono text-[10px] font-bold transition ${
                    vnImeMode === mode
                      ? 'bg-botanical-sage text-white'
                      : 'border border-botanical-border bg-botanical-canvas text-botanical-muted hover:text-botanical-ink'
                  }`}
                >
                  {mode === 'OFF' ? 'Tắt dấu' : mode}
                </button>
              ))}

              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => setShowVirtualKeyboard(false)}
                className="ml-1 rounded bg-botanical-terracottaBg px-2 py-0.5 text-[10px] font-bold text-botanical-terracotta hover:bg-botanical-terracotta hover:text-white"
              >
                Đóng
              </button>
            </div>
          </div>

          <div className="mb-1.5 flex flex-wrap gap-1">
            {[
              'ă',
              'â',
              'đ',
              'ê',
              'ô',
              'ơ',
              'ư',
              'á',
              'à',
              'ả',
              'ã',
              'ạ',
              '$',
              '\\frac{}{}',
              '\\sqrt{}',
              '\\Rightarrow',
            ].map((ch) => (
              <button
                key={ch}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => handleVirtualKeyInsert(ch)}
                className="flex-1 rounded-md border border-botanical-sage/30 bg-botanical-mossMist/60 px-1.5 py-1 font-mono text-[11px] font-bold text-botanical-sage hover:bg-botanical-sage hover:text-white"
              >
                {virtualShift && ch.length === 1 ? ch.toUpperCase() : ch}
              </button>
            ))}
          </div>

          {[
            ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'],
            ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l'],
            ['z', 'x', 'c', 'v', 'b', 'n', 'm', ',', '.', '?'],
          ].map((row, rIdx) => (
            <div key={rIdx} className="mb-1.5 flex justify-center gap-1">
              {row.map((keyChar) => (
                <button
                  key={keyChar}
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => handleVirtualKeyInsert(keyChar)}
                  className="min-w-[32px] flex-1 rounded-md border border-botanical-border bg-botanical-canvas py-1.5 text-center font-mono text-xs font-semibold text-botanical-ink shadow-sm active:scale-95 hover:border-botanical-sage"
                >
                  {virtualShift ? keyChar.toUpperCase() : keyChar}
                </button>
              ))}
            </div>
          ))}

          <div className="flex items-center gap-1.5 pt-0.5">
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => setVirtualShift((p) => !p)}
              className={`rounded-md border px-3 py-1.5 text-xs font-bold ${
                virtualShift
                  ? 'border-botanical-sage bg-botanical-sage text-white'
                  : 'border-botanical-border bg-botanical-canvas text-botanical-ink'
              }`}
            >
              ⇧ Shift
            </button>

            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => handleVirtualKeyInsert('SPACE')}
              className="inline-flex flex-1 items-center justify-center gap-1 rounded-md border border-botanical-border bg-botanical-canvas py-1.5 text-xs font-semibold text-botanical-ink hover:border-botanical-sage"
            >
              <Space className="h-3.5 w-3.5" /> Dấu cách
            </button>

            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => handleVirtualKeyInsert('ENTER')}
              className="inline-flex items-center gap-1 rounded-md border border-botanical-border bg-botanical-canvas px-3 py-1.5 text-xs font-semibold text-botanical-ink hover:border-botanical-sage"
            >
              <CornerDownLeft className="h-3.5 w-3.5" /> Xuống dòng
            </button>

            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => handleVirtualKeyInsert('BACKSPACE')}
              className="inline-flex items-center gap-1 rounded-md border border-botanical-terracotta/40 bg-botanical-terracottaBg px-3 py-1.5 text-xs font-bold text-botanical-terracotta hover:bg-botanical-terracotta hover:text-white"
            >
              <Delete className="h-3.5 w-3.5" /> Xóa
            </button>
          </div>
        </aside>
      )}

      {/* Bảng lệnh nhanh Cmd+K */}
      <CommandPalette
        isOpen={isCmdKOpen}
        onClose={() => setIsCmdKOpen(false)}
        onSwitchTab={(tab) => setActiveTab(tab)}
        onTriggerAiAutopsy={() => {
          if (logs.length > 0) setForensicModalItem(logs[0]);
        }}
        onExportAnkiCsv={() => exportLogsToAnkiCsv(logs)}
        onFilterSubject={(subId) => {
          setSubjectFilter(subId);
          setActiveTab('WORKSTATION');
        }}
      />

      {/* Phòng Khám Nghiệm AI & Giải Bài Tập Sinh Đôi */}
      <AiForensicModal
        item={forensicModalItem}
        customApiKey={customApiKey}
        onClose={() => setForensicModalItem(null)}
        onUpdateItem={handleUpdateLogItem}
      />
    </div>
  );
}
