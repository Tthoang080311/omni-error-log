// File: src/app/page.tsx
'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
} from 'lucide-react';

type ActiveWorkspaceTab = 'WORKSTATION' | 'ANALYTICS' | 'REVIEW' | 'CHECKLIST';

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

  // Cấu hình nhanh Gemini API Key trên giao diện
  const [customApiKey, setCustomApiKey] = useState<string>('');
  const [showApiKeyModal, setShowApiKeyModal] = useState<boolean>(false);

  const fetchAllData = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/logs');
      const data = await res.json();
      if (data.ok) {
        setLogs(data.logs || []);
        setAnalytics(data.analytics);
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchAllData();
    const savedKey = window.localStorage.getItem('OMNI_CUSTOM_GEMINI_KEY');
    if (savedKey) setCustomApiKey(savedKey);
  }, [fetchAllData]);

  // Lắng nghe phím tắt Cmd+K toàn cục
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsCmdKOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, []);

  const filteredLogs = useMemo(() => {
    return logs.filter((item) => {
      if (subjectFilter !== 'ALL' && item.subjectId !== subjectFilter) {
        return false;
      }
      if (whyFilter !== 'ALL' && !item.whyCodes.includes(whyFilter as never)) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const hay = `${item.subjectName} ${item.topic} ${item.questionText} ${item.myWrongStep} ${item.ifTrigger} ${item.thenAction}`.toLowerCase();
        return hay.includes(q);
      }
      return true;
    });
  }, [logs, subjectFilter, whyFilter, searchQuery]);

  const handleUpdateLogItem = async (updated: ErrorLogItem) => {
    const res = await fetch('/api/logs', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ updatedItem: updated }),
    });
    const data = await res.json();
    if (data.ok) {
      setLogs(data.logs);
      setAnalytics(data.analytics);
      if (forensicModalItem?.id === updated.id) {
        setForensicModalItem(data.item);
      }
    }
  };

  const handleReviewGrade = async (id: string, rememberedCorrectly: boolean) => {
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
    }
  };

  const handleDeleteLog = async (id: string) => {
    const res = await fetch(`/api/logs?id=${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
    const data = await res.json();
    if (data.ok) {
      setLogs(data.logs);
      setAnalytics(data.analytics);
    }
  };

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
                Trạm Phân tích Lỗi sai Đa môn học &amp; Chẩn đoán Nhận thức AI • Local-First SQLite
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

          {/* Nút Phím tắt Cmd+K, Xuất Anki & Cài đặt AI Key */}
          <div className="flex items-center gap-2">
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
              onSaveSuccess={(savedItem, openTwinModal) => {
                setEditingItem(null);
                void fetchAllData();
                if (openTwinModal) {
                  setForensicModalItem(savedItem);
                }
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
                    Bấm vào nút <strong>&ldquo;Phòng Khám AI &amp; Bài Tập Sinh Đôi&rdquo;</strong> trên từng thẻ để giải bài tương tự phục thù tại chỗ.
                  </p>
                </div>

                {/* Bộ lọc Tìm kiếm, Môn học & Mã lỗi WHY */}
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
                  Đang tải cơ sở dữ liệu SQLite nội bộ...
                </div>
              ) : filteredLogs.length === 0 ? (
                <div className="botanical-paper-card rounded-xl p-8 text-center text-xs text-botanical-muted">
                  Không có bản ghi nào khớp với bộ lọc hiện tại.
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredLogs.map((item) => {
                    const bpTitle =
                      PROCESS_BREAKPOINTS.find(
                        (b) => b.id === item.processBreakpoint
                      )?.title || item.processBreakpoint;

                    return (
                      <article
                        key={item.id}
                        className="botanical-paper-card rounded-xl p-5"
                      >
                        {/* Dòng 메타 trên cùng của thẻ */}
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
                              onClick={() => setForensicModalItem(item)}
                              className="inline-flex items-center gap-1.5 rounded-lg border border-botanical-terracotta bg-botanical-terracottaBg px-3 py-1 text-xs font-bold text-botanical-terracotta transition hover:bg-botanical-terracotta hover:text-white"
                            >
                              <Sparkles className="h-3.5 w-3.5" />
                              Phòng Khám AI &amp; Bài Tập Sinh Đôi (
                              {item.twinQuestions.length})
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                setEditingItem(item);
                                window.scrollTo({ top: 0, behavior: 'smooth' });
                              }}
                              className="rounded-lg border border-botanical-border bg-botanical-canvas p-1.5 text-botanical-muted hover:text-botanical-ink"
                              title="Chỉnh sửa bản ghi"
                            >
                              <Edit3 className="h-3.5 w-3.5" />
                            </button>

                            <button
                              type="button"
                              onClick={() => void handleDeleteLog(item.id)}
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
                              {item.whyCodes.map((code) => {
                                const def = WHY_DICTIONARY.find(
                                  (w) => w.code === code
                                );
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
                                <strong className="text-botanical-ochre">
                                  NẾU:{' '}
                                </strong>
                                <MathText
                                  content={item.ifTrigger}
                                  className="inline"
                                />
                              </div>
                              <div>
                                <strong className="text-botanical-matcha">
                                  THÌ:{' '}
                                </strong>
                                <MathText
                                  content={item.thenAction}
                                  className="inline"
                                />
                              </div>
                            </div>

                            {/* Nguồn tham chiếu YouTube ?t= / Sách */}
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
                                        {formatSecondsToMinSec(
                                          ref.youtubeTimestampSec
                                        ) || 'Mở'}
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
                  })}
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