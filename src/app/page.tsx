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
type LiveSyncStatus = 'LIVE_CLOUD' | 'LIVE_LOCAL' | 'SYNCING' | 'OFFLINE_QUEUE' | 'ERROR';

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

  if ((mode === 'TELEX' && lowerKey === 'd') || (mode === 'VNI' && lowerKey === '9')) {
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

  return (
    <article
      style={{ contentVisibility: 'auto', containIntrinsicSize: '260px' }}
      className="botanical-paper-card rounded-xl p-5"
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-botanical-border pb-2.5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-md bg-botanical-sage px-2.5 py-0.5 font-mono text-xs font-bold text-white">
            {item.subjectName}
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
            Phòng Khám AI &amp; Bài Tập Sinh Đôi ({item.twinQuestions.length})
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

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
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
            {item.whyCodes.map((code) => {
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

          {item.references.length > 0 && (
            <div className="space-y-1 border-t border-botanical-border pt-2">
              {item.references.map((ref) => (
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
  const [analytics, setAnalytics] = useState<DashboardAnalytics>({
    totalLogs: 0,
    resolvedCount: 0,
    dueTodayCount: 0,
    carelessTaxPercent: 0,
    subjectCarelessBreakdown: [],
    paretoWhyDistribution: [],
    breakpointFunnel: [],
  });
  const [isLoading, setIsLoading] = useState(true);

  const [activeTab, setActiveTab] = useState<ActiveWorkspaceTab>('WORKSTATION');
  const [isCmdKOpen, setIsCmdKOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ErrorLogItem | null>(null);
  const [forensicModalItem, setForensicModalItem] =
    useState<ErrorLogItem | null>(null);

  const [subjectFilter, setSubjectFilter] = useState<string>('ALL');
  const [whyFilter, setWhyFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const deferredSearchQuery = useDeferredValue(searchQuery);
  const deferredSubjectFilter = useDeferredValue(subjectFilter);
  const deferredWhyFilter = useDeferredValue(whyFilter);

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

  const broadcastSyncState = useCallback(
    (nextLogs: ErrorLogItem[], nextAnalytics: DashboardAnalytics) => {
      const signature = `${nextLogs.length}_${nextLogs[0]?.updatedAt || ''}_${nextAnalytics.resolvedCount}_${nextAnalytics.dueTodayCount}`;
      lastPayloadSignatureRef.current = signature;

      try {
        window.localStorage.setItem(
          LOCAL_CACHE_KEY,
          JSON.stringify({
            logs: nextLogs,
            analytics: nextAnalytics,
            updatedAt: new Date().toISOString(),
          })
        );
      } catch {
        // Bỏ qua nếu bộ nhớ đầy
      }

      if (broadcastChannelRef.current) {
        broadcastChannelRef.current.postMessage({
          type: 'STATE_SYNC',
          signature,
          logs: nextLogs,
          analytics: nextAnalytics,
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
            });
            if (action.payload.updatedItem) {
              await upsertLogsToSupabase(action.payload.updatedItem as ErrorLogItem);
            }
            if (!res.ok) remaining.push(action);
          } else if (action.type === 'REVIEW_GRADE') {
            const res = await fetch('/api/logs', {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(action.payload),
            });
            if (!res.ok) remaining.push(action);
          } else if (action.type === 'DELETE_ITEM') {
            const id = String(action.payload.id || '');
            const res = await fetch(
              `/api/logs?id=${encodeURIComponent(id)}`,
              { method: 'DELETE' }
            );
            await deleteLogFromSupabase(id);
            if (!res.ok) remaining.push(action);
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
        const [localRes, cloudLogs] = await Promise.all([
          fetch('/api/logs', { cache: 'no-store' }).then((r) => r.json()),
          fetchAllLogsFromSupabase(),
        ]);

        if (localRes.ok) {
          let mergedLogs: ErrorLogItem[] = localRes.logs || [];
          const incomingAnalytics: DashboardAnalytics = localRes.analytics;

          // Hợp nhất thông minh 2 chiều giữa SQLite nội bộ và Supabase Cloud
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
                new Date(cItem.updatedAt || 0).getTime() >
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
              void upsertLogsToSupabase(toPushToCloud);
            }

            mergedLogs = Array.from(byId.values()).sort(
              (a, b) =>
                new Date(b.createdAt || 0).getTime() -
                new Date(a.createdAt || 0).getTime()
            );
          }

          const nextSig = `${mergedLogs.length}_${mergedLogs[0]?.updatedAt || ''}_${incomingAnalytics.resolvedCount}_${incomingAnalytics.dueTodayCount}`;

          if (!silent || nextSig !== lastPayloadSignatureRef.current) {
            setLogs(mergedLogs);
            setAnalytics(incomingAnalytics);
            broadcastSyncState(mergedLogs, incomingAnalytics);
          }

          setSyncLatencyMs(Math.round(performance.now() - startPerf));
          setLastSyncedAt(
            new Date().toLocaleTimeString('vi-VN', {
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
            })
          );
          setSyncStatus(cloudLogs !== null ? 'LIVE_CLOUD' : 'LIVE_LOCAL');
        } else {
          setSyncStatus('ERROR');
        }
      } catch {
        try {
          const cached = window.localStorage.getItem(LOCAL_CACHE_KEY);
          if (cached && logs.length === 0) {
            const parsed = JSON.parse(cached);
            if (parsed.logs) setLogs(parsed.logs);
            if (parsed.analytics) setAnalytics(parsed.analytics);
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
    [broadcastSyncState, flushOfflineOutbox, logs.length, pendingOutboxCount]
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
          setLogs(msg.logs || []);
          setAnalytics(msg.analytics);
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
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'v') {
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
        !item.whyCodes.includes(deferredWhyFilter as never)
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
    async (updated: ErrorLogItem) => {
      setLogs((prev) => prev.map((it) => (it.id === updated.id ? updated : it)));
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
          }),
          upsertLogsToSupabase(updated),
        ]);
        const data = await res.json();
        if (data.ok) {
          setLogs(data.logs);
          setAnalytics(data.analytics);
          broadcastSyncState(data.logs, data.analytics);
          if (forensicModalItem?.id === updated.id) {
            setForensicModalItem(data.item);
          }
          setSyncStatus(cloudOk ? 'LIVE_CLOUD' : 'LIVE_LOCAL');
          setLastSyncedAt(
            new Date().toLocaleTimeString('vi-VN', {
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
            })
          );
        }
      } catch {
        enqueueOfflineAction('PATCH_ITEM', { updatedItem: updated });
      }
    },
    [broadcastSyncState, enqueueOfflineAction, forensicModalItem?.id]
  );

  const handleReviewGrade = useCallback(
    async (id: string, rememberedCorrectly: boolean) => {
      try {
        setSyncStatus('SYNCING');
        const res = await fetch('/api/logs', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id,
            action: 'review',
            rememberedCorrectly,
          }),
        });
        const data = await res.json();
        if (data.ok) {
          setLogs(data.logs);
          setAnalytics(data.analytics);
          broadcastSyncState(data.logs, data.analytics);
          const reviewedItem = (data.logs as ErrorLogItem[]).find(
            (it) => it.id === id
          );
          const cloudOk = reviewedItem
            ? await upsertLogsToSupabase(reviewedItem)
            : false;
          setSyncStatus(cloudOk ? 'LIVE_CLOUD' : 'LIVE_LOCAL');
          setLastSyncedAt(
            new Date().toLocaleTimeString('vi-VN', {
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
            })
          );
        }
      } catch {
        enqueueOfflineAction('REVIEW_GRADE', {
          id,
          action: 'review',
          rememberedCorrectly,
        });
      }
    },
    [broadcastSyncState, enqueueOfflineAction]
  );

  const handleDeleteLog = useCallback(
    async (id: string) => {
      setLogs((prev) => prev.filter((item) => item.id !== id));
      try {
        setSyncStatus('SYNCING');
        const [res, cloudOk] = await Promise.all([
          fetch(`/api/logs?id=${encodeURIComponent(id)}`, {
            method: 'DELETE',
          }),
          deleteLogFromSupabase(id),
        ]);
        const data = await res.json();
        if (data.ok) {
          setLogs(data.logs);
          setAnalytics(data.analytics);
          broadcastSyncState(data.logs, data.analytics);
          setSyncStatus(cloudOk ? 'LIVE_CLOUD' : 'LIVE_LOCAL');
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
    [broadcastSyncState, enqueueOfflineAction]
  );

  const handleStartEditCard = useCallback((item: ErrorLogItem) => {
    setEditingItem(item);
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
              <div className="flex items-center gap-2">
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

          {/* Nút Đồng bộ Trực tiếp, Bộ gõ Tiếng Việt dự phòng, Cmd+K, Xuất Anki & Cài đặt AI Key */}
          <div className="flex flex-wrap items-center gap-1.5">
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
                ) : syncStatus === 'LIVE_CLOUD' || syncStatus === 'LIVE_LOCAL' ? (
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
                  {vnImeMode === 'OFF' ? 'Gõ Việt: TẮT' : `Gõ Việt: ${vnImeMode}`}
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
            <ErrorEntryForm
              editingItem={editingItem}
              customApiKey={customApiKey}
              onCancelEdit={() => setEditingItem(null)}
              onSaveSuccess={(savedItem, openTwinModal) => {
                setEditingItem(null);
                void upsertLogsToSupabase(savedItem);
                void fetchAllData(true);
                if (openTwinModal) {
                  setForensicModalItem(savedItem);
                }
              }}
            />

            <section className="space-y-4 pt-2">
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-botanical-border bg-botanical-surface px-4 py-3 shadow-paper">
                <div>
                  <h3 className="text-sm font-bold text-botanical-ink">
                    KHO HỒ SƠ LỖI SAI ĐÃ MỔ XẺ ({filteredLogs.length} bản ghi)
                  </h3>
                  <p className="text-xs text-botanical-muted">
                    Bấm vào nút <strong>&ldquo;Phòng Khám AI &amp; Bài Tập Sinh Đôi&rdquo;</strong> trên từng thẻ để giải bài tương tự phục thù tại chỗ.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <div className="relative">
                    <Search className=" absolute left-2.5 top-2 h-3.5 w-3.5 text-botanical-muted" />
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
