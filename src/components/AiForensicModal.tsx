// File: src/components/AiForensicModal.tsx
'use client';

import React, { useState } from 'react';
import {
  ErrorLogItem,
  AiForensicResult,
  TwinQuestion,
} from '@/types/error-log';
import MathText from './MathText';
import {
  X,
  Sparkles,
  Wand2,
  ShieldAlert,
  CheckCircle2,
  Eye,
  EyeOff,
  RefreshCw,
  ArrowRight,
  AlertTriangle,
} from 'lucide-react';

interface AiForensicModalProps {
  item: ErrorLogItem | null;
  customApiKey?: string;
  onClose: () => void;
  onUpdateItem: (updated: ErrorLogItem) => Promise<void>;
}

export default function AiForensicModal({
  item,
  customApiKey,
  onClose,
  onUpdateItem,
}: AiForensicModalProps) {
  const [isRunningAutopsy, setIsRunningAutopsy] = useState(false);
  const [isGeneratingTwins, setIsGeneratingTwins] = useState(false);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, string>>({});
  const [revealedSolutions, setRevealedSolutions] = useState<Record<string, boolean>>({});
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  if (!item) return null;

  const handleRunAutopsy = async () => {
    setIsRunningAutopsy(true);
    setStatusMessage(null);
    try {
      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'autopsy',
          payload: {
            subjectName: item.subjectName,
            topic: item.topic,
            processBreakpoint: item.processBreakpoint,
            questionText: item.questionText,
            myWrongStep: item.myWrongStep,
            correctSolution: item.correctSolution,
            whyCodes: item.whyCodes,
            problemImageUrl: item.problemImageUrl,
            customApiKey,
          },
        }),
      });
      const data = await res.json();
      if (data.ok && data.autopsy) {
        const nextAutopsy: AiForensicResult = data.autopsy;
        await onUpdateItem({
          ...item,
          aiAutopsy: nextAutopsy,
        });
        setStatusMessage('Đã hoàn tất Khám nghiệm Nhận thức AI.');
      }
    } finally {
      setIsRunningAutopsy(false);
    }
  };

  const handleApplyIfThenRule = async () => {
    if (!item.aiAutopsy) return;
    await onUpdateItem({
      ...item,
      ifTrigger: item.aiAutopsy.quy_tac_neu_thi.neu_trigger,
      thenAction: item.aiAutopsy.quy_tac_neu_thi.thi_action,
    });
    setStatusMessage('Đã áp dụng quy tắc NẾU - THÌ của AI vào bản ghi gốc!');
  };

  const handleGenerateTwins = async () => {
    setIsGeneratingTwins(true);
    setStatusMessage(null);
    try {
      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'twins',
          payload: {
            subjectName: item.subjectName,
            topic: item.topic,
            processBreakpoint: item.processBreakpoint,
            questionText: item.questionText,
            myWrongStep: item.myWrongStep,
            correctSolution: item.correctSolution,
            whyCodes: item.whyCodes,
            problemImageUrl: item.problemImageUrl,
            customApiKey,
          },
        }),
      });
      const data = await res.json();
      if (data.ok && Array.isArray(data.twins)) {
        const nextTwins: TwinQuestion[] = data.twins;
        await onUpdateItem({
          ...item,
          twinQuestions: nextTwins,
        });
        setStatusMessage('Đã sinh 2 Bài tập Sinh đôi cùng cấu trúc bẫy!');
      }
    } finally {
      setIsGeneratingTwins(false);
    }
  };

  const handleCheckTwinAnswer = async (twinId: string, userAns: string) => {
    setSelectedAnswers((prev) => ({ ...prev, [twinId]: userAns }));
    const updatedTwins = item.twinQuestions.map((t) =>
      t.id === twinId
        ? {
            ...t,
            userAttempt: userAns,
            isSolved:
              userAns.trim().toLowerCase() ===
                t.correctAnswer.trim().toLowerCase() ||
              t.correctAnswer
                .trim()
                .toLowerCase()
                .startsWith(userAns.trim().toLowerCase().slice(0, 2)),
          }
        : t
    );
    await onUpdateItem({
      ...item,
      twinQuestions: updatedTwins,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-botanical-ink/50 p-4 backdrop-blur-[2px]">
      <div className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-botanical-border bg-botanical-surface shadow-elevated">
        {/* Header Modal */}
        <div className="flex items-center justify-between border-b border-botanical-border bg-botanical-canvas px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-botanical-terracotta text-white">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="rounded bg-botanical-sage px-2 py-0.5 font-mono text-[10px] font-bold uppercase text-white">
                  {item.subjectName}
                </span>
                <span className="text-xs font-semibold text-botanical-eucalyptus">
                  {item.topic}
                </span>
              </div>
              <h3 className="mt-0.5 text-base font-bold text-botanical-ink">
                Phòng Khám Nghiệm Nhận Thức AI &amp; Trạm Phục Thù Bài Tập Sinh Đôi
              </h3>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-botanical-border bg-botanical-surface p-1.5 text-botanical-muted hover:bg-botanical-mossMist hover:text-botanical-ink"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Nội dung cuộn */}
        <div className="flex-1 space-y-6 overflow-y-auto p-6">
          {statusMessage && (
            <div className="flex items-center justify-between rounded-lg border border-botanical-matcha bg-botanical-matchaBg px-4 py-2 text-xs font-semibold text-botanical-matcha">
              <span>{statusMessage}</span>
              <button
                type="button"
                onClick={() => setStatusMessage(null)}
                className="text-[11px] underline"
              >
                Đóng
              </button>
            </div>
          )}

          {/* Tóm tắt câu hỏi gốc & ảnh chụp màn hình */}
          <div className="grid grid-cols-1 gap-4 rounded-xl border border-botanical-border bg-botanical-canvas p-4 lg:grid-cols-12">
            <div className="space-y-2 lg:col-span-7">
              <div className="text-[11px] font-bold uppercase tracking-wider text-botanical-muted">
                Hồ sơ Lỗi sai Gốc:
              </div>
              <div className="rounded-lg border border-botanical-border bg-botanical-surface p-3 text-xs">
                <MathText content={item.questionText || '(Đề bài lưu bằng hình ảnh)'} />
              </div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <div className="rounded-lg border border-botanical-terracotta/40 bg-botanical-terracottaBg/50 p-2.5 text-xs">
                  <span className="block font-bold text-botanical-terracotta">
                    Thao tác sai của bạn:
                  </span>
                  <MathText content={item.myWrongStep || 'Chưa ghi chi tiết'} />
                </div>
                <div className="rounded-lg border border-botanical-matcha/40 bg-botanical-matchaBg/50 p-2.5 text-xs">
                  <span className="block font-bold text-botanical-matcha">
                    Lời giải chuẩn:
                  </span>
                  <MathText content={item.correctSolution || 'Chưa ghi chi tiết'} />
                </div>
              </div>
            </div>

            <div className="flex flex-col justify-between gap-2 lg:col-span-5">
              {item.problemImageUrl ? (
                <div className="overflow-hidden rounded-lg border border-botanical-border bg-botanical-surface p-1.5">
                  <div className="mb-1 text-[10px] font-semibold uppercase text-botanical-terracotta">
                    Ảnh bài làm đã khoanh Bút Đỏ Đất Nung:
                  </div>
                  <img
                    src={item.problemImageUrl}
                    alt="Problem annotation"
                    className="max-h-44 w-full rounded object-contain"
                  />
                </div>
              ) : (
                <div className="flex h-full items-center justify-center rounded-lg border border-dashed border-botanical-border bg-botanical-surface/60 p-4 text-center text-xs text-botanical-muted">
                  Không có ảnh đính kèm (AI phân tích trực tiếp từ công thức LaTeX &amp; thẻ WHY)
                </div>
              )}
            </div>
          </div>

          {/* PHẦN A: KHÁM NGHIỆM LỖI SAI 1-CLICK (AI FORENSIC AUTOPSY) */}
          <div className="rounded-xl border border-botanical-border bg-botanical-surface p-5 shadow-paper">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-botanical-border pb-3">
              <div>
                <span className="inline-block rounded bg-botanical-terracotta px-2 py-0.5 font-mono text-[10px] font-bold uppercase text-white">
                  CHẨN ĐOÁN SÂU 1-CLICK
                </span>
                <h4 className="mt-1 text-sm font-bold text-botanical-ink">
                  1. Kết quả Khám Nghiệm Nhận Thức (AI Forensic Autopsy)
                </h4>
              </div>

              <button
                type="button"
                onClick={handleRunAutopsy}
                disabled={isRunningAutopsy}
                className="inline-flex items-center gap-1.5 rounded-lg bg-botanical-terracotta px-3.5 py-2 text-xs font-bold text-white shadow-sm transition hover:opacity-95 disabled:opacity-50"
              >
                <RefreshCw
                  className={`h-3.5 w-3.5 ${isRunningAutopsy ? 'animate-spin' : ''}`}
                />
                {item.aiAutopsy
                  ? 'Chạy lại Khám Nghiệm AI'
                  : 'Bấm để AI Mổ Xẻ Lỗ Hổng Tư Duy'}
              </button>
            </div>

            {!item.aiAutopsy ? (
              <div className="rounded-lg border border-dashed border-botanical-border bg-botanical-canvas p-6 text-center">
                <p className="text-xs text-botanical-muted">
                  Bấm nút <strong>&ldquo;Bấm để AI Mổ Xẻ Lỗ Hổng Tư Duy&rdquo;</strong> ở góc phải để AI đọc đề bài/ảnh nháp và chỉ ra chính xác điểm mù nhận thức của bạn.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="rounded-lg border border-botanical-terracotta/50 bg-botanical-terracottaBg/40 p-3.5">
                  <div className="text-xs font-bold uppercase tracking-wider text-botanical-terracotta">
                    Điểm mù nhận thức cốt lõi (lo_hong_tu_duy):
                  </div>
                  <p className="mt-1 text-sm font-medium leading-relaxed text-botanical-ink">
                    {item.aiAutopsy.lo_hong_tu_duy}
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <div className="rounded-lg border border-botanical-terracotta/40 bg-botanical-surface p-3.5">
                    <span className="inline-block rounded bg-botanical-terracottaBg px-2 py-0.5 text-[11px] font-bold text-botanical-terracotta">
                      [Bước sai của bạn]
                    </span>
                    <div className="mt-2 text-xs">
                      <MathText
                        content={item.aiAutopsy.so_sanh_buoc_giai.buoc_sai_cua_ban}
                      />
                    </div>
                  </div>

                  <div className="rounded-lg border border-botanical-matcha/40 bg-botanical-surface p-3.5">
                    <span className="inline-block rounded bg-botanical-matchaBg px-2 py-0.5 text-[11px] font-bold text-botanical-matcha">
                      [Tư duy chuẩn xác]
                    </span>
                    <div className="mt-2 text-xs">
                      <MathText
                        content={item.aiAutopsy.so_sanh_buoc_giai.tu_duy_chuan_xac}
                      />
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-botanical-sage/40 bg-botanical-mossMist/60 p-3.5">
                  <div className="space-y-1 text-xs">
                    <div className="font-bold text-botanical-sage">
                      Phác đồ Phản xạ NẾU — THÌ do AI đề xuất:
                    </div>
                    <div>
                      <strong className="text-botanical-ochre">NẾU: </strong>
                      <span>{item.aiAutopsy.quy_tac_neu_thi.neu_trigger}</span>
                    </div>
                    <div>
                      <strong className="text-botanical-matcha">THÌ: </strong>
                      <span>{item.aiAutopsy.quy_tac_neu_thi.thi_action}</span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleApplyIfThenRule}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-botanical-sage px-3 py-2 text-xs font-semibold text-white shadow-sm hover:opacity-95"
                  >
                    <Wand2 className="h-3.5 w-3.5" />
                    Ghi đè vào ô HOW của bản ghi
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* PHẦN B: TRÌNH TẠO "BÀI TẬP SINH ĐÔI" (ISOMORPHIC TWIN GENERATOR) */}
          <div className="rounded-xl border border-botanical-border bg-botanical-surface p-5 shadow-paper">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-botanical-border pb-3">
              <div>
                <span className="inline-block rounded bg-botanical-sage px-2 py-0.5 font-mono text-[10px] font-bold uppercase text-white">
                  ISOMORPHIC TWIN QUESTIONS
                </span>
                <h4 className="mt-1 text-sm font-bold text-botanical-ink">
                  2. Giải &ldquo;Bài Tập Sinh Đôi&rdquo; Để Phục Thù Tại Chỗ
                </h4>
                <p className="text-xs text-botanical-muted">
                  Giữ nguyên cấu trúc công thức và cái bẫy nhận thức của câu vừa sai nhưng đổi số liệu/bối cảnh mới.
                </p>
              </div>

              <button
                type="button"
                onClick={handleGenerateTwins}
                disabled={isGeneratingTwins}
                className="inline-flex items-center gap-1.5 rounded-lg bg-botanical-sage px-3.5 py-2 text-xs font-bold text-white shadow-sm transition hover:opacity-95 disabled:opacity-50"
              >
                <ShieldAlert
                  className={`h-4 w-4 ${isGeneratingTwins ? 'animate-bounce' : ''}`}
                />
                {isGeneratingTwins
                  ? 'AI đang chế tác 2 đề mới...'
                  : item.twinQuestions.length > 0
                  ? 'Đẻ thêm 2 Bài Tập Sinh Đôi Mới'
                  : 'Tạo ngay 2 Bài Tập Sinh Đôi'}
              </button>
            </div>

            {item.twinQuestions.length === 0 ? (
              <div className="rounded-lg border border-dashed border-botanical-border bg-botanical-canvas p-6 text-center">
                <p className="text-xs text-botanical-muted">
                  Chưa có Bài tập Sinh đôi nào cho lỗi này. Hãy bấm nút{' '}
                  <strong>&ldquo;Tạo ngay 2 Bài Tập Sinh Đôi&rdquo;</strong> để kiểm tra xem bạn đã thực sự vá được lỗ hổng chưa.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                {item.twinQuestions.map((twin, idx) => {
                  const currentInput =
                    selectedAnswers[twin.id] ?? twin.userAttempt ?? '';
                  const isRevealed = Boolean(revealedSolutions[twin.id]);

                  return (
                    <div
                      key={twin.id}
                      className="flex flex-col justify-between rounded-xl border border-botanical-border bg-botanical-canvas p-4"
                    >
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="rounded bg-botanical-chipBg px-2.5 py-0.5 text-xs font-bold text-botanical-chipText">
                            {twin.title || `Bài tập Sinh đôi #${idx + 1}`}
                          </span>
                          {twin.isSolved && (
                            <span className="inline-flex items-center gap-1 rounded bg-botanical-matchaBg px-2 py-0.5 text-[11px] font-bold text-botanical-matcha">
                              <CheckCircle2 className="h-3.5 w-3.5" /> Đã phục thù
                            </span>
                          )}
                        </div>

                        {/* Cảnh báo bẫy */}
                        <div className="flex items-start gap-2 rounded-md border border-botanical-ochre/40 bg-botanical-ochreBg px-2.5 py-1.5 text-[11px] text-botanical-ochre">
                          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                          <span>
                            <strong>Cảnh báo bẫy lặp lại:</strong> {twin.trapWarning}
                          </span>
                        </div>

                        {/* Nội dung đề bài sinh đôi */}
                        <div className="rounded-lg border border-botanical-border bg-botanical-surface p-3 text-xs">
                          <MathText content={twin.promptLatex} />
                        </div>

                        {/* Các phương án lựa chọn hoặc ô điền đáp án */}
                        {twin.options && twin.options.length > 0 ? (
                          <div className="space-y-1.5">
                            {twin.options.map((opt) => {
                              const isChosen = currentInput === opt;
                              return (
                                <button
                                  key={opt}
                                  type="button"
                                  onClick={() =>
                                    void handleCheckTwinAnswer(twin.id, opt)
                                  }
                                  className={`flex w-full items-center justify-between rounded-md border px-3 py-2 text-left text-xs transition ${
                                    isChosen
                                      ? 'border-botanical-sage bg-botanical-chipBg font-bold text-botanical-chipText'
                                      : 'border-botanical-border bg-botanical-surface text-botanical-ink hover:border-botanical-borderHover'
                                  }`}
                                >
                                  <MathText content={opt} />
                                  {isChosen && (
                                    <ArrowRight className="h-3.5 w-3.5 shrink-0 text-botanical-sage" />
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        ) : (
                          <div className="flex gap-2">
                            <input
                              type="text"
                              value={currentInput}
                              onChange={(e) =>
                                setSelectedAnswers((p) => ({
                                  ...p,
                                  [twin.id]: e.target.value,
                                }))
                              }
                              placeholder="Nhập đáp án của bạn..."
                              className="flex-1 rounded-md border border-botanical-border bg-botanical-surface px-3 py-1.5 text-xs"
                            />
                            <button
                              type="button"
                              onClick={() =>
                                void handleCheckTwinAnswer(twin.id, currentInput)
                              }
                              className="rounded-md bg-botanical-sage px-3 py-1.5 text-xs font-semibold text-white"
                            >
                              Kiểm tra
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Khu vực đối chiếu kết quả & Lời giải chi tiết */}
                      <div className="mt-4 space-y-2 border-t border-botanical-border pt-3">
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-botanical-muted">
                            {currentInput ? (
                              twin.isSolved ? (
                                <strong className="text-botanical-matcha">
                                  Chính xác! Bạn đã vượt qua cái bẫy này.
                                </strong>
                              ) : (
                                <strong className="text-botanical-terracotta">
                                  Đã chọn: {currentInput} (Hãy mở lời giải để đối chiếu)
                                </strong>
                              )
                            ) : (
                              'Hãy chọn hoặc nhập đáp án trước khi xem giải'
                            )}
                          </span>

                          <button
                            type="button"
                            onClick={() =>
                              setRevealedSolutions((prev) => ({
                                ...prev,
                                [twin.id]: !prev[twin.id],
                              }))
                            }
                            className="inline-flex items-center gap-1 rounded border border-botanical-border bg-botanical-surface px-2.5 py-1 text-xs font-semibold text-botanical-eucalyptus hover:border-botanical-sage"
                          >
                            {isRevealed ? (
                              <>
                                <EyeOff className="h-3.5 w-3.5" /> Ẩn lời giải
                              </>
                            ) : (
                              <>
                                <Eye className="h-3.5 w-3.5" /> Hiện đáp án &amp; Lời giải
                              </>
                            )}
                          </button>
                        </div>

                        {isRevealed && (
                          <div className="rounded-lg border border-botanical-matcha/50 bg-botanical-matchaBg/60 p-3 text-xs">
                            <div className="mb-1 font-bold text-botanical-matcha">
                              Đáp án đúng: <MathText content={twin.correctAnswer} />
                            </div>
                            <div className="border-t border-botanical-matcha/20 pt-1.5 text-botanical-ink">
                              <MathText content={twin.stepByStepSolution} />
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}