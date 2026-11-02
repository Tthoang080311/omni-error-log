// File: src/components/RedemptionReview.tsx
'use client';

import React, { useState, useMemo } from 'react';
import { ErrorLogItem } from '@/types/error-log';
import { LEITNER_INTERVAL_DAYS, WHY_DICTIONARY } from '@/constants/taxonomy';
import MathText from './MathText';
import {
  Flame,
  Eye,
  CheckCircle2,
  RotateCcw,
  Download,
  FileText,
  ShieldCheck,
  Box,
} from 'lucide-react';

interface RedemptionReviewProps {
  logs: ErrorLogItem[];
  mode: 'REVIEW' | 'CHECKLIST';
  onReviewGrade: (id: string, rememberedCorrectly: boolean) => Promise<void>;
}

export function exportLogsToAnkiCsv(logs: ErrorLogItem[]) {
  // Cấu trúc CSV chuẩn Anki 2 cột: Front (Mặt trước) ; Back (Mặt sau)
  const rows: string[][] = [];

  for (const item of logs) {
    const frontHtml = [
      `<b>[${item.subjectName} — ${item.topic}]</b>`,
      `<br/><br/>`,
      item.questionText.replace(/\n/g, '<br/>'),
      item.problemImageUrl
        ? `<br/><small>(Ảnh đề: ${item.problemImageUrl})</small>`
        : '',
      `<br/><br/><i>Điểm cần cảnh giác: Hãy kích hoạt phản xạ NẾU - THÌ nào trước khi đặt bút?</i>`,
    ].join('');

    const whyTitles = item.whyCodes
      .map((c) => WHY_DICTIONARY.find((w) => w.code === c)?.title || c)
      .join(' | ');

    const backHtml = [
      `<b>QUY TẮC PHẢN XẠ NẾU — THÌ:</b><br/>`,
      `• <b>NẾU:</b> ${item.ifTrigger}<br/>`,
      `• <b>THÌ:</b> ${item.thenAction}<br/><br/>`,
      `<b>LỜI GIẢI CHUẨN:</b><br/>${item.correctSolution.replace(/\n/g, '<br/>')}<br/><br/>`,
      `<small><b>Lỗi từng mắc (${whyTitles}):</b> ${item.myWrongStep}</small>`,
    ].join('');

    rows.push([frontHtml, backHtml, `${item.subjectId}::${item.topic}`]);
  }

  const csvContent = rows
    .map((r) =>
      r.map((field) => `"${String(field).replace(/"/g, '""')}"`).join(';')
    )
    .join('\n');

  const blob = new Blob(['\uFEFF' + csvContent], {
    type: 'text/csv;charset=utf-8;',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `anki-omni-error-log-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function exportLogsToMarkdown(logs: ErrorLogItem[]) {
  const lines: string[] = [
    `# SỔ TAY PHÂN TÍCH LỖI SAI & CẨM NANG CHỐNG SAI NGU (OMNI-SUBJECT ERROR LOG)`,
    `> Xuất ngày: ${new Date().toLocaleString('vi-VN')} | Tổng số bản ghi: ${logs.length}`,
    '',
  ];

  for (const item of logs) {
    lines.push(`## [${item.subjectName}] ${item.topic}`);
    lines.push(
      `- **Hộp Leitner:** Hộp ${item.leitnerBox} | **Mã lỗi WHY:** ${item.whyCodes.join(', ')}`
    );
    lines.push(`- **Đề bài:** ${item.questionText}`);
    lines.push(`- **Bước làm sai cũ:** ${item.myWrongStep}`);
    lines.push(`- **Lời giải chuẩn:** ${item.correctSolution}`);
    lines.push(`- **Phản xạ NẾU:** ${item.ifTrigger}`);
    lines.push(`- **Hành động THÌ:** ${item.thenAction}`);
    lines.push('');
    lines.push('---');
    lines.push('');
  }

  const blob = new Blob([lines.join('\n')], {
    type: 'text/markdown;charset=utf-8;',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `error-log-archive-${new Date().toISOString().slice(0, 10)}.md`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function RedemptionReview({
  logs,
  mode,
  onReviewGrade,
}: RedemptionReviewProps) {
  const [selectedBoxFilter, setSelectedBoxFilter] = useState<number | 'DUE_TODAY'>(
    'DUE_TODAY'
  );
  const [currentIndex, setCurrentIndex] = useState(0);
  const [scratchpad, setScratchpad] = useState('');
  const [isAnswerRevealed, setIsAnswerRevealed] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const today = new Date().toISOString().split('T')[0];

  const reviewQueue = useMemo(() => {
    if (selectedBoxFilter === 'DUE_TODAY') {
      return logs.filter((l) => !l.isResolved && l.nextReviewDate <= today);
    }
    return logs.filter((l) => l.leitnerBox === selectedBoxFilter);
  }, [logs, selectedBoxFilter, today]);

  const checklistLogs = useMemo(
    () => logs.filter((l) => l.inPreExamChecklist || l.howActions.includes('H4')),
    [logs]
  );

  // NẾU ĐANG Ở CHẾ ĐỘ TỜ CHECKLIST 5 PHÚT TRƯỚC GIỜ THI
  if (mode === 'CHECKLIST') {
    return (
      <div className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-botanical-border bg-botanical-surface p-5 shadow-paper">
          <div>
            <span className="inline-flex items-center gap-1 rounded bg-botanical-sage px-2.5 py-0.5 font-mono text-[10px] font-bold uppercase text-white">
              <ShieldCheck className="h-3.5 w-3.5" /> PRE-EXAM ANTI-CARELESS PROTOCOL
            </span>
            <h2 className="mt-1 text-base font-bold text-botanical-ink">
              Tờ Checklist &ldquo;Chống Sai Ngu&rdquo; Đọc 5 Phút Trước Khi Vào Phòng Thi
            </h2>
            <p className="text-xs text-botanical-muted">
              Tổng hợp toàn bộ các quy tắc phản xạ có điều kiện <strong>NẾU — THÌ</strong> đã ghim thẻ [H4].
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => exportLogsToAnkiCsv(logs)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-botanical-sage bg-botanical-chipBg px-3.5 py-2 text-xs font-bold text-botanical-chipText hover:bg-botanical-sage hover:text-white"
            >
              <Download className="h-3.5 w-3.5" />
              Xuất Flashcard Anki (.csv)
            </button>

            <button
              type="button"
              onClick={() => exportLogsToMarkdown(logs)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-botanical-border bg-botanical-canvas px-3.5 py-2 text-xs font-semibold text-botanical-ink hover:border-botanical-sage"
            >
              <FileText className="h-3.5 w-3.5" />
              Xuất Sổ tay Markdown (.md)
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {checklistLogs.map((item, idx) => (
            <div
              key={item.id}
              className="botanical-paper-card flex flex-col justify-between rounded-xl p-4"
            >
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="rounded bg-botanical-sage px-2 py-0.5 font-mono text-[10px] font-bold text-white">
                    #{idx + 1} • {item.subjectName} ({item.topic})
                  </span>
                  <div className="flex gap-1">
                    {item.whyCodes.map((c) => (
                      <span
                        key={c}
                        className="rounded bg-botanical-terracottaBg px-1.5 py-0.5 font-mono text-[10px] font-bold text-botanical-terracotta"
                      >
                        {c}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="rounded-lg border border-botanical-ochre/40 bg-botanical-ochreBg/60 p-2.5 text-xs">
                  <span className="font-bold text-botanical-ochre">
                    NẾU (Dấu hiệu đề):{' '}
                  </span>
                  <MathText content={item.ifTrigger} className="inline" />
                </div>

                <div className="rounded-lg border border-botanical-matcha/40 bg-botanical-matchaBg/60 p-2.5 text-xs">
                  <span className="font-bold text-botanical-matcha">
                    THÌ (Thao tác bắt buộc):{' '}
                  </span>
                  <MathText content={item.thenAction} className="inline" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // CHẾ ĐỘ PHỤC THÙ (REDEMPTION REVIEW MODE - LEITNER BOX 1 -> 5)
  const activeItem = reviewQueue[currentIndex] || reviewQueue[0] || null;

  const handleGrade = async (remembered: boolean) => {
    if (!activeItem) return;
    setIsSubmitting(true);
    try {
      await onReviewGrade(activeItem.id, remembered);
      setIsAnswerRevealed(false);
      setScratchpad('');
      setCurrentIndex(0);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Thanh chọn Hộp Leitner (Box 1 -> Box 5) */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-botanical-border bg-botanical-surface p-4 shadow-paper">
        <div>
          <span className="inline-flex items-center gap-1 rounded bg-botanical-terracotta px-2 py-0.5 font-mono text-[10px] font-bold uppercase text-white">
            <Flame className="h-3 w-3" /> REDEMPTION REVIEW MODE (SPACED REPETITION)
          </span>
          <h2 className="mt-1 text-sm font-bold text-botanical-ink">
            Chế độ &ldquo;Phục Thù&rdquo; theo Thuật toán 5 Hộp Leitner (1 - 3 - 7 - 14 - 21 ngày)
          </h2>
          <p className="text-xs text-botanical-muted">
            Hệ thống đã <strong>ẩn toàn bộ cột WHY/HOW và lời giải</strong> để bạn tự giải lại từ đầu không gợi ý.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => {
              setSelectedBoxFilter('DUE_TODAY');
              setCurrentIndex(0);
              setIsAnswerRevealed(false);
            }}
            className={`rounded-lg border px-3 py-1.5 text-xs font-bold transition ${
              selectedBoxFilter === 'DUE_TODAY'
                ? 'border-botanical-terracotta bg-botanical-terracotta text-white'
                : 'border-botanical-border bg-botanical-canvas text-botanical-ink'
            }`}
          >
            Đến hạn hôm nay (
            {logs.filter((l) => !l.isResolved && l.nextReviewDate <= today).length})
          </button>

          {([1, 2, 3, 4, 5] as const).map((boxNum) => {
            const countInBox = logs.filter((l) => l.leitnerBox === boxNum).length;
            return (
              <button
                key={boxNum}
                type="button"
                onClick={() => {
                  setSelectedBoxFilter(boxNum);
                  setCurrentIndex(0);
                  setIsAnswerRevealed(false);
                }}
                className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition ${
                  selectedBoxFilter === boxNum
                    ? 'border-botanical-sage bg-botanical-sage text-white'
                    : 'border-botanical-border bg-botanical-canvas text-botanical-ink hover:border-botanical-sage'
                }`}
              >
                <Box className="h-3 w-3" />
                Hộp {boxNum} ({LEITNER_INTERVAL_DAYS[boxNum]}d): {countInBox}
              </button>
            );
          })}
        </div>
      </div>

      {/* Trạm làm bài Phục thù */}
      {!activeItem ? (
        <div className="botanical-paper-card rounded-xl p-10 text-center">
          <CheckCircle2 className="mx-auto mb-2 h-10 w-10 text-botanical-matcha" />
          <h3 className="text-sm font-bold text-botanical-ink">
            Tuyệt vời! Không còn câu hỏi nào tồn đọng trong hàng đợi này.
          </h3>
          <p className="mt-1 text-xs text-botanical-muted">
            Bạn có thể chọn Hộp Leitner 1, 2, 3 ở thanh phía trên để chủ động ôn tập sớm.
          </p>
        </div>
      ) : (
        <div className="botanical-paper-card rounded-xl p-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-botanical-border pb-3">
            <div className="flex items-center gap-2">
              <span className="rounded bg-botanical-sage px-2.5 py-1 font-mono text-xs font-bold text-white">
                {activeItem.subjectName} • {activeItem.topic}
              </span>
              <span className="rounded border border-botanical-border bg-botanical-canvas px-2 py-0.5 font-mono text-xs text-botanical-muted">
                Đang ở Hộp Leitner {activeItem.leitnerBox} • Đã ôn {activeItem.reviewCount} lần
              </span>
            </div>

            <span className="text-xs font-semibold text-botanical-eucalyptus">
              Câu {currentIndex + 1} / {reviewQueue.length}
            </span>
          </div>

          {/* CHỈ HIỂN THỊ ĐỀ BÀI VÀ ẢNH ĐỀ (ẨN TOÀN BỘ WHY/HOW/LỜI GIẢI) */}
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
            <div className="space-y-3 lg:col-span-7">
              <div className="text-xs font-bold uppercase tracking-wider text-botanical-muted">
                Đề bài cần giải lại từ đầu:
              </div>
              <div className="rounded-xl border border-botanical-border bg-botanical-canvas p-4 text-sm">
                <MathText content={activeItem.questionText} />
              </div>

              {activeItem.problemImageUrl && (
                <div className="overflow-hidden rounded-xl border border-botanical-border bg-botanical-surface p-2">
                  <img
                    src={activeItem.problemImageUrl}
                    alt="Problem prompt"
                    className="max-h-72 w-full rounded object-contain"
                  />
                </div>
              )}
            </div>

            {/* Khung tự nháp và nút Lật đáp án */}
            <div className="flex flex-col justify-between space-y-4 lg:col-span-5">
              <div>
                <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-botanical-sage">
                  Giấy nháp Phục thù (Viết ĐKXĐ / Phản xạ NẾU-THÌ của bạn ra đây trước khi lật):
                </label>
                <textarea
                  rows={6}
                  value={scratchpad}
                  onChange={(e) => setScratchpad(e.target.value)}
                  placeholder="Tự viết các bước biến đổi và đáp án cuối cùng của bạn vào đây trước khi bấm Lật Đáp Án..."
                  className="w-full rounded-xl border border-botanical-border bg-botanical-canvas p-3 text-xs text-botanical-ink focus:border-botanical-sage focus:outline-none"
                />
              </div>

              {!isAnswerRevealed ? (
                <button
                  type="button"
                  onClick={() => setIsAnswerRevealed(true)}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-botanical-sage py-3 text-xs font-bold text-white shadow-sm hover:opacity-95"
                >
                  <Eye className="h-4 w-4" />
                  Lật Đáp Án Chuẩn &amp; Đối Chiếu Quy Tắc NẾU — THÌ
                </button>
              ) : (
                <div className="space-y-3 rounded-xl border border-botanical-sage bg-botanical-mossMist/60 p-4">
                  <div className="space-y-2 text-xs">
                    <div className="rounded border border-botanical-terracotta/40 bg-botanical-terracottaBg p-2 text-botanical-terracotta">
                      <strong>Cái bẫy bạn từng sập ({activeItem.whyCodes.join(', ')}):</strong>{' '}
                      <MathText content={activeItem.myWrongStep} />
                    </div>

                    <div className="rounded border border-botanical-ochre/40 bg-botanical-ochreBg p-2 text-botanical-ink">
                      <strong className="text-botanical-ochre">Quy tắc NẾU:</strong>{' '}
                      {activeItem.ifTrigger}
                      <br />
                      <strong className="text-botanical-matcha">Hành động THÌ:</strong>{' '}
                      {activeItem.thenAction}
                    </div>

                    <div className="rounded border border-botanical-matcha/50 bg-botanical-matchaBg p-2.5 text-botanical-ink">
                      <strong className="block text-botanical-matcha">
                        Lời giải chuẩn xác:
                      </strong>
                      <MathText content={activeItem.correctSolution} />
                    </div>
                  </div>

                  {/* 2 Nút tự chấm điểm Leitner */}
                  <div className="grid grid-cols-1 gap-2 pt-2 sm:grid-cols-2">
                    <button
                      type="button"
                      disabled={isSubmitting}
                      onClick={() => void handleGrade(false)}
                      className="flex items-center justify-center gap-1.5 rounded-lg border border-botanical-terracotta bg-botanical-terracottaBg px-3 py-2.5 text-xs font-bold text-botanical-terracotta hover:bg-botanical-terracotta hover:text-white"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      Vẫn sập bẫy (Reset về Hộp 1)
                    </button>

                    <button
                      type="button"
                      disabled={isSubmitting}
                      onClick={() => void handleGrade(true)}
                      className="flex items-center justify-center gap-1.5 rounded-lg bg-botanical-matcha px-3 py-2.5 text-xs font-bold text-white shadow-sm hover:opacity-95"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Đã vượt bẫy! (Thăng lên Hộp {Math.min(5, activeItem.leitnerBox + 1)})
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}