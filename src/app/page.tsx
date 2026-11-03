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
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch';
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
  getSupabaseRuntimeConfig,
  saveSupabaseRuntimeConfig,
  testSupabaseConnection,
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
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Eye,
  EyeOff,
  Play,
  Pause,
  GripVertical,
  CheckCircle2,
  XCircle,
  FileText,
  Columns,
  FolderKanban,
  X,
  Maximize2,
  Layers,
  List,
  ChevronDown,
  ChevronRight,
  Tag,
  ArrowLeft,
  ArrowRight,
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
const LOCAL_SPLIT_RATIO_KEY = 'OMNI_SPLIT_PANE_LEFT_PERCENT_V1';
const LOCAL_SUBJECTS_STORAGE_KEY = 'OMNI_SUBJECTS_AND_TOPICS_V2';
const LOCAL_CUSTOM_SOURCES_KEY = 'OMNI_CUSTOM_SOURCES_LIST_V1';
const SOURCE_REF_PREFIX = '[NGUỒN]: ';
const DEFAULT_UNGROUPED_SOURCE = 'Chưa phân loại nguồn đề';

// ============================================================================
// HÀM ĐỌC / GHI "NGUỒN ĐỀ" TƯƠNG THÍCH 100% VỚI SQLITE & SUPABASE
// ============================================================================
function extractSourceFromItem(item: ErrorLogItem): string {
  const anyItem = item as Record<string, unknown>;
  if (typeof anyItem.sourceName === 'string' && anyItem.sourceName.trim()) {
    return anyItem.sourceName.trim();
  }
  const refs = Array.isArray(item.references) ? item.references : [];
  const taggedRef = refs.find(
    (r) => typeof r?.title === 'string' && r.title.startsWith(SOURCE_REF_PREFIX)
  );
  if (taggedRef) {
    return (
      taggedRef.title.slice(SOURCE_REF_PREFIX.length).trim() ||
      DEFAULT_UNGROUPED_SOURCE
    );
  }
  const firstNonYoutubeRef = refs.find(
    (r) => r?.type !== 'YOUTUBE' && typeof r?.title === 'string' && r.title.trim()
  );
  if (firstNonYoutubeRef) {
    return firstNonYoutubeRef.title.trim();
  }
  return DEFAULT_UNGROUPED_SOURCE;
}

function attachSourceToItem(
  item: ErrorLogItem,
  rawSourceName: string
): ErrorLogItem {
  const cleanSource = rawSourceName.trim();
  const existingRefs = Array.isArray(item.references)
    ? item.references.filter(
        (r) =>
          !(typeof r?.title === 'string' && r.title.startsWith(SOURCE_REF_PREFIX))
      )
    : [];

  const nextRefs = cleanSource
    ? [
        {
          id: `src_${item.id}`,
          title: `${SOURCE_REF_PREFIX}${cleanSource}`,
          type: 'BOOK' as const,
        },
        ...existingRefs,
      ]
    : existingRefs;

  return {
    ...item,
    references: nextRefs as ErrorLogItem['references'],
    ...(cleanSource ? { sourceName: cleanSource } : { sourceName: '' }),
  } as ErrorLogItem;
}

// ============================================================================
// DANH MỤC QUICK "ROOT CAUSE" TAGS (ĐỒNG BỘ TRỰC TIẾP VỚI WHY_CODES)
// ============================================================================
interface QuickRootCauseTag {
  id: string;
  label: string;
  mappedWhyCode: string;
  description: string;
}

const QUICK_ROOT_CAUSE_TAGS: readonly QuickRootCauseTag[] = [
  {
    id: 'TAG_VOCAB_TRAP',
    label: '🚨 Bẫy từ vựng',
    mappedWhyCode: 'B1',
    description: 'Hiểu nhầm từ khóa / bẫy diễn đạt (Paraphrase/Distractor)',
  },
  {
    id: 'TAG_FORMULA_ERR',
    label: '🧮 Sai công thức',
    mappedWhyCode: 'B2',
    description: 'Nhớ nhầm hoặc áp dụng sai điều kiện công thức Toán/Lý',
  },
  {
    id: 'TAG_TIME_PRESSURE',
    label: '⏰ Áp lực thời gian',
    mappedWhyCode: 'C1',
    description: 'Cuống giờ làm tắt bước hoặc đọc lướt dữ kiện cuối',
  },
  {
    id: 'TAG_CARELESS',
    label: '🙈 Bất cẩn',
    mappedWhyCode: 'A1',
    description: 'Tính nhẩm sai, nhìn nhầm dấu hoặc khoanh nhầm đáp án',
  },
];

// ============================================================================
// HÀM CHUẨN HÓA DỮ LIỆU CHỐNG SẬP (ĐÃ BỔ SUNG ĐẦY ĐỦ solutionImageUrl)
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
    problemImageUrl:
      base.problemImageUrl ?? base.problem_image_url ?? undefined,
    solutionImageUrl:
      base.solutionImageUrl ??
      base.solution_image_url ??
      base.answerImageUrl ??
      base.answer_image_url ??
      undefined,
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
// COMPONENT KHUNG ZOOM ĐA NĂNG (DÙNG CHO CẢ ĐỀ BÀI & ẢNH ĐÁP ÁN MỌI NƠI)
// ============================================================================
interface UniversalZoomableProblemViewProps {
  questionText: string;
  problemImageUrl?: string;
  titleBadge?: string;
  maxHeightClass?: string;
  onOpenFullscreen?: () => void;
}

const UniversalZoomableProblemView = memo(
  function UniversalZoomableProblemView({
    questionText,
    problemImageUrl,
    titleBadge = 'KHUNG SOI ĐỀ BÀI (CUỘN CHUỘT / CHỤM 2 NGÓN ĐỂ ZOOM & KÉO)',
    maxHeightClass = '!max-h-[460px]',
    onOpenFullscreen,
  }: UniversalZoomableProblemViewProps) {
    return (
      <div className="rounded-lg border border-botanical-border bg-botanical-surface p-2.5">
        <TransformWrapper
          initialScale={1}
          minScale={0.5}
          maxScale={5}
          wheel={{ step: 0.15 }}
          pinch={{ step: 5 }}
          doubleClick={{ mode: 'zoomIn' }}
          panning={{ velocityDisabled: false }}
        >
          {({ zoomIn, zoomOut, resetTransform }) => (
            <>
              <div className="mb-2 flex flex-wrap items-center justify-between gap-1.5 border-b border-botanical-border pb-1.5">
                <span className="font-mono text-[10px] font-bold uppercase text-botanical-sage">
                  {titleBadge}
                </span>

                <div className="flex flex-wrap items-center gap-1">
                  <button
                    type="button"
                    onClick={() => zoomIn(0.3)}
                    className="inline-flex items-center gap-1 rounded border border-botanical-border bg-botanical-canvas px-2 py-0.5 font-mono text-[10px] font-bold text-botanical-ink hover:border-botanical-sage hover:bg-botanical-mossMist"
                    title="Phóng to (Zoom In)"
                  >
                    <ZoomIn className="h-3 w-3 text-botanical-sage" /> Zoom +
                  </button>
                  <button
                    type="button"
                    onClick={() => zoomOut(0.3)}
                    className="inline-flex items-center gap-1 rounded border border-botanical-border bg-botanical-canvas px-2 py-0.5 font-mono text-[10px] font-bold text-botanical-ink hover:border-botanical-sage hover:bg-botanical-mossMist"
                    title="Thu nhỏ (Zoom Out)"
                  >
                    <ZoomOut className="h-3 w-3 text-botanical-sage" /> Zoom -
                  </button>
                  <button
                    type="button"
                    onClick={() => resetTransform()}
                    className="inline-flex items-center gap-1 rounded border border-botanical-border bg-botanical-canvas px-2 py-0.5 font-mono text-[10px] font-bold text-botanical-ink hover:border-botanical-sage"
                    title="Đặt lại tỷ lệ gốc 100%"
                  >
                    <RotateCcw className="h-3 w-3 text-botanical-terracotta" />{' '}
                    100%
                  </button>
                  {onOpenFullscreen && (
                    <button
                      type="button"
                      onClick={onOpenFullscreen}
                      className="inline-flex items-center gap-1 rounded border border-botanical-sage bg-botanical-sage px-2 py-0.5 font-mono text-[10px] font-bold text-white hover:bg-botanical-terracotta hover:border-botanical-terracotta"
                      title="Mở toàn màn hình để soi rõ nhất"
                    >
                      <Maximize2 className="h-3 w-3" /> Toàn màn hình
                    </button>
                  )}
                </div>
              </div>

              <div className="overflow-hidden rounded border border-botanical-border bg-botanical-canvas">
                <TransformComponent
                  wrapperClass={`!w-full ${maxHeightClass} cursor-grab active:cursor-grabbing`}
                  contentClass="!w-full flex flex-col items-center justify-center p-3 space-y-3"
                >
                  {questionText && questionText.trim().length > 0 && (
                    <div className="w-full rounded border border-botanical-border bg-botanical-surface p-3 text-xs leading-relaxed text-botanical-ink">
                      <MathText content={questionText} />
                    </div>
                  )}

                  {problemImageUrl ? (
                    <img
                      src={problemImageUrl}
                      alt="Hình ảnh minh họa"
                      className="max-h-[420px] w-auto object-contain select-none rounded border border-botanical-border bg-white p-1"
                    />
                  ) : (
                    !questionText?.trim() && (
                      <div className="py-8 text-center text-xs text-botanical-muted">
                        Chưa có ảnh hoặc văn bản.
                      </div>
                    )
                  )}
                </TransformComponent>
              </div>
            </>
          )}
        </TransformWrapper>
      </div>
    );
  }
);

// ============================================================================
// PARSER MARKDOWN CƠ BẢN KẾT HỢP <MathText /> CHO GIẤY NHÁP TOÁN / LÝ / SAT
// ============================================================================
const ScratchpadMarkdownMathPreview = memo(
  function ScratchpadMarkdownMathPreview({ content }: { content: string }) {
    if (!content.trim()) {
      return (
        <p className="text-xs italic text-botanical-muted">
          Chưa có nội dung nháp. Hãy gõ công thức LaTeX (ví dụ: $\Delta = b^2 - 4ac$) hoặc dàn ý bên trên...
        </p>
      );
    }

    const lines = content.split('\n');

    return (
      <div className="space-y-1.5 text-xs leading-relaxed text-botanical-ink">
        {lines.map((line, idx) => {
          const trimmed = line.trim();
          if (!trimmed) {
            return <div key={idx} className="h-1.5" />;
          }

          if (trimmed.startsWith('### ')) {
            return (
              <h5
                key={idx}
                className="font-mono text-xs font-extrabold uppercase tracking-tight text-botanical-sage"
              >
                <MathText content={trimmed.slice(4)} />
              </h5>
            );
          }

          if (trimmed.startsWith('## ') || trimmed.startsWith('# ')) {
            const cleanHeading = trimmed.replace(/^#+\s*/, '');
            return (
              <h4
                key={idx}
                className="border-b border-botanical-border pb-0.5 font-mono text-xs font-extrabold text-botanical-sage"
              >
                <MathText content={cleanHeading} />
              </h4>
            );
          }

          if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
            return (
              <div key={idx} className="flex items-start gap-2 pl-2">
                <span className="font-mono font-bold text-botanical-terracotta">
                  •
                </span>
                <div className="flex-1">
                  <MathText content={trimmed.slice(2)} />
                </div>
              </div>
            );
          }

          if (trimmed.startsWith('> ')) {
            return (
              <div
                key={idx}
                className="border-l-2 border-botanical-sage bg-botanical-mossMist/40 px-2.5 py-1 font-medium text-botanical-ink"
              >
                <MathText content={trimmed.slice(2)} />
              </div>
            );
          }

          const boldSegments = line.split(/(\*\*[^*]+\*\*)/g);
          return (
            <div key={idx} className="leading-relaxed">
              {boldSegments.map((seg, sIdx) => {
                if (seg.startsWith('**') && seg.endsWith('**') && seg.length > 4) {
                  return (
                    <strong
                      key={sIdx}
                      className="font-extrabold text-botanical-sage"
                    >
                      <MathText content={seg.slice(2, -2)} className="inline" />
                    </strong>
                  );
                }
                return <MathText key={sIdx} content={seg} className="inline" />;
              })}
            </div>
          );
        })}
      </div>
    );
  }
);

// ============================================================================
// COMPONENT ĐỒNG HỒ REALTIME (FLAT 2D, MEMO HÓA)
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
      className="inline-flex items-center gap-1.5 rounded-lg border border-botanical-border bg-botanical-canvas px-2.5 py-1 text-[11px]"
    >
      <Clock className="h-3.5 w-3.5 text-botanical-sage" />
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

function formatTimerSeconds(totalSec: number): string {
  const mins = Math.floor(totalSec / 60);
  const secs = totalSec % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
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

  const carelessItemsCount = items.filter((it) =>
    (it.whyCodes || []).some((code) => String(code).startsWith('A'))
  ).length;
  const carelessTaxPercent =
    totalLogs > 0 ? Math.round((carelessItemsCount / totalLogs) * 100) : 0;

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
// 2. TRẠM ACTIVE RECALL 2 CỘT (HIỂN THỊ ĐẦY ĐỦ ẢNH ĐÁP ÁN KHI LẬT + ZOOM IN/OUT)
// ============================================================================
interface ActiveRecallSplitWorkspaceProps {
  item: ErrorLogItem;
  onUpdateItem: (updated: ErrorLogItem) => void;
  onReviewGrade?: (id: string, rememberedCorrectly: boolean) => void;
  onOpenFullscreenZoom?: (item: ErrorLogItem) => void;
}

const ActiveRecallSplitWorkspace = memo(function ActiveRecallSplitWorkspace({
  item,
  onUpdateItem,
  onReviewGrade,
  onOpenFullscreenZoom,
}: ActiveRecallSplitWorkspaceProps) {
  const [leftPanePercent, setLeftPanePercent] = useState<number>(50);
  const splitContainerRef = useRef<HTMLDivElement | null>(null);
  const isDraggingSplitRef = useRef<boolean>(false);

  const [scratchpadText, setScratchpadText] = useState<string>('');
  const [showMarkdownPreview, setShowMarkdownPreview] = useState<boolean>(true);
  const [isAnswerRevealed, setIsAnswerRevealed] = useState<boolean>(false);

  const [redoSeconds, setRedoSeconds] = useState<number>(0);
  const [isTimerRunning, setIsTimerRunning] = useState<boolean>(false);

  useEffect(() => {
    try {
      const savedRatio = Number(
        window.localStorage.getItem(LOCAL_SPLIT_RATIO_KEY)
      );
      if (savedRatio >= 25 && savedRatio <= 75) {
        setLeftPanePercent(savedRatio);
      }
    } catch {
      // Bỏ qua
    }
  }, []);

  useEffect(() => {
    setScratchpadText('');
    setIsAnswerRevealed(false);
    setRedoSeconds(0);
    setIsTimerRunning(false);
  }, [item.id]);

  useEffect(() => {
    if (!isTimerRunning) return;
    const interval = window.setInterval(() => {
      setRedoSeconds((prev) => prev + 1);
    }, 1000);
    return () => window.clearInterval(interval);
  }, [isTimerRunning]);

  const handleStartDragSplit = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      e.preventDefault();
      isDraggingSplitRef.current = true;
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';

      const handlePointerMove = (moveEvent: PointerEvent) => {
        if (!isDraggingSplitRef.current || !splitContainerRef.current) return;
        const rect = splitContainerRef.current.getBoundingClientRect();
        if (rect.width <= 0) return;
        const rawPercent =
          ((moveEvent.clientX - rect.left) / rect.width) * 100;
        const clamped = Math.min(75, Math.max(25, Math.round(rawPercent)));
        setLeftPanePercent(clamped);
      };

      const handlePointerUp = () => {
        isDraggingSplitRef.current = false;
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        window.removeEventListener('pointermove', handlePointerMove);
        window.removeEventListener('pointerup', handlePointerUp);
      };

      window.addEventListener('pointermove', handlePointerMove);
      window.addEventListener('pointerup', handlePointerUp);
    },
    []
  );

  useEffect(() => {
    try {
      window.localStorage.setItem(
        LOCAL_SPLIT_RATIO_KEY,
        String(leftPanePercent)
      );
    } catch {
      // Bỏ qua
    }
  }, [leftPanePercent]);

  const handleScratchpadChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const nextVal = e.target.value;
      setScratchpadText(nextVal);
      if (!isAnswerRevealed && !isTimerRunning && nextVal.trim().length > 0) {
        setIsTimerRunning(true);
      }
    },
    [isAnswerRevealed, isTimerRunning]
  );

  const insertSnippetToScratchpad = useCallback(
    (snippet: string) => {
      setScratchpadText((prev) => (prev ? `${prev} ${snippet}` : snippet));
      if (!isAnswerRevealed && !isTimerRunning) {
        setIsTimerRunning(true);
      }
    },
    [isAnswerRevealed, isTimerRunning]
  );

  const handleRevealAnswer = useCallback(() => {
    setIsAnswerRevealed(true);
    setIsTimerRunning(false);
  }, []);

  const handleToggleQuickRootCauseTag = useCallback(
    (whyCode: string) => {
      const currentCodes = Array.isArray(item.whyCodes) ? item.whyCodes : [];
      const exists = currentCodes.includes(whyCode as never);
      const nextCodes = exists
        ? currentCodes.filter((c) => c !== whyCode)
        : [...currentCodes, whyCode as never];

      onUpdateItem({
        ...item,
        whyCodes: nextCodes,
        updatedAt: new Date().toISOString(),
      });
    },
    [item, onUpdateItem]
  );

  const safeWhyCodes = Array.isArray(item.whyCodes) ? item.whyCodes : [];
  const safeReferences = Array.isArray(item.references)
    ? item.references.filter(
        (r) =>
          !(typeof r?.title === 'string' && r.title.startsWith(SOURCE_REF_PREFIX))
      )
    : [];

  return (
    <div className="rounded-xl border border-botanical-border bg-botanical-canvas p-3">
      {/* Thanh công cụ điều chỉnh tỷ lệ cột nhanh */}
      <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2 border-b border-botanical-border pb-2 text-[11px]">
        <div className="flex items-center gap-2">
          <Columns className="h-3.5 w-3.5 text-botanical-sage" />
          <span className="font-mono font-bold uppercase text-botanical-ink">
            Bố cục 2 Cột Kéo Thả ({leftPanePercent}% Đề Bài /{' '}
            {100 - leftPanePercent}% Giấy Nháp)
          </span>
        </div>

        <div className="flex items-center gap-1">
          <span className="mr-1 text-botanical-muted">Chia nhanh:</span>
          {[
            { label: 'Đề rộng (65/35)', val: 65 },
            { label: 'Cân bằng (50/50)', val: 50 },
            { label: 'Nháp rộng (35/65)', val: 35 },
          ].map((preset) => (
            <button
              key={preset.val}
              type="button"
              onClick={() => setLeftPanePercent(preset.val)}
              className={`rounded border px-2 py-0.5 font-mono text-[10px] font-bold transition ${
                leftPanePercent === preset.val
                  ? 'border-botanical-sage bg-botanical-sage text-white'
                  : 'border-botanical-border bg-botanical-surface text-botanical-ink hover:bg-botanical-mossMist'
              }`}
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      {/* KHUNG RESIZABLE SPLIT PANE 2 CỘT */}
      <div
        ref={splitContainerRef}
        className="flex flex-col lg:flex-row lg:items-stretch"
      >
        {/* ================= CỘT TRÁI: ĐỀ BÀI & ZOOM PAN PINCH MỌI NƠI ================= */}
        <div
          style={{ width: `${leftPanePercent}%` }}
          className="w-full space-y-3 lg:pr-2 max-lg:!w-full"
        >
          <UniversalZoomableProblemView
            questionText={item.questionText}
            problemImageUrl={item.problemImageUrl}
            titleBadge="ĐỀ BÀI CẦN GIẢI LẠI (CUỘN CHUỘT HOẶC BẤM NÚT ĐỂ ZOOM IN / OUT)"
            onOpenFullscreen={
              onOpenFullscreenZoom ? () => onOpenFullscreenZoom(item) : undefined
            }
          />
        </div>

        {/* ================= THANH KÉO RESIZABLE HANDLE Ở GIỮA ================= */}
        <div
          onPointerDown={handleStartDragSplit}
          title="Kéo sang trái/phải để chỉnh kích thước 2 cột"
          className="my-2 flex cursor-col-resize items-center justify-center rounded border border-botanical-border bg-botanical-surface px-1 transition hover:border-botanical-sage hover:bg-botanical-mossMist lg:my-0 lg:w-3.5 lg:flex-col"
        >
          <GripVertical className="h-4 w-4 text-botanical-sage" />
        </div>

        {/* ================= CỘT PHẢI: GIẤY NHÁP + TIMER + ACTIVE RECALL ================= */}
        <div
          style={{ width: `${100 - leftPanePercent}%` }}
          className="w-full space-y-3 lg:pl-2 max-lg:!w-full"
        >
          <div className="rounded-lg border border-botanical-border bg-botanical-surface p-3.5">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2 border-b border-botanical-border pb-2">
              <div className="flex items-center gap-1.5">
                <FileText className="h-3.5 w-3.5 text-botanical-sage" />
                <span className="font-mono text-[11px] font-extrabold uppercase text-botanical-ink">
                  GIẤY NHÁP PHỤC THÙ (MARKDOWN &amp; LATEX)
                </span>
              </div>

              {/* FLOATING RE-DO TIMER */}
              <div className="inline-flex items-center gap-1.5 rounded-md border border-botanical-border bg-botanical-canvas px-2 py-0.5 text-[11px]">
                <Clock
                  className={`h-3 w-3 ${
                    isTimerRunning
                      ? 'text-botanical-terracotta'
                      : 'text-botanical-sage'
                  }`}
                />
                <span className="font-mono font-extrabold text-botanical-ink">
                  {formatTimerSeconds(redoSeconds)}
                </span>
                <button
                  type="button"
                  onClick={() => setIsTimerRunning((prev) => !prev)}
                  className="rounded border border-botanical-border bg-botanical-surface p-0.5 text-botanical-ink hover:border-botanical-sage"
                  title={
                    isTimerRunning
                      ? 'Tạm dừng bấm giờ'
                      : 'Bắt đầu / Tiếp tục bấm giờ'
                  }
                >
                  {isTimerRunning ? (
                    <Pause className="h-2.5 w-2.5 text-botanical-terracotta" />
                  ) : (
                    <Play className="h-2.5 w-2.5 text-botanical-sage" />
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsTimerRunning(false);
                    setRedoSeconds(0);
                  }}
                  className="rounded border border-botanical-border bg-botanical-surface p-0.5 text-botanical-muted hover:text-botanical-terracotta"
                  title="Đặt lại đồng hồ về 00:00"
                >
                  <RotateCcw className="h-2.5 w-2.5" />
                </button>
              </div>
            </div>

            {/* Thanh công cụ chèn nhanh Markdown & LaTeX */}
            <div className="mb-2 flex flex-wrap items-center justify-between gap-1.5">
              <div className="flex flex-wrap items-center gap-1">
                {[
                  { label: '$x^2$', token: '$x^2$' },
                  { label: 'Phân số', token: '$\\frac{a}{b}$' },
                  { label: 'Căn bậc 2', token: '$\\sqrt{x}$' },
                  { label: 'Suy ra ⇒', token: '$\\Rightarrow$' },
                  { label: 'Tích phân', token: '$\\int_{a}^{b}$' },
                  { label: 'In đậm', token: '**ý chính**' },
                ].map((btn) => (
                  <button
                    key={btn.label}
                    type="button"
                    onClick={() => insertSnippetToScratchpad(btn.token)}
                    className="rounded border border-botanical-border bg-botanical-canvas px-2 py-0.5 font-mono text-[10px] font-semibold text-botanical-ink hover:border-botanical-sage hover:bg-botanical-mossMist"
                  >
                    {btn.label}
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={() => setShowMarkdownPreview((prev) => !prev)}
                className="rounded border border-botanical-border bg-botanical-canvas px-2 py-0.5 font-mono text-[10px] font-bold text-botanical-sage hover:border-botanical-sage"
              >
                {showMarkdownPreview ? 'Ẩn Preview Toán' : 'Hiện Preview Toán'}
              </button>
            </div>

            <textarea
              rows={4}
              value={scratchpadText}
              onChange={handleScratchpadChange}
              placeholder="Tự viết các bước biến đổi, ĐKXĐ hoặc phản xạ NẾU-THÌ của bạn vào đây trước khi bấm Lật Đáp Án (Timer tự chạy khi gõ)..."
              className="w-full rounded-lg border border-botanical-border bg-botanical-canvas p-2.5 font-mono text-xs text-botanical-ink focus:border-botanical-sage focus:outline-none"
            />

            {showMarkdownPreview && (
              <div className="mt-2 rounded-lg border border-botanical-border bg-botanical-canvas p-2.5">
                <span className="mb-1 block font-mono text-[10px] font-bold uppercase text-botanical-muted">
                  Bản xem trước Markdown &amp; Công thức Toán (LaTeX):
                </span>
                <ScratchpadMarkdownMathPreview content={scratchpadText} />
              </div>
            )}
          </div>

          {/* LUỒNG ACTIVE RECALL: MẶC ĐỊNH GIẤU ĐÁP ÁN CHUẨN */}
          {!isAnswerRevealed ? (
            <div className="rounded-lg border border-botanical-terracotta/50 bg-botanical-terracottaBg/30 p-4 text-center">
              <p className="mb-2.5 text-xs font-medium text-botanical-ink">
                Đáp án chuẩn (Văn bản + Ảnh lời giải) và quy tắc NẾU — THÌ đang được giấu để kích hoạt{' '}
                <strong>Active Recall</strong>.
              </p>
              <button
                type="button"
                onClick={handleRevealAnswer}
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-botanical-sage bg-botanical-sage px-4 py-2.5 text-xs font-extrabold text-white transition hover:bg-botanical-terracotta hover:border-botanical-terracotta"
              >
                <Eye className="h-4 w-4" />
                Lật Đáp Án Chuẩn &amp; Đối Chiếu Quy Tắc NẾU — THÌ
              </button>
            </div>
          ) : (
            <div className="space-y-3 rounded-lg border border-botanical-sage bg-botanical-surface p-3.5">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-botanical-border pb-2">
                <span className="font-mono text-[11px] font-extrabold uppercase text-botanical-sage">
                  ĐỐI CHIẾU: [NHÁP CỦA TÔI] VS [ĐÁP ÁN CHUẨN &amp; ẢNH LỜI GIẢI]
                </span>
                <div className="flex items-center gap-2">
                  <span className="rounded border border-botanical-border bg-botanical-canvas px-2 py-0.5 font-mono text-[10px] font-bold text-botanical-ink">
                    Thời gian giải lại: {formatTimerSeconds(redoSeconds)}
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsAnswerRevealed(false)}
                    className="inline-flex items-center gap-1 rounded border border-botanical-border bg-botanical-canvas px-2 py-0.5 text-[10px] font-semibold text-botanical-muted hover:text-botanical-ink"
                  >
                    <EyeOff className="h-3 w-3" /> Úp lại đáp án
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3">
                {/* HỘP 1: NHÁP CỦA TÔI & BƯỚC LÀM SAI LẦN TRƯỚC */}
                <div className="grid grid-cols-1 gap-2.5 rounded-lg border border-botanical-terracotta/40 bg-botanical-terracottaBg/30 p-3 text-xs sm:grid-cols-2">
                  <div>
                    <span className="mb-1 block font-mono text-[10px] font-bold uppercase text-botanical-terracotta">
                      1A. Nháp vừa giải lại của tôi:
                    </span>
                    <ScratchpadMarkdownMathPreview content={scratchpadText} />
                  </div>
                  <div className="border-t border-botanical-border pt-2 sm:border-l sm:border-t-0 sm:pl-2.5 sm:pt-0">
                    <span className="mb-1 block font-mono text-[10px] font-bold uppercase text-botanical-terracotta">
                      1B. Bước làm sai lần trước:
                    </span>
                    {item.myWrongStep ? (
                      <MathText content={item.myWrongStep} />
                    ) : (
                      <span className="italic text-botanical-muted">
                        (Xem khoanh đỏ trên ảnh đề bài)
                      </span>
                    )}
                  </div>
                </div>

                {/* HỘP 2: ĐÁP ÁN & LỜI GIẢI CHUẨN (HIỂN THỊ CẢ VĂN BẢN + ẢNH LỜI GIẢI KÈM ZOOM) */}
                <div className="space-y-2.5 rounded-lg border border-botanical-matcha/50 bg-botanical-matchaBg/30 p-3 text-xs">
                  <div className="flex items-center justify-between border-b border-botanical-border pb-1.5">
                    <span className="font-mono text-[10px] font-extrabold uppercase text-botanical-matcha">
                      2A. Đáp án &amp; Lời giải chuẩn (Văn bản + Hình ảnh):
                    </span>
                  </div>

                  {/* Hiển thị văn bản lời giải chuẩn nếu có */}
                  {item.correctSolution && item.correctSolution.trim() && (
                    <div className="rounded border border-botanical-border bg-botanical-surface p-2.5 text-botanical-ink">
                      <MathText content={item.correctSolution} />
                    </div>
                  )}

                  {/* Hiển thị ẢNH LỜI GIẢI CHUẨN (solutionImageUrl) tích hợp Zoom In / Out & Toàn màn hình */}
                  {item.solutionImageUrl ? (
                    <UniversalZoomableProblemView
                      questionText=""
                      problemImageUrl={item.solutionImageUrl}
                      titleBadge="ẢNH LỜI GIẢI CHUẨN (CUỘN CHUỘT HOẶC BẤM NÚT ĐỂ ZOOM IN / OUT)"
                      maxHeightClass="!max-h-[420px]"
                      onOpenFullscreen={
                        onOpenFullscreenZoom
                          ? () =>
                              onOpenFullscreenZoom({
                                ...item,
                                problemImageUrl: item.solutionImageUrl,
                                questionText: item.correctSolution,
                              })
                          : undefined
                      }
                    />
                  ) : (
                    !item.correctSolution?.trim() && (
                      <p className="italic text-botanical-muted">
                        Chưa có văn bản hoặc ảnh lời giải chuẩn cho câu hỏi này. Bạn có thể bấm nút sửa (biểu tượng cây bút) trên thẻ để dán thêm ảnh vào Ô Ảnh 2.
                      </p>
                    )
                  )}

                  {/* PHÁC ĐỒ NẾU — THÌ */}
                  <div className="rounded border border-botanical-border bg-botanical-surface p-2.5">
                    <span className="mb-1 inline-block rounded bg-botanical-sage px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase text-white">
                      PHÁC ĐỒ PHẢN XẠ NẾU — THÌ
                    </span>
                    <div className="mt-1">
                      <strong className="text-botanical-ochre">NẾU: </strong>
                      <MathText content={item.ifTrigger} className="inline" />
                    </div>
                    <div className="mt-0.5">
                      <strong className="text-botanical-matcha">THÌ: </strong>
                      <MathText content={item.thenAction} className="inline" />
                    </div>
                  </div>
                </div>
              </div>

              {/* QUICK "ROOT CAUSE" TAGS */}
              <div className="rounded-lg border border-botanical-border bg-botanical-canvas p-2.5">
                <span className="mb-1.5 block font-mono text-[10px] font-bold uppercase text-botanical-ink">
                  Gắn Nhãn Nhanh Nguyên Nhân Sai (Quick Root Cause Tags):
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {QUICK_ROOT_CAUSE_TAGS.map((tag) => {
                    const isSelected = safeWhyCodes.includes(
                      tag.mappedWhyCode as never
                    );
                    return (
                      <button
                        key={tag.id}
                        type="button"
                        onClick={() =>
                          handleToggleQuickRootCauseTag(tag.mappedWhyCode)
                        }
                        title={tag.description}
                        className={`inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-xs font-bold transition ${
                          isSelected
                            ? 'border-botanical-terracotta bg-botanical-terracotta text-white'
                            : 'border-botanical-border bg-botanical-surface text-botanical-ink hover:border-botanical-terracotta'
                        }`}
                      >
                        <span>{tag.label}</span>
                        <span className="font-mono text-[10px] opacity-80">
                          ({tag.mappedWhyCode})
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {onReviewGrade && (
                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-botanical-border pt-2.5">
                  <span className="text-xs font-semibold text-botanical-ink">
                    Kết quả tự chấm Active Recall:
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => onReviewGrade(item.id, false)}
                      className="inline-flex items-center gap-1 rounded-lg border border-botanical-terracotta bg-botanical-terracottaBg px-3 py-1.5 text-xs font-bold text-botanical-terracotta hover:bg-botanical-terracotta hover:text-white"
                    >
                      <XCircle className="h-3.5 w-3.5" /> Vẫn vấp bẫy (Về Hộp 1)
                    </button>
                    <button
                      type="button"
                      onClick={() => onReviewGrade(item.id, true)}
                      className="inline-flex items-center gap-1 rounded-lg border border-botanical-sage bg-botanical-sage px-3 py-1.5 text-xs font-bold text-white hover:bg-botanical-matcha"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" /> Giải đúng chuẩn
                      (Lên Hộp {Math.min(5, (item.leitnerBox || 1) + 1)})
                    </button>
                  </div>
                </div>
              )}

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
                          className="inline-flex shrink-0 items-center gap-1 rounded border border-botanical-terracotta bg-botanical-terracotta px-1.5 py-0.5 font-mono text-[10px] font-bold text-white"
                        >
                          <Youtube className="h-3 w-3" />
                          <Clock className="h-2.5 w-2.5" />
                          {formatSecondsToMinSec(ref.youtubeTimestampSec) ||
                            'Mở'}
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
});

// ============================================================================
// 3. COMPONENT THẺ BẢN GHI (CHO PHÉP ĐỔI NHANH CHUYÊN ĐỀ NHỎ & NGUỒN ĐỀ TẠI CHỖ)
// ============================================================================
interface MemoizedLogCardProps {
  item: ErrorLogItem;
  availableTopics: string[];
  availableSources: string[];
  onOpenForensic: (item: ErrorLogItem) => void;
  onStartEdit: (item: ErrorLogItem) => void;
  onDelete: (id: string) => void;
  onUpdateItem: (updated: ErrorLogItem) => void;
  onReviewGrade: (id: string, rememberedCorrectly: boolean) => void;
  onOpenFullscreenZoom: (item: ErrorLogItem) => void;
}

const MemoizedLogCard = memo(function MemoizedLogCard({
  item,
  availableTopics,
  availableSources,
  onOpenForensic,
  onStartEdit,
  onDelete,
  onUpdateItem,
  onReviewGrade,
  onOpenFullscreenZoom,
}: MemoizedLogCardProps) {
  const [isQuickMetaOpen, setIsQuickMetaOpen] = useState(false);
  const [draftTopic, setDraftTopic] = useState(item.topic || '');
  const [draftSource, setDraftSource] = useState(() =>
    extractSourceFromItem(item)
  );

  useEffect(() => {
    setDraftTopic(item.topic || '');
    setDraftSource(extractSourceFromItem(item));
  }, [item]);

  const bpTitle =
    PROCESS_BREAKPOINTS.find((b) => b.id === item.processBreakpoint)?.title ||
    item.processBreakpoint;

  const twinCount = Array.isArray(item.twinQuestions)
    ? item.twinQuestions.length
    : 0;
  const safeWhyCodes = Array.isArray(item.whyCodes) ? item.whyCodes : [];
  const currentSource = extractSourceFromItem(item);

  const subDef = INITIAL_SUBJECTS.find((s) => s.id === item.subjectId);
  const subjectBadgeClass =
    subDef?.badgeBg || 'bg-botanical-sage text-white';

  const handleSaveQuickMeta = () => {
    const nextWithSource = attachSourceToItem(
      {
        ...item,
        topic: draftTopic.trim() || item.topic,
        updatedAt: new Date().toISOString(),
      },
      draftSource.trim()
    );
    onUpdateItem(nextWithSource);
    setIsQuickMetaOpen(false);
  };

  return (
    <article
      style={{ contentVisibility: 'auto', containIntrinsicSize: '360px' }}
      className="botanical-paper-card rounded-xl border border-botanical-border bg-botanical-surface p-5"
    >
      {/* Dòng meta trên cùng của thẻ */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-botanical-border pb-2.5">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`rounded-md px-2.5 py-0.5 font-mono text-xs font-bold ${subjectBadgeClass}`}
          >
            {subDef?.name || item.subjectName}
          </span>

          {/* Nút Chuyên đề nhỏ (bấm để tự sửa/đổi nhanh) */}
          <button
            type="button"
            onClick={() => setIsQuickMetaOpen((p) => !p)}
            title="Bấm để tự gõ hoặc đổi nhanh Chuyên đề nhỏ & Nguồn đề"
            className="inline-flex items-center gap-1 rounded-md border border-botanical-border bg-botanical-chipBg px-2.5 py-0.5 text-xs font-semibold text-botanical-chipText hover:border-botanical-sage"
          >
            <Tag className="h-3 w-3 text-botanical-sage" />
            <span>{item.topic || 'Chưa gắn chuyên đề'}</span>
          </button>

          {/* Nhãn Nguồn đề / Bộ đề */}
          <button
            type="button"
            onClick={() => setIsQuickMetaOpen((p) => !p)}
            title="Bấm để gán hoặc đổi Nguồn đề (gom nhóm câu hỏi cùng nguồn)"
            className="inline-flex items-center gap-1 rounded border border-botanical-sage/40 bg-botanical-mossMist px-2 py-0.5 font-mono text-[11px] font-bold text-botanical-sage hover:bg-botanical-sage hover:text-white"
          >
            <FolderKanban className="h-3 w-3" />
            <span>{currentSource}</span>
          </button>

          <span className="rounded border border-botanical-border bg-botanical-canvas px-2 py-0.5 text-[11px] font-medium text-botanical-muted">
            {bpTitle}
          </span>
          <span className="rounded border border-botanical-border bg-botanical-canvas px-2 py-0.5 font-mono text-[11px] text-botanical-eucalyptus">
            Hộp Leitner {item.leitnerBox} (Ôn: {item.nextReviewDate})
          </span>
          {safeWhyCodes.map((code) => {
            const def = WHY_DICTIONARY.find((w) => w.code === code);
            return (
              <span
                key={code}
                className="rounded border border-botanical-terracotta/40 bg-botanical-terracottaBg px-2 py-0.5 text-[10px] font-bold text-botanical-terracotta"
              >
                {def ? def.title : code}
              </span>
            );
          })}
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => onOpenFullscreenZoom(item)}
            className="inline-flex items-center gap-1 rounded-lg border border-botanical-border bg-botanical-canvas px-2.5 py-1 text-xs font-bold text-botanical-sage hover:border-botanical-sage"
            title="Phóng to toàn màn hình câu hỏi này"
          >
            <Maximize2 className="h-3.5 w-3.5" />
            Soi Đề
          </button>

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

      {/* Thanh sửa nhanh Chuyên đề nhỏ & Nguồn đề ngay trên thẻ */}
      {isQuickMetaOpen && (
        <div className="mb-3 rounded-lg border border-botanical-sage bg-botanical-mossMist/40 p-3 text-xs">
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            <div>
              <label className="mb-1 block font-mono text-[10px] font-bold uppercase text-botanical-sage">
                Chuyên đề nhỏ (Tự gõ hoặc chọn nhanh):
              </label>
              <input
                type="text"
                value={draftTopic}
                onChange={(e) => setDraftTopic(e.target.value)}
                placeholder="Nhập tên chuyên đề nhỏ..."
                className="w-full rounded border border-botanical-border bg-botanical-surface px-2.5 py-1.5 text-xs text-botanical-ink"
              />
              {availableTopics.length > 0 && (
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {availableTopics.map((tp) => (
                    <button
                      key={tp}
                      type="button"
                      onClick={() => setDraftTopic(tp)}
                      className={`rounded border px-2 py-0.5 text-[10px] font-semibold ${
                        draftTopic === tp
                          ? 'border-botanical-sage bg-botanical-sage text-white'
                          : 'border-botanical-border bg-botanical-canvas text-botanical-ink'
                      }`}
                    >
                      {tp}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div>
              <label className="mb-1 block font-mono text-[10px] font-bold uppercase text-botanical-sage">
                Nguồn đề / Bộ đề (Để gom nhóm cùng 1 khu):
              </label>
              <input
                type="text"
                value={
                  draftSource === DEFAULT_UNGROUPED_SOURCE ? '' : draftSource
                }
                onChange={(e) => setDraftSource(e.target.value)}
                placeholder="VD: Bluebook Test 5, Cam 19 Test 2, Đề Sở HN..."
                className="w-full rounded border border-botanical-border bg-botanical-surface px-2.5 py-1.5 text-xs text-botanical-ink"
              />
              {availableSources.length > 0 && (
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {availableSources.map((src) => (
                    <button
                      key={src}
                      type="button"
                      onClick={() => setDraftSource(src)}
                      className={`rounded border px-2 py-0.5 text-[10px] font-semibold ${
                        draftSource === src
                          ? 'border-botanical-terracotta bg-botanical-terracotta text-white'
                          : 'border-botanical-border bg-botanical-canvas text-botanical-ink'
                      }`}
                    >
                      {src}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="mt-2.5 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setIsQuickMetaOpen(false)}
              className="rounded border border-botanical-border bg-botanical-canvas px-3 py-1 text-xs font-semibold text-botanical-muted"
            >
              Hủy
            </button>
            <button
              type="button"
              onClick={handleSaveQuickMeta}
              className="rounded border border-botanical-sage bg-botanical-sage px-3 py-1 text-xs font-bold text-white"
            >
              Lưu Chuyên Đề &amp; Nguồn Đề
            </button>
          </div>
        </div>
      )}

      {/* Trạm Active Recall 2 cột */}
      <ActiveRecallSplitWorkspace
        item={item}
        onUpdateItem={onUpdateItem}
        onReviewGrade={onReviewGrade}
        onOpenFullscreenZoom={onOpenFullscreenZoom}
      />
    </article>
  );
});

// ============================================================================
// 4. TRANG CHÍNH OMNI ERROR LOG APP PAGE
// ============================================================================
export default function OmniErrorLogAppPage() {
  const [logs, setLogs] = useState<ErrorLogItem[]>([]);
  const logsRef = useRef<ErrorLogItem[]>([]);
  logsRef.current = logs;

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
  const [fullscreenZoomItem, setFullscreenZoomItem] =
    useState<ErrorLogItem | null>(null);

  // Bộ lọc danh sách bản ghi & Chế độ Gom nhóm cùng nguồn
  const [subjectFilter, setSubjectFilter] = useState<string>('ALL');
  const [whyFilter, setWhyFilter] = useState<string>('ALL');
  const [sourceFilter, setSourceFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [groupBySourceMode, setGroupBySourceMode] = useState<boolean>(true);
  const [collapsedSourceKeys, setCollapsedSourceKeys] = useState<
    Record<string, boolean>
  >({});

  // State cho Tab PHỤC THÙ LEITNER (REVIEW)
  const [reviewBoxFilter, setReviewBoxFilter] = useState<
    'DUE' | 1 | 2 | 3 | 4 | 5
  >('DUE');
  const [reviewSourceFilter, setReviewSourceFilter] = useState<string>('ALL');
  const [reviewCursorIdx, setReviewCursorIdx] = useState<number>(0);

  // Đồng bộ danh sách Chuyên đề & Nguồn đề từ localStorage
  const [savedSubjectsList, setSavedSubjectsList] =
    useState(INITIAL_SUBJECTS);
  const [customSourcesList, setCustomSourcesList] = useState<string[]>([]);

  const deferredSearchQuery = useDeferredValue(searchQuery);
  const deferredSubjectFilter = useDeferredValue(subjectFilter);
  const deferredWhyFilter = useDeferredValue(whyFilter);
  const deferredSourceFilter = useDeferredValue(sourceFilter);

  const [customApiKey, setCustomApiKey] = useState<string>('');
  const [showApiKeyModal, setShowApiKeyModal] = useState<boolean>(false);

  // --- STATE CẤU HÌNH TRỰC TIẾP SUPABASE CLOUD KEY TRÊN GIAO DIỆN ---
  const [supabaseUrlInput, setSupabaseUrlInput] = useState<string>('');
  const [supabaseAnonKeyInput, setSupabaseAnonKeyInput] = useState<string>('');
  const [supabaseTableInput, setSupabaseTableInput] =
    useState<string>('error_logs');
  const [cloudTestFeedback, setCloudTestFeedback] = useState<{
    ok?: boolean;
    message: string;
  } | null>(null);

  // --- STATE ĐỒNG BỘ TRỰC TIẾP ---
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

  // Đọc danh sách Chuyên đề nhỏ, Nguồn đề & Cấu hình Supabase từ localStorage
  const refreshSavedTaxonomyFromStorage = useCallback(() => {
    try {
      const rawSubs = window.localStorage.getItem(LOCAL_SUBJECTS_STORAGE_KEY);
      if (rawSubs) {
        const parsedSubs = JSON.parse(rawSubs);
        if (Array.isArray(parsedSubs) && parsedSubs.length > 0) {
          setSavedSubjectsList(parsedSubs);
        }
      }
      const rawSources = window.localStorage.getItem(LOCAL_CUSTOM_SOURCES_KEY);
      if (rawSources) {
        const parsedSources = JSON.parse(rawSources);
        if (Array.isArray(parsedSources)) {
          setCustomSourcesList(parsedSources);
        }
      }
      const sbCfg = getSupabaseRuntimeConfig();
      setSupabaseUrlInput(sbCfg.url);
      setSupabaseAnonKeyInput(sbCfg.anonKey);
      setSupabaseTableInput(sbCfg.tableName);
    } catch {
      // Bỏ qua
    }
  }, []);

  useEffect(() => {
    refreshSavedTaxonomyFromStorage();
  }, [refreshSavedTaxonomyFromStorage]);

  const getTopicsForSubject = useCallback(
    (subId: string): string[] => {
      const subDef = savedSubjectsList.find((s) => s.id === subId) as any;
      const defaultTopics: string[] = Array.isArray(subDef?.defaultTopics)
        ? subDef.defaultTopics
        : [];
      const fromLogs = logs
        .filter((l) => l.subjectId === subId && l.topic?.trim())
        .map((l) => l.topic.trim());

      return Array.from(new Set([...defaultTopics, ...fromLogs]));
    },
    [savedSubjectsList, logs]
  );

  const allAvailableSources = useMemo(() => {
    const fromLogs = logs
      .map((l) => extractSourceFromItem(l))
      .filter((s) => s && s !== DEFAULT_UNGROUPED_SOURCE);
    return Array.from(new Set([...customSourcesList, ...fromLogs]));
  }, [customSourcesList, logs]);

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

      logsRef.current = nextLogs;
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
        // Bỏ qua
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
      // Giữ nguyên
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
      if (!silent && logsRef.current.length === 0) setIsLoading(true);
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

        refreshSavedTaxonomyFromStorage();

        const apiLogs: ErrorLogItem[] =
          localRes && localRes.ok && Array.isArray(localRes.logs)
            ? sanitizeLogList(localRes.logs)
            : [];

        const cloudLogs =
          rawCloudLogs !== null ? sanitizeLogList(rawCloudLogs) : null;

        // Hợp nhất cả dữ liệu đang có trong máy (logsRef.current) + API + Supabase Cloud
        const byId = new Map<string, ErrorLogItem>();
        logsRef.current.forEach((item) => byId.set(item.id, item));
        apiLogs.forEach((item) => {
          const existing = byId.get(item.id);
          if (
            !existing ||
            new Date(item.updatedAt || 0).getTime() >=
              new Date(existing.updatedAt || 0).getTime()
          ) {
            byId.set(item.id, item);
          }
        });

        if (cloudLogs !== null) {
          const cloudIdSet = new Set<string>();
          const toPushToCloud: ErrorLogItem[] = [];

          cloudLogs.forEach((cItem) => {
            cloudIdSet.add(cItem.id);
            const existingLocal = byId.get(cItem.id);
            if (
              !existingLocal ||
              new Date(cItem.updatedAt || 0).getTime() >=
                new Date(existingLocal.updatedAt || 0).getTime()
            ) {
              byId.set(cItem.id, cItem);
            } else {
              toPushToCloud.push(existingLocal);
            }
          });

          byId.forEach((localItem) => {
            if (!cloudIdSet.has(localItem.id)) {
              toPushToCloud.push(localItem);
            }
          });

          if (toPushToCloud.length > 0) {
            void upsertLogsToSupabase(toPushToCloud).catch(() => false);
          }
        }

        const mergedLogs = Array.from(byId.values()).sort(
          (a, b) =>
            new Date(b.createdAt || 0).getTime() -
            new Date(a.createdAt || 0).getTime()
        );

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
        // Sửa lỗi báo ảo: chỉ hiện LIVE_CLOUD khi thực sự kết nối được tới Supabase
        setSyncStatus(cloudLogs !== null ? 'LIVE_CLOUD' : 'LIVE_LOCAL');
      } catch {
        setSyncStatus(pendingOutboxCount > 0 ? 'OFFLINE_QUEUE' : 'ERROR');
      } finally {
        isFetchingRef.current = false;
        setIsLoading(false);
      }
    },
    [
      applyLogsAndAnalytics,
      flushOfflineOutbox,
      pendingOutboxCount,
      refreshSavedTaxonomyFromStorage,
    ]
  );

  useEffect(() => {
    try {
      const cached = window.localStorage.getItem(LOCAL_CACHE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed.logs) && parsed.logs.length > 0) {
          applyLogsAndAnalytics(
            sanitizeLogList(parsed.logs),
            parsed.analytics,
            false
          );
          setIsLoading(false);
        }
      }
    } catch {
      // Bỏ qua
    }

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
  }, [applyLogsAndAnalytics, fetchAllData]);

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
          logsRef.current = incomingLogs;
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
      if (e.key === 'Escape' && fullscreenZoomItem) {
        setFullscreenZoomItem(null);
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
  }, [fullscreenZoomItem]);

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

  // Lọc danh sách bản ghi
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
      if (
        deferredSourceFilter !== 'ALL' &&
        extractSourceFromItem(item) !== deferredSourceFilter
      ) {
        return false;
      }
      if (q) {
        const src = extractSourceFromItem(item);
        const hay = `${item.subjectName} ${item.topic} ${src} ${item.questionText} ${item.myWrongStep} ${item.ifTrigger} ${item.thenAction}`.toLowerCase();
        return hay.includes(q);
      }
      return true;
    });
  }, [
    logs,
    deferredSubjectFilter,
    deferredWhyFilter,
    deferredSourceFilter,
    deferredSearchQuery,
  ]);

  // Gom các câu hỏi cùng Nguồn đề thành từng Khu vực (Source Clusters)
  const groupedBySourceClusters = useMemo(() => {
    const map = new Map<string, ErrorLogItem[]>();
    filteredLogs.forEach((item) => {
      const src = extractSourceFromItem(item);
      const existing = map.get(src);
      if (existing) {
        existing.push(item);
      } else {
        map.set(src, [item]);
      }
    });
    return Array.from(map.entries()).map(([sourceName, items]) => {
      const carelessCount = items.filter((it) =>
        (it.whyCodes || []).some((c) => String(c).startsWith('A'))
      ).length;
      const carelessPercent =
        items.length > 0 ? Math.round((carelessCount / items.length) * 100) : 0;
      return {
        sourceName,
        items,
        carelessPercent,
      };
    });
  }, [filteredLogs]);

  // Lọc danh sách câu hỏi trong Tab PHỤC THÙ LEITNER (REVIEW)
  const reviewFilteredList = useMemo(() => {
    const todayLocal = getLocalTodayDateString();
    const todayIso = new Date().toISOString().slice(0, 10);

    return logs.filter((it) => {
      if (
        reviewSourceFilter !== 'ALL' &&
        extractSourceFromItem(it) !== reviewSourceFilter
      ) {
        return false;
      }
      if (reviewBoxFilter === 'DUE') {
        if ((it.leitnerBox ?? 1) >= 5 && it.isResolved) return false;
        if (!it.nextReviewDate) return true;
        return it.nextReviewDate <= todayLocal || it.nextReviewDate <= todayIso;
      }
      return (it.leitnerBox ?? 1) === reviewBoxFilter;
    });
  }, [logs, reviewBoxFilter, reviewSourceFilter]);

  const leitnerBoxCounts = useMemo(() => {
    const counts: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    logs.forEach((it) => {
      const b = Math.min(5, Math.max(1, Number(it.leitnerBox || 1)));
      counts[b] = (counts[b] || 0) + 1;
    });
    return counts;
  }, [logs]);

  const handleUpdateLogItem = useCallback(
    async (rawUpdated: ErrorLogItem) => {
      const updated = sanitizeLogItem(rawUpdated);
      const optimisticLogs = logsRef.current.map((it) =>
        it.id === updated.id ? updated : it
      );
      applyLogsAndAnalytics(optimisticLogs);

      setForensicModalItem((prev) =>
        prev?.id === updated.id ? updated : prev
      );

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
    [applyLogsAndAnalytics, enqueueOfflineAction]
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

      const optimisticLogs = logsRef.current.map((it) => {
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
    [applyLogsAndAnalytics, enqueueOfflineAction]
  );

  const handleDeleteLog = useCallback(
    async (id: string) => {
      const nextLogs = logsRef.current.filter((item) => item.id !== id);
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
    [applyLogsAndAnalytics, enqueueOfflineAction]
  );

  const handleStartEditCard = useCallback((item: ErrorLogItem) => {
    setEditingItem(sanitizeLogItem(item));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const currentReviewItem =
    reviewFilteredList[
      Math.min(
        reviewCursorIdx,
        Math.max(0, reviewFilteredList.length - 1)
      )
    ] || null;

  return (
    <div className="min-h-screen bg-botanical-canvas text-botanical-ink">
      {/* HEADER ĐIỀU HƯỚNG BOTANICAL PAPER STUDIO (FLAT 2D TUYỆT ĐỐI) */}
      <header className="sticky top-0 z-30 border-b border-botanical-border bg-botanical-surface">
        <div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-botanical-sage bg-botanical-sage text-white">
              <BookOpen className="h-5 w-5" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-base font-extrabold tracking-tight text-botanical-ink">
                  OMNI-SUBJECT SMART ERROR LOG
                </h1>
                <span className="rounded border border-botanical-border bg-botanical-mossMist px-2 py-0.5 font-mono text-[10px] font-bold text-botanical-sage">
                  Botanical Paper Studio • Flat 2D
                </span>
              </div>
              <p className="text-xs text-botanical-muted">
                Trạm Phân tích Lỗi sai Đa môn học &amp; Active Recall Split-Pane • Đồng Bộ Đa Thiết Bị Supabase Cloud
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
                  ? 'bg-botanical-sage text-white'
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
                  ? 'bg-botanical-sage text-white'
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
                  ? 'bg-botanical-terracotta text-white'
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
                  ? 'bg-botanical-matcha text-white'
                  : 'text-botanical-ink hover:bg-botanical-mossMist'
              }`}
            >
              <ShieldCheck className="h-3.5 w-3.5" />
              Checklist 5 Phút Phòng Thi
            </button>
          </nav>

          {/* Cụm công cụ Realtime, Sync, Bộ gõ Tiếng Việt, Cmd+K */}
          <div className="flex flex-wrap items-center gap-1.5">
            <RealtimeClockBadge />

            <div className="inline-flex items-center rounded-lg border border-botanical-border bg-botanical-canvas p-0.5 text-[11px]">
              <button
                type="button"
                onClick={() => void fetchAllData(false)}
                title={
                  syncStatus === 'LIVE_CLOUD'
                    ? `Đã đồng bộ Supabase Cloud lúc ${lastSyncedAt} (${syncLatencyMs ?? 0}ms)`
                    : 'Đang chỉ lưu trên trình duyệt này. Bấm nút Chìa khóa bên phải để nhập Supabase Key đồng bộ sang iPad/iPhone!'
                }
                className="inline-flex items-center gap-1 rounded-md px-2 py-1 font-semibold text-botanical-ink hover:bg-botanical-mossMist"
              >
                {syncStatus === 'SYNCING' ? (
                  <RefreshCw className="h-3.5 w-3.5 animate-spin text-botanical-sage" />
                ) : syncStatus === 'LIVE_CLOUD' ? (
                  <Wifi className="h-3.5 w-3.5 text-botanical-matcha" />
                ) : (
                  <WifiOff className="h-3.5 w-3.5 text-botanical-terracotta" />
                )}
                <span>
                  {syncStatus === 'LIVE_CLOUD'
                    ? 'Cloud Đã Đồng Bộ'
                    : syncStatus === 'LIVE_LOCAL'
                      ? 'Chỉ Lưu Máy Này (Chưa Cloud)'
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
                className={`inline-flex items-center gap-1 rounded-md px-2 py-1 font-bold transition ${
                  vnImeMode !== 'OFF'
                    ? 'bg-botanical-terracotta text-white'
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
            >
              <Download className="h-3.5 w-3.5" /> Anki .CSV
            </button>

            <button
              type="button"
              onClick={() => setShowApiKeyModal((p) => !p)}
              className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-bold transition ${
                syncStatus === 'LIVE_CLOUD'
                  ? 'border-botanical-sage bg-botanical-canvas text-botanical-sage'
                  : 'border-botanical-terracotta bg-botanical-terracotta text-white'
              }`}
              title="Cấu hình Supabase Cloud Key & Gemini API Key"
            >
              <KeyRound className="h-3.5 w-3.5" />
              <span>Cloud Key</span>
            </button>
          </div>
        </div>

        {/* BẢNG CẤU HÌNH TRỰC TIẾP SUPABASE CLOUD KEY & GEMINI KEY */}
        {showApiKeyModal && (
          <div className="border-t border-botanical-border bg-botanical-mossMist px-4 py-4 sm:px-6">
            <div className="mx-auto max-w-5xl space-y-3 rounded-xl border border-botanical-border bg-botanical-surface p-4 text-xs">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-botanical-border pb-2.5">
                <div>
                  <h3 className="text-sm font-extrabold text-botanical-ink">
                    CẤU HÌNH ĐỒNG BỘ ĐÁM MÂY SUPABASE (MAC • IPAD • IPHONE) &amp; GEMINI AI KEY
                  </h3>
                  <p className="text-[11px] text-botanical-muted">
                    Nhập <strong>Supabase Project URL</strong> và <strong>Anon Public Key</strong> trên cả máy tính, iPad và điện thoại để đồng bộ dữ liệu 2 chiều tức thì.
                  </p>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      const bundle = JSON.stringify({
                        u: supabaseUrlInput.trim(),
                        k: supabaseAnonKeyInput.trim(),
                        t: supabaseTableInput.trim() || 'error_logs',
                        g: customApiKey.trim(),
                      });
                      void navigator.clipboard.writeText(bundle);
                      setCloudTestFeedback({
                        ok: true,
                        message:
                          'Đã copy Mã Cấu Hình Nhanh! Bạn hãy gửi qua Zalo/iMessage sang iPad/iPhone rồi bấm "Dán Mã Cấu Hình Nhanh".',
                      });
                    }}
                    className="rounded border border-botanical-border bg-botanical-canvas px-2.5 py-1 font-mono text-[10px] font-bold text-botanical-sage hover:border-botanical-sage"
                  >
                    Copy Mã Sang iPad/iPhone
                  </button>

                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        const text = await navigator.clipboard.readText();
                        const parsed = JSON.parse(text);
                        if (parsed.u) setSupabaseUrlInput(parsed.u);
                        if (parsed.k) setSupabaseAnonKeyInput(parsed.k);
                        if (parsed.t) setSupabaseTableInput(parsed.t);
                        if (parsed.g) {
                          setCustomApiKey(parsed.g);
                          window.localStorage.setItem(
                            'OMNI_CUSTOM_GEMINI_KEY',
                            parsed.g
                          );
                        }
                        setCloudTestFeedback({
                          ok: true,
                          message:
                            'Đã dán cấu hình thành công! Hãy bấm "Lưu Key & Đồng Bộ Ngay" bên dưới.',
                        });
                      } catch {
                        setCloudTestFeedback({
                          ok: false,
                          message:
                            'Clipboard không chứa Mã Cấu Hình Nhanh hợp lệ.',
                        });
                      }
                    }}
                    className="rounded border border-botanical-border bg-botanical-canvas px-2.5 py-1 font-mono text-[10px] font-bold text-botanical-terracotta hover:border-botanical-terracotta"
                  >
                    Dán Mã Cấu Hình Nhanh
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-12">
                <div className="sm:col-span-5">
                  <label className="mb-1 block font-mono text-[10px] font-bold uppercase text-botanical-sage">
                    1. Supabase Project URL:
                  </label>
                  <input
                    type="text"
                    value={supabaseUrlInput}
                    onChange={(e) => setSupabaseUrlInput(e.target.value)}
                    placeholder="https://xyzcompany.supabase.co"
                    className="w-full rounded border border-botanical-border bg-botanical-canvas px-2.5 py-1.5 font-mono text-xs text-botanical-ink"
                  />
                </div>

                <div className="sm:col-span-5">
                  <label className="mb-1 block font-mono text-[10px] font-bold uppercase text-botanical-sage">
                    2. Supabase Anon Key (Public):
                  </label>
                  <input
                    type="password"
                    value={supabaseAnonKeyInput}
                    onChange={(e) => setSupabaseAnonKeyInput(e.target.value)}
                    placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                    className="w-full rounded border border-botanical-border bg-botanical-canvas px-2.5 py-1.5 font-mono text-xs text-botanical-ink"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="mb-1 block font-mono text-[10px] font-bold uppercase text-botanical-muted">
                    3. Tên Bảng:
                  </label>
                  <input
                    type="text"
                    value={supabaseTableInput}
                    onChange={(e) => setSupabaseTableInput(e.target.value)}
                    placeholder="error_logs"
                    className="w-full rounded border border-botanical-border bg-botanical-canvas px-2.5 py-1.5 font-mono text-xs text-botanical-ink"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 pt-1 sm:grid-cols-12">
                <div className="sm:col-span-6">
                  <label className="mb-1 block font-mono text-[10px] font-bold uppercase text-botanical-muted">
                    4. Gemini API Key (Dùng cho Phòng Khám AI):
                  </label>
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
                    className="w-full rounded border border-botanical-border bg-botanical-canvas px-2.5 py-1.5 font-mono text-xs text-botanical-ink"
                  />
                </div>

                <div className="flex flex-wrap items-end justify-end gap-2 sm:col-span-6">
                  <button
                    type="button"
                    onClick={async () => {
                      saveSupabaseRuntimeConfig(
                        supabaseUrlInput,
                        supabaseAnonKeyInput,
                        supabaseTableInput
                      );
                      setCloudTestFeedback({
                        message: 'Đang kiểm tra kết nối tới Supabase...',
                      });
                      const res = await testSupabaseConnection();
                      setCloudTestFeedback(res);
                      if (res.ok) {
                        await fetchAllData(false);
                      }
                    }}
                    className="rounded-lg border border-botanical-sage bg-botanical-sage px-3 py-1.5 font-bold text-white"
                  >
                    Lưu Key &amp; Đồng Bộ Ngay
                  </button>

                  <button
                    type="button"
                    onClick={async () => {
                      saveSupabaseRuntimeConfig(
                        supabaseUrlInput,
                        supabaseAnonKeyInput,
                        supabaseTableInput
                      );
                      setCloudTestFeedback({
                        message: `Đang đẩy toàn bộ ${logsRef.current.length} bản ghi trên máy này lên Supabase...`,
                      });
                      const ok = await upsertLogsToSupabase(logsRef.current);
                      setCloudTestFeedback({
                        ok,
                        message: ok
                          ? `Đã đẩy thành công ${logsRef.current.length} bản ghi + Chuyên đề lên Supabase! Giờ bạn có thể mở trên iPad/iPhone.`
                          : 'Đẩy dữ liệu thất bại. Hãy kiểm tra lại URL/Key hoặc tạo bảng SQL bên dưới.',
                      });
                      if (ok) await fetchAllData(true);
                    }}
                    className="rounded-lg border border-botanical-terracotta bg-botanical-terracotta px-3 py-1.5 font-bold text-white"
                  >
                    Đẩy Toàn Bộ Máy Này Lên Cloud
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowApiKeyModal(false)}
                    className="rounded-lg border border-botanical-border bg-botanical-canvas px-3 py-1.5 font-semibold text-botanical-muted hover:text-botanical-ink"
                  >
                    Đóng
                  </button>
                </div>
              </div>

              {cloudTestFeedback && (
                <div
                  className={`rounded-lg border px-3 py-2 font-mono text-[11px] font-bold ${
                    cloudTestFeedback.ok === true
                      ? 'border-botanical-matcha bg-botanical-matchaBg text-botanical-matcha'
                      : cloudTestFeedback.ok === false
                        ? 'border-botanical-terracotta bg-botanical-terracottaBg text-botanical-terracotta'
                        : 'border-botanical-border bg-botanical-canvas text-botanical-ink'
                  }`}
                >
                  {cloudTestFeedback.message}
                </div>
              )}

              <details className="rounded border border-botanical-border bg-botanical-canvas p-2.5 text-[11px]">
                <summary className="cursor-pointer font-mono font-bold text-botanical-sage">
                  📌 Lệnh SQL tạo bảng chuẩn trên Supabase (Nếu bạn chưa tạo bảng error_logs):
                </summary>
                <pre className="mt-2 overflow-x-auto rounded border border-botanical-border bg-botanical-surface p-2 font-mono text-[10px] text-botanical-ink">
{`create table if not exists public.error_logs (
  id text primary key,
  payload jsonb not null,
  updated_at timestamptz default now()
);
alter table public.error_logs enable row level security;
create policy "Allow public full access" on public.error_logs for all using (true) with check (true);`}
                </pre>
              </details>
            </div>
          </div>
        )}
      </header>

      {/* KHU VỰC LÀM VIỆC CHÍNH */}
      <main className="mx-auto max-w-[1440px] space-y-6 px-4 py-6 sm:px-6">
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
                refreshSavedTaxonomyFromStorage();

                const nextLogs = [
                  savedItem,
                  ...logsRef.current.filter((it) => it.id !== savedItem.id),
                ];
                applyLogsAndAnalytics(nextLogs);

                if (openTwinModal) {
                  setForensicModalItem(savedItem);
                }

                await upsertLogsToSupabase(savedItem).catch(() => false);
                await fetchAllData(true);
              }}
            />

            {/* 2. Kho Lưu Trữ Sổ Tay Lỗi Sai (Hỗ trợ Gom Các Câu Hỏi Cùng Nguồn Thành 1 Khu) */}
            <section className="space-y-4 pt-2">
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-botanical-border bg-botanical-surface px-4 py-3">
                <div>
                  <h3 className="text-sm font-bold text-botanical-ink">
                    TRẠM GIẢI LẠI ACTIVE RECALL &amp; KHO LỖI SAI ({filteredLogs.length} bản ghi)
                  </h3>
                  <p className="text-xs text-botanical-muted">
                    Các câu hỏi cùng nguồn đề được gom thành từng khu vực riêng. Bấm vào tên{' '}
                    <strong>Chuyên đề</strong> hoặc <strong>Nguồn đề</strong> trên thẻ để sửa nhanh.
                  </p>
                </div>

                {/* Bộ lọc Tìm kiếm, Chế độ Gom Nhóm Theo Nguồn, Môn học & Mã lỗi WHY */}
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setGroupBySourceMode((prev) => !prev)}
                    className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-bold transition ${
                      groupBySourceMode
                        ? 'border-botanical-sage bg-botanical-sage text-white'
                        : 'border-botanical-border bg-botanical-canvas text-botanical-ink'
                    }`}
                  >
                    {groupBySourceMode ? (
                      <>
                        <Layers className="h-3.5 w-3.5" /> Đang gom theo Khu Vực Nguồn Đề
                      </>
                    ) : (
                      <>
                        <List className="h-3.5 w-3.5" /> Hiển thị Danh sách phẳng
                      </>
                    )}
                  </button>

                  <div className="relative">
                    <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-botanical-muted" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Tìm đề bài, nguồn đề, NẾU-THÌ..."
                      className="rounded-lg border border-botanical-border bg-botanical-canvas py-1.5 pl-8 pr-3 text-xs text-botanical-ink focus:border-botanical-sage focus:outline-none"
                    />
                  </div>

                  <select
                    value={sourceFilter}
                    onChange={(e) => setSourceFilter(e.target.value)}
                    className="rounded-lg border border-botanical-border bg-botanical-canvas px-2.5 py-1.5 text-xs font-medium text-botanical-ink"
                  >
                    <option value="ALL">Tất cả Nguồn đề</option>
                    {allAvailableSources.map((src) => (
                      <option key={src} value={src}>
                        📚 {src}
                      </option>
                    ))}
                    <option value={DEFAULT_UNGROUPED_SOURCE}>
                      {DEFAULT_UNGROUPED_SOURCE}
                    </option>
                  </select>

                  <select
                    value={subjectFilter}
                    onChange={(e) => setSubjectFilter(e.target.value)}
                    className="rounded-lg border border-botanical-border bg-botanical-canvas px-2.5 py-1.5 text-xs font-medium text-botanical-ink"
                  >
                    <option value="ALL">Tất cả Môn học</option>
                    {savedSubjectsList.map((s) => (
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
                <div className="botanical-paper-card rounded-xl border border-botanical-border bg-botanical-surface p-8 text-center text-xs text-botanical-muted">
                  Không có bản ghi nào khớp với bộ lọc hiện tại.
                </div>
              ) : groupBySourceMode ? (
                /* CHẾ ĐỘ GOM CÁC CÂU HỎI CÙNG NGUỒN THÀNH 1 KHU VỰC */
                <div className="space-y-6">
                  {groupedBySourceClusters.map((cluster) => {
                    const isCollapsed = Boolean(
                      collapsedSourceKeys[cluster.sourceName]
                    );
                    return (
                      <div
                        key={cluster.sourceName}
                        className="rounded-xl border-2 border-botanical-sage/40 bg-botanical-mossMist/25 p-4"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-botanical-border pb-3">
                          <div className="flex flex-wrap items-center gap-2.5">
                            <button
                              type="button"
                              onClick={() =>
                                setCollapsedSourceKeys((prev) => ({
                                  ...prev,
                                  [cluster.sourceName]: !prev[cluster.sourceName],
                                }))
                              }
                              className="inline-flex items-center gap-1.5 rounded-lg border border-botanical-sage bg-botanical-sage px-3 py-1 text-xs font-extrabold text-white"
                            >
                              {isCollapsed ? (
                                <ChevronRight className="h-4 w-4" />
                              ) : (
                                <ChevronDown className="h-4 w-4" />
                              )}
                              <FolderKanban className="h-3.5 w-3.5" />
                              <span>KHU VỰC NGUỒN ĐỀ: {cluster.sourceName}</span>
                            </button>

                            <span className="rounded border border-botanical-border bg-botanical-surface px-2.5 py-1 font-mono text-xs font-bold text-botanical-ink">
                              {cluster.items.length} câu hỏi trong nguồn này
                            </span>

                            <span className="rounded border border-botanical-terracotta/40 bg-botanical-terracottaBg px-2.5 py-1 font-mono text-xs font-bold text-botanical-terracotta">
                              Thuế Ẩu khu này: {cluster.carelessPercent}%
                            </span>
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setReviewSourceFilter(cluster.sourceName);
                                setReviewBoxFilter('DUE');
                                setReviewCursorIdx(0);
                                setActiveTab('REVIEW');
                              }}
                              className="inline-flex items-center gap-1.5 rounded-lg border border-botanical-terracotta bg-botanical-terracotta px-3 py-1 text-xs font-bold text-white hover:bg-botanical-sage hover:border-botanical-sage"
                            >
                              <Flame className="h-3.5 w-3.5" />
                              Ôn Phục Thù Cả Khu Này ({cluster.items.length} câu)
                            </button>
                          </div>
                        </div>

                        {!isCollapsed && (
                          <div className="mt-4 space-y-4">
                            {cluster.items.map((item) => (
                              <MemoizedLogCard
                                key={item.id}
                                item={item}
                                availableTopics={getTopicsForSubject(
                                  item.subjectId
                                )}
                                availableSources={allAvailableSources}
                                onOpenForensic={setForensicModalItem}
                                onStartEdit={handleStartEditCard}
                                onDelete={handleDeleteLog}
                                onUpdateItem={handleUpdateLogItem}
                                onReviewGrade={handleReviewGrade}
                                onOpenFullscreenZoom={setFullscreenZoomItem}
                              />
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                /* CHẾ ĐỘ DANH SÁCH PHẲNG */
                <div className="space-y-4">
                  {filteredLogs.map((item) => (
                    <MemoizedLogCard
                      key={item.id}
                      item={item}
                      availableTopics={getTopicsForSubject(item.subjectId)}
                      availableSources={allAvailableSources}
                      onOpenForensic={setForensicModalItem}
                      onStartEdit={handleStartEditCard}
                      onDelete={handleDeleteLog}
                      onUpdateItem={handleUpdateLogItem}
                      onReviewGrade={handleReviewGrade}
                      onOpenFullscreenZoom={setFullscreenZoomItem}
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

        {/* TAB PHỤC THÙ LEITNER ĐƯỢC NÂNG CẤP TRỰC TIẾP VỚI ZOOM IN/OUT MỌI NƠI + SPLIT-PANE */}
        {activeTab === 'REVIEW' && (
          <section className="space-y-4">
            <div className="rounded-xl border border-botanical-border bg-botanical-surface p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <span className="inline-flex items-center gap-1 rounded bg-botanical-terracottaBg px-2 py-0.5 font-mono text-[10px] font-bold uppercase text-botanical-terracotta">
                    <Flame className="h-3 w-3" /> REDEMPTION REVIEW MODE (SPACED REPETITION + ZOOM SPLIT-PANE)
                  </span>
                  <h2 className="mt-1 text-base font-extrabold text-botanical-ink">
                    Chế độ &ldquo;Phục Thù&rdquo; theo Thuật toán 5 Hộp Leitner (1 - 3 - 7 - 14 - 30 ngày)
                  </h2>
                  <p className="text-xs text-botanical-muted">
                    Hỗ trợ <strong>Zoom In / Zoom Out cả Đề bài lẫn Ảnh đáp án</strong>, kéo thanh chia cột và đồng hồ bấm giờ tự động.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  <select
                    value={reviewSourceFilter}
                    onChange={(e) => {
                      setReviewSourceFilter(e.target.value);
                      setReviewCursorIdx(0);
                    }}
                    className="rounded-lg border border-botanical-border bg-botanical-canvas px-2.5 py-1.5 text-xs font-bold text-botanical-sage"
                  >
                    <option value="ALL">📚 Tất cả Nguồn đề</option>
                    {allAvailableSources.map((src) => (
                      <option key={src} value={src}>
                        📚 {src}
                      </option>
                    ))}
                    <option value={DEFAULT_UNGROUPED_SOURCE}>
                      {DEFAULT_UNGROUPED_SOURCE}
                    </option>
                  </select>

                  <button
                    type="button"
                    onClick={() => {
                      setReviewBoxFilter('DUE');
                      setReviewCursorIdx(0);
                    }}
                    className={`rounded-lg border px-3 py-1.5 text-xs font-bold transition ${
                      reviewBoxFilter === 'DUE'
                        ? 'border-botanical-terracotta bg-botanical-terracotta text-white'
                        : 'border-botanical-border bg-botanical-canvas text-botanical-ink'
                    }`}
                  >
                    Đến hạn hôm nay ({analytics.dueTodayCount})
                  </button>

                  {([1, 2, 3, 4, 5] as const).map((boxNum) => {
                    const dayMap: Record<number, string> = {
                      1: '1d',
                      2: '3d',
                      3: '7d',
                      4: '14d',
                      5: '30d',
                    };
                    return (
                      <button
                        key={boxNum}
                        type="button"
                        onClick={() => {
                          setReviewBoxFilter(boxNum);
                          setReviewCursorIdx(0);
                        }}
                        className={`rounded-lg border px-2.5 py-1.5 text-xs font-bold transition ${
                          reviewBoxFilter === boxNum
                            ? 'border-botanical-sage bg-botanical-sage text-white'
                            : 'border-botanical-border bg-botanical-canvas text-botanical-ink'
                        }`}
                      >
                        Hộp {boxNum} ({dayMap[boxNum]}): {leitnerBoxCounts[boxNum] || 0}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {!currentReviewItem ? (
              <div className="rounded-xl border border-botanical-border bg-botanical-surface p-10 text-center">
                <p className="text-sm font-bold text-botanical-ink">
                  Không có câu hỏi nào trong bộ lọc Phục Thù hiện tại!
                </p>
                <p className="mt-1 text-xs text-botanical-muted">
                  Bạn có thể bấm chọn sang <strong>Hộp 1</strong>, <strong>Hộp 2</strong>... ở góc trên bên phải để ôn tập bất kỳ lúc nào.
                </p>
              </div>
            ) : (
              <div className="rounded-xl border border-botanical-border bg-botanical-surface p-5">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-botanical-border pb-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-md bg-botanical-sage px-2.5 py-1 font-mono text-xs font-bold text-white">
                      {currentReviewItem.subjectName} • {currentReviewItem.topic}
                    </span>
                    <span className="rounded border border-botanical-sage/40 bg-botanical-mossMist px-2.5 py-1 font-mono text-xs font-bold text-botanical-sage">
                      📚 {extractSourceFromItem(currentReviewItem)}
                    </span>
                    <span className="rounded border border-botanical-border bg-botanical-canvas px-2.5 py-1 font-mono text-xs text-botanical-muted">
                      Đang ở Hộp Leitner {currentReviewItem.leitnerBox}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={reviewCursorIdx <= 0}
                      onClick={() =>
                        setReviewCursorIdx((prev) => Math.max(0, prev - 1))
                      }
                      className="inline-flex items-center gap-1 rounded-lg border border-botanical-border bg-botanical-canvas px-2.5 py-1 text-xs font-bold text-botanical-ink disabled:opacity-40"
                    >
                      <ArrowLeft className="h-3.5 w-3.5" /> Câu trước
                    </button>
                    <span className="font-mono text-xs font-extrabold text-botanical-ink">
                      Câu {Math.min(reviewCursorIdx + 1, reviewFilteredList.length)} /{' '}
                      {reviewFilteredList.length}
                    </span>
                    <button
                      type="button"
                      disabled={reviewCursorIdx >= reviewFilteredList.length - 1}
                      onClick={() =>
                        setReviewCursorIdx((prev) =>
                          Math.min(reviewFilteredList.length - 1, prev + 1)
                        )
                      }
                      className="inline-flex items-center gap-1 rounded-lg border border-botanical-border bg-botanical-canvas px-2.5 py-1 text-xs font-bold text-botanical-ink disabled:opacity-40"
                    >
                      Câu tiếp <ArrowRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                <ActiveRecallSplitWorkspace
                  item={currentReviewItem}
                  onUpdateItem={handleUpdateLogItem}
                  onReviewGrade={handleReviewGrade}
                  onOpenFullscreenZoom={setFullscreenZoomItem}
                />
              </div>
            )}
          </section>
        )}

        {activeTab === 'CHECKLIST' && (
          <RedemptionReview
            logs={logs}
            mode="CHECKLIST"
            onReviewGrade={handleReviewGrade}
          />
        )}
      </main>

      {/* MODAL LIGHTBOX ZOOM TOÀN MÀN HÌNH (SOI RÕ CẢ ĐỀ BÀI & ẢNH LỜI GIẢI) */}
      {fullscreenZoomItem && (
        <div className="fixed inset-0 z-50 flex flex-col bg-botanical-canvas p-4 sm:p-6">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-botanical-border bg-botanical-surface px-4 py-2.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded bg-botanical-sage px-2.5 py-0.5 font-mono text-xs font-bold text-white">
                {fullscreenZoomItem.subjectName} • {fullscreenZoomItem.topic}
              </span>
              <span className="font-mono text-xs font-bold text-botanical-sage">
                📚 {extractSourceFromItem(fullscreenZoomItem)}
              </span>
            </div>

            <button
              type="button"
              onClick={() => setFullscreenZoomItem(null)}
              className="inline-flex items-center gap-1 rounded-lg border border-botanical-terracotta bg-botanical-terracotta px-3 py-1 text-xs font-extrabold text-white"
            >
              <X className="h-4 w-4" /> Đóng Chế Độ Toàn Màn Hình (ESC)
            </button>
          </div>

          <div className="flex-1 overflow-hidden">
            <UniversalZoomableProblemView
              questionText={fullscreenZoomItem.questionText}
              problemImageUrl={fullscreenZoomItem.problemImageUrl}
              titleBadge="CHẾ ĐỘ SOI TOÀN MÀN HÌNH (CUỘN CHUỘT ĐỂ PHÓNG TO TỐI ĐA 500%)"
              maxHeightClass="!h-[calc(100vh-140px)] !max-h-[calc(100vh-140px)]"
            />
          </div>
        </div>
      )}

      {/* BÀN PHÍM ẢO TIẾNG VIỆT NỔI (FLAT 2D BORDER) */}
      {showVirtualKeyboard && (
        <aside className="fixed bottom-4 right-4 z-40 w-full max-w-xl rounded-2xl border-2 border-botanical-sage bg-botanical-surface p-3.5">
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
                className="ml-1 rounded border border-botanical-terracotta bg-botanical-terracottaBg px-2 py-0.5 text-[10px] font-bold text-botanical-terracotta hover:bg-botanical-terracotta hover:text-white"
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
                className="flex-1 rounded-md border border-botanical-sage/40 bg-botanical-mossMist px-1.5 py-1 font-mono text-[11px] font-bold text-botanical-sage hover:bg-botanical-sage hover:text-white"
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
                  className="min-w-[32px] flex-1 rounded-md border border-botanical-border bg-botanical-canvas py-1.5 text-center font-mono text-xs font-semibold text-botanical-ink hover:border-botanical-sage"
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
