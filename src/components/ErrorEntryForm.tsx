// File: src/components/ErrorEntryForm.tsx
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  ErrorLogItem,
  QuestionFormat,
  ProcessBreakpoint,
  TimePressureLevel,
  WhyCode,
  HowActionCode,
  ReferenceItem,
  AiForensicResult,
  TwinQuestion,
  SubjectGroup,
} from '@/types/error-log';
import {
  INITIAL_SUBJECTS,
  SubjectDefinition,
  QUESTION_FORMATS,
  PROCESS_BREAKPOINTS,
  TIME_PRESSURE_LEVELS,
  WHY_DICTIONARY,
  WHY_GROUPS_META,
  HOW_ACTIONS_DICTIONARY,
} from '@/constants/taxonomy';
import CanvasAnnotator from './CanvasAnnotator';
import ReferenceLocator from './ReferenceLocator';
import MathText from './MathText';
import {
  Sparkles,
  Save,
  AlertTriangle,
  Wand2,
  Plus,
  Star,
  Layers,
  ShieldAlert,
  CheckCircle2,
  Eye,
} from 'lucide-react';

interface ErrorEntryFormProps {
  editingItem?: ErrorLogItem | null;
  customApiKey?: string;
  onSaveSuccess: (
    savedItem: ErrorLogItem,
    openTwinGeneratorAfterSave?: boolean
  ) => void;
  onCancelEdit?: () => void;
}

const VAGUE_FORBIDDEN_PHRASES = [
  'cẩn thận hơn',
  'chú ý hơn',
  'không ẩu nữa',
  'đọc kỹ đề hơn',
  'cố gắng hơn',
  'lần sau chú ý',
];

export default function ErrorEntryForm({
  editingItem,
  customApiKey,
  onSaveSuccess,
  onCancelEdit,
}: ErrorEntryFormProps) {
  // Danh sách môn học (cho phép người dùng thêm môn mới ngay trên giao diện)
  const [subjects, setSubjects] = useState<SubjectDefinition[]>(INITIAL_SUBJECTS);
  const [showAddSubject, setShowAddSubject] = useState(false);
  const [newSubjectName, setNewSubjectName] = useState('');
  const [newSubjectGroup, setNewSubjectGroup] = useState<SubjectGroup>('STEM');

  // KHUNG 1: WHAT
  const [subjectId, setSubjectId] = useState<string>('math-thpt');
  const [topic, setTopic] = useState<string>('Hàm số & Đạo hàm');
  const [questionFormat, setQuestionFormat] = useState<QuestionFormat>('MCQ_4');
  const [processBreakpoint, setProcessBreakpoint] =
    useState<ProcessBreakpoint>('STAGE_1_DECODE');
  const [difficulty, setDifficulty] = useState<1 | 2 | 3 | 4 | 5>(3);
  const [timePressure, setTimePressure] =
    useState<TimePressureLevel>('EXAM_PACE');
  const [questionText, setQuestionText] = useState<string>('');
  const [myWrongStep, setMyWrongStep] = useState<string>('');
  const [correctSolution, setCorrectSolution] = useState<string>('');
  const [showLatexPreview, setShowLatexPreview] = useState<boolean>(true);

  // ĐA PHƯƠNG TIỆN
  const [problemImageUrl, setProblemImageUrl] = useState<string | undefined>(
    undefined
  );
  const [solutionImageUrl, setSolutionImageUrl] = useState<string | undefined>(
    undefined
  );
  const [activePasteSlot, setActivePasteSlot] = useState<'problem' | 'solution'>(
    'problem'
  );
  const [references, setReferences] = useState<ReferenceItem[]>([]);

  // KHUNG 2: WHY
  const [whyCodes, setWhyCodes] = useState<WhyCode[]>(['A1']);
  const [whyCustomNotes, setWhyCustomNotes] = useState<string>('');

  // KHUNG 3: HOW
  const [ifTrigger, setIfTrigger] = useState<string>('');
  const [thenAction, setThenAction] = useState<string>('');
  const [howActions, setHowActions] = useState<HowActionCode[]>(['H1', 'H4']);

  // AI FORENSIC TRỰC TIẾP TRONG FORM
  const [aiAutopsy, setAiAutopsy] = useState<AiForensicResult | undefined>(
    undefined
  );
  const [twinQuestions, setTwinQuestions] = useState<TwinQuestion[]>([]);
  const [isRunningAi, setIsRunningAi] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  const selectedSubject =
    subjects.find((s) => s.id === subjectId) || subjects[0];

  // Nạp dữ liệu khi chỉnh sửa một bản ghi có sẵn
  useEffect(() => {
    if (!editingItem) return;
    setSubjectId(editingItem.subjectId);
    setTopic(editingItem.topic);
    setQuestionFormat(editingItem.questionFormat);
    setProcessBreakpoint(editingItem.processBreakpoint);
    setDifficulty(editingItem.difficulty);
    setTimePressure(editingItem.timePressure);
    setQuestionText(editingItem.questionText);
    setMyWrongStep(editingItem.myWrongStep);
    setCorrectSolution(editingItem.correctSolution);
    setProblemImageUrl(editingItem.problemImageUrl);
    setSolutionImageUrl(editingItem.solutionImageUrl);
    setReferences(editingItem.references || []);
    setWhyCodes(editingItem.whyCodes);
    setWhyCustomNotes(editingItem.whyCustomNotes);
    setIfTrigger(editingItem.ifTrigger);
    setThenAction(editingItem.thenAction);
    setHowActions(editingItem.howActions);
    setAiAutopsy(editingItem.aiAutopsy);
    setTwinQuestions(editingItem.twinQuestions || []);
  }, [editingItem]);

  // Chọn hoặc bỏ chọn mã lỗi WHY, đồng thời gợi ý quy tắc NẾU-THÌ nếu ô đang trống
  const toggleWhyCode = useCallback(
    (code: WhyCode) => {
      setWhyCodes((prev) => {
        const exists = prev.includes(code);
        const next = exists ? prev.filter((c) => c !== code) : [...prev, code];

        if (!exists) {
          const def = WHY_DICTIONARY.find((d) => d.code === code);
          if (def) {
            setIfTrigger((currIf) => currIf.trim() || def.defaultIfTrigger);
            setThenAction((currThen) => currThen.trim() || def.defaultThenAction);
          }
        }
        return next.length > 0 ? next : [code];
      });
    },
    []
  );

  const toggleHowAction = (code: HowActionCode) => {
    setHowActions((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]
    );
  };

  // Thêm môn học mới tùy chỉnh
  const handleCreateCustomSubject = () => {
    if (!newSubjectName.trim()) return;
    const id = `custom-${Date.now()}`;
    const groupLabel =
      newSubjectGroup === 'STEM'
        ? 'Tự nhiên & Định lượng'
        : newSubjectGroup === 'LANGUAGE'
        ? 'Ngôn ngữ & Học thuật'
        : 'Khoa học Xã hội';

    const newSub: SubjectDefinition = {
      id,
      name: newSubjectName.trim(),
      group: newSubjectGroup,
      groupLabel,
      defaultTopics: ['Chuyên đề 1', 'Chuyên đề 2', 'Đề thi thử'],
    };

    setSubjects((prev) => [...prev, newSub]);
    setSubjectId(id);
    setTopic('Chuyên đề 1');
    setNewSubjectName('');
    setShowAddSubject(false);
  };

  // Gọi AI Khám Nghiệm Lỗi Sai 1-Click ngay trong lúc nhập
  const handleRunInlineAiAutopsy = async () => {
    setIsRunningAi(true);
    setValidationError(null);
    try {
      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'autopsy',
          payload: {
            subjectName: selectedSubject.name,
            topic,
            processBreakpoint,
            questionText,
            myWrongStep,
            correctSolution,
            whyCodes,
            problemImageUrl,
            customApiKey,
          },
        }),
      });
      const data = await res.json();
      if (data.ok && data.autopsy) {
        setAiAutopsy(data.autopsy);
      }
    } catch (err) {
      setValidationError(`Không thể kết nối AI: ${(err as Error).message}`);
    } finally {
      setIsRunningAi(false);
    }
  };

  // Lưu bản ghi lỗi sai
  const handleSaveRecord = useCallback(
    async (triggerTwinModalAfter = false) => {
      setValidationError(null);

      if (!questionText.trim() && !problemImageUrl) {
        setValidationError(
          'Vui lòng nhập nội dung đề bài hoặc bấm Cmd+V dán ít nhất 1 ảnh chụp màn hình vào Ô Ảnh số 1.'
        );
        return;
      }

      if (!ifTrigger.trim() || !thenAction.trim()) {
        setValidationError(
          'Khung HOW bắt buộc phải có đủ Quy tắc Phản xạ "NẾU [Dấu hiệu] -> THÌ [Hành động cơ học]".'
        );
        return;
      }

      // Kiểm tra chống ghi lời hứa sáo rỗng
      const combinedHow = `${ifTrigger} ${thenAction}`.toLowerCase();
      const foundVague = VAGUE_FORBIDDEN_PHRASES.find(
        (phrase) =>
          combinedHow.includes(phrase) && thenAction.trim().split(' ').length < 8
      );
      if (foundVague) {
        setValidationError(
          `Hệ thống từ chối câu chung chung "${foundVague}". Hãy ghi thao tác cơ học cụ thể (VD: "Khoanh tròn 2 vòng chữ KHÔNG và viết ĐKXĐ ở dòng đầu tiên").`
        );
        return;
      }

      setIsSaving(true);
      try {
        const payload = {
          id: editingItem?.id,
          createdAt: editingItem?.createdAt,
          subjectId: selectedSubject.id,
          subjectName: selectedSubject.name,
          subjectGroup: selectedSubject.group,
          topic,
          questionFormat,
          processBreakpoint,
          difficulty,
          timePressure,
          questionText,
          myWrongStep,
          correctSolution,
          problemImageUrl,
          solutionImageUrl,
          references,
          whyCodes,
          whyCustomNotes,
          ifTrigger,
          thenAction,
          howActions,
          inPreExamChecklist: howActions.includes('H4'),
          aiAutopsy,
          twinQuestions,
          leitnerBox: editingItem?.leitnerBox || 1,
          nextReviewDate: editingItem?.nextReviewDate,
          reviewCount: editingItem?.reviewCount || 0,
          isResolved: editingItem?.isResolved || false,
        };

        const res = await fetch('/api/logs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (data.ok && data.item) {
          onSaveSuccess(
            data.item,
            triggerTwinModalAfter || howActions.includes('H3')
          );

          // Nếu là thêm mới thì reset form sạch sẽ
          if (!editingItem) {
            setQuestionText('');
            setMyWrongStep('');
            setCorrectSolution('');
            setProblemImageUrl(undefined);
            setSolutionImageUrl(undefined);
            setReferences([]);
            setWhyCustomNotes('');
            setAiAutopsy(undefined);
            setTwinQuestions([]);
          }
        }
      } catch (err) {
        setValidationError(`Lỗi khi lưu bản ghi: ${(err as Error).message}`);
      } finally {
        setIsSaving(false);
      }
    },
    [
      questionText,
      problemImageUrl,
      ifTrigger,
      thenAction,
      editingItem,
      selectedSubject,
      topic,
      questionFormat,
      processBreakpoint,
      difficulty,
      timePressure,
      myWrongStep,
      correctSolution,
      solutionImageUrl,
      references,
      whyCodes,
      whyCustomNotes,
      howActions,
      aiAutopsy,
      twinQuestions,
      onSaveSuccess,
    ]
  );

  // Phím tắt toàn cục trong Form: 1-9 chọn nhanh tag WHY (khi không focus ô chữ) và Cmd+Enter lưu nhanh
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        void handleSaveRecord(false);
        return;
      }

      const target = e.target as HTMLElement | null;
      const isTyping =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable);

      if (!isTyping && !e.metaKey && !e.ctrlKey && !e.altKey) {
        const matchedWhy = WHY_DICTIONARY.find(
          (w) => w.shortcutKey.toLowerCase() === e.key.toLowerCase()
        );
        if (matchedWhy) {
          e.preventDefault();
          toggleWhyCode(matchedWhy.code);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleSaveRecord, toggleWhyCode]);

  return (
    <div className="space-y-5">
      {/* Thanh trạng thái trên cùng của Trạm Nhập Lỗi */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-botanical-border bg-botanical-surface px-4 py-3 shadow-paper">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-botanical-sage text-white">
            <Layers className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-botanical-ink">
              {editingItem
                ? `Đang chỉnh sửa bản ghi lỗi sai (${editingItem.subjectName})`
                : 'TRẠM PHÂN TÍCH LỖI SAI 3 CHIỀU: WHAT — WHY — HOW'}
            </h2>
            <p className="text-xs text-botanical-muted">
              Phím tắt: Bấm{' '}
              <kbd className="rounded border border-botanical-border bg-botanical-canvas px-1 font-mono text-[10px]">
                Cmd+V
              </kbd>{' '}
              dán ảnh màn hình • Phím{' '}
              <kbd className="rounded border border-botanical-border bg-botanical-canvas px-1 font-mono text-[10px]">
                1-9
              </kbd>{' '}
              chọn nhanh thẻ WHY •{' '}
              <kbd className="rounded border border-botanical-border bg-botanical-canvas px-1 font-mono text-[10px]">
                Cmd+Enter
              </kbd>{' '}
              Lưu bản ghi
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleRunInlineAiAutopsy}
            disabled={isRunningAi}
            className="inline-flex items-center gap-1.5 rounded-lg border border-botanical-terracotta bg-botanical-terracottaBg px-3 py-1.5 text-xs font-semibold text-botanical-terracotta transition hover:bg-botanical-terracotta hover:text-white disabled:opacity-50"
          >
            <Sparkles className="h-3.5 w-3.5" />
            {isRunningAi ? 'AI đang mổ xẻ...' : 'Khám Nghiệm Lỗi Sai 1-Click (AI)'}
          </button>

          {editingItem && onCancelEdit && (
            <button
              type="button"
              onClick={onCancelEdit}
              className="rounded-lg border border-botanical-border bg-botanical-canvas px-3 py-1.5 text-xs font-medium text-botanical-muted hover:text-botanical-ink"
            >
              Hủy sửa
            </button>
          )}

          <button
            type="button"
            onClick={() => void handleSaveRecord(false)}
            disabled={isSaving}
            className="inline-flex items-center gap-1.5 rounded-lg bg-botanical-sage px-4 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:opacity-95 disabled:opacity-50"
          >
            <Save className="h-3.5 w-3.5" />
            {isSaving ? 'Đang lưu...' : 'Lưu vào Sổ Tay Nhận Thức (Cmd+Enter)'}
          </button>
        </div>
      </div>

      {/* Thông báo lỗi kiểm duyệt nếu có */}
      {validationError && (
        <div className="flex items-center gap-2 rounded-lg border border-botanical-terracotta bg-botanical-terracottaBg px-4 py-2.5 text-xs font-medium text-botanical-terracotta">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>{validationError}</span>
        </div>
      )}

      {/* BỐ CỤC 3 CỘT TRỤ CỘT: WHAT - WHY - HOW */}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
        {/* ==================== KHUNG 1: WHAT (5/12 cột) ==================== */}
        <div className="botanical-paper-card flex flex-col justify-between rounded-xl p-4 xl:col-span-5">
          <div className="space-y-4">
            {/* Tiêu đề Khung 1 */}
            <div className="flex items-center justify-between border-b border-botanical-border pb-2.5">
              <div>
                <span className="inline-block rounded bg-botanical-sage px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-white">
                  KHUNG 1 • WHAT
                </span>
                <h3 className="mt-1 text-sm font-bold text-botanical-ink">
                  Sai cái gì? Ở môn nào? Gãy ở bước nào?
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowAddSubject((prev) => !prev)}
                className="inline-flex items-center gap-1 rounded border border-botanical-border bg-botanical-canvas px-2 py-1 text-[11px] font-medium text-botanical-eucalyptus hover:border-botanical-sage"
              >
                <Plus className="h-3 w-3" /> Thêm môn mới
              </button>
            </div>

            {/* Form thêm môn học mới tùy chọn */}
            {showAddSubject && (
              <div className="rounded-lg border border-botanical-border bg-botanical-mossMist/60 p-2.5">
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-12">
                  <input
                    type="text"
                    value={newSubjectName}
                    onChange={(e) => setNewSubjectName(e.target.value)}
                    placeholder="Tên môn mới (VD: AP Physics C, Tiếng Đức B2...)"
                    className="rounded border border-botanical-border bg-botanical-surface px-2.5 py-1 text-xs sm:col-span-6"
                  />
                  <select
                    value={newSubjectGroup}
                    onChange={(e) =>
                      setNewSubjectGroup(e.target.value as SubjectGroup)
                    }
                    className="rounded border border-botanical-border bg-botanical-surface px-2 py-1 text-xs sm:col-span-4"
                  >
                    <option value="STEM">Khối Tự nhiên</option>
                    <option value="LANGUAGE">Khối Ngôn ngữ</option>
                    <option value="SOCIAL">Khối Xã hội</option>
                  </select>
                  <button
                    type="button"
                    onClick={handleCreateCustomSubject}
                    className="rounded bg-botanical-sage px-2 py-1 text-xs font-semibold text-white sm:col-span-2"
                  >
                    Tạo
                  </button>
                </div>
              </div>
            )}

            {/* 1. Chọn Môn học & Chuyên đề */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-botanical-muted">
                  Môn học
                </label>
                <select
                  value={subjectId}
                  onChange={(e) => {
                    const nextId = e.target.value;
                    setSubjectId(nextId);
                    const sub = subjects.find((s) => s.id === nextId);
                    if (sub && sub.defaultTopics.length > 0) {
                      setTopic(sub.defaultTopics[0]);
                    }
                  }}
                  className="w-full rounded-md border border-botanical-border bg-botanical-canvas px-2.5 py-1.5 text-xs font-semibold text-botanical-ink focus:border-botanical-sage focus:outline-none"
                >
                  {subjects.map((sub) => (
                    <option key={sub.id} value={sub.id}>
                      [{sub.groupLabel}] {sub.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-botanical-muted">
                  Chuyên đề / Dạng bài
                </label>
                <input
                  type="text"
                  list="subject-topics-datalist"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="Chọn hoặc gõ chuyên đề..."
                  className="w-full rounded-md border border-botanical-border bg-botanical-canvas px-2.5 py-1.5 text-xs text-botanical-ink focus:border-botanical-sage focus:outline-none"
                />
                <datalist id="subject-topics-datalist">
                  {selectedSubject.defaultTopics.map((t) => (
                    <option key={t} value={t} />
                  ))}
                </datalist>
              </div>
            </div>

            {/* Thẻ bấm nhanh Chuyên đề của môn đang chọn */}
            <div className="flex flex-wrap gap-1.5">
              {selectedSubject.defaultTopics.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTopic(t)}
                  className={`rounded-md border px-2 py-0.5 text-[11px] font-medium transition ${
                    topic === t
                      ? 'border-botanical-sage bg-botanical-chipBg text-botanical-chipText'
                      : 'border-botanical-border bg-botanical-canvas text-botanical-muted hover:text-botanical-ink'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>

            {/* 2. Định dạng câu hỏi */}
            <div>
              <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-botanical-muted">
                Định dạng câu hỏi
              </label>
              <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
                {QUESTION_FORMATS.map((fmt) => {
                  const active = questionFormat === fmt.id;
                  return (
                    <button
                      key={fmt.id}
                      type="button"
                      onClick={() => setQuestionFormat(fmt.id)}
                      className={`rounded-md border px-2.5 py-1.5 text-left transition ${
                        active
                          ? 'border-botanical-sage bg-botanical-chipBg text-botanical-chipText shadow-sm'
                          : 'border-botanical-border bg-botanical-canvas text-botanical-ink hover:border-botanical-borderHover'
                      }`}
                    >
                      <div className="text-[11px] font-semibold leading-tight">
                        {fmt.label}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 3. Điểm gãy trong quy trình tư duy (Process Breakpoint) */}
            <div>
              <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-botanical-muted">
                Điểm gãy trong quy trình tư duy (Gãy ở đúng công đoạn nào?)
              </label>
              <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                {PROCESS_BREAKPOINTS.map((bp) => {
                  const active = processBreakpoint === bp.id;
                  return (
                    <button
                      key={bp.id}
                      type="button"
                      onClick={() => setProcessBreakpoint(bp.id)}
                      className={`flex flex-col justify-between rounded-md border p-2 text-left transition ${
                        active
                          ? 'border-botanical-sage bg-botanical-chipBg text-botanical-chipText ring-1 ring-botanical-sage/30'
                          : 'border-botanical-border bg-botanical-canvas text-botanical-ink hover:border-botanical-borderHover'
                      }`}
                    >
                      <div className="text-xs font-bold">{bp.title}</div>
                      <div className="mt-0.5 text-[11px] text-botanical-muted">
                        {bp.subtitle}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 4. Độ khó (1-5 sao) & Áp lực thời gian */}
            <div className="grid grid-cols-1 gap-3 rounded-lg border border-botanical-border bg-botanical-canvas p-2.5 sm:grid-cols-12">
              <div className="sm:col-span-5">
                <span className="block text-[11px] font-semibold uppercase tracking-wider text-botanical-muted">
                  Độ khó câu hỏi
                </span>
                <div className="mt-1 flex items-center gap-1">
                  {([1, 2, 3, 4, 5] as const).map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setDifficulty(star)}
                      className="p-0.5 transition hover:scale-110"
                    >
                      <Star
                        className={`h-4 w-4 ${
                          star <= difficulty
                            ? 'fill-botanical-ochre text-botanical-ochre'
                            : 'text-botanical-border'
                        }`}
                      />
                    </button>
                  ))}
                  <span className="ml-1 font-mono text-xs font-semibold text-botanical-ink">
                    {difficulty}/5
                  </span>
                </div>
              </div>

              <div className="sm:col-span-7">
                <span className="block text-[11px] font-semibold uppercase tracking-wider text-botanical-muted">
                  Áp lực thời gian lúc làm
                </span>
                <div className="mt-1 flex flex-wrap gap-1">
                  {TIME_PRESSURE_LEVELS.map((tp) => (
                    <button
                      key={tp.id}
                      type="button"
                      onClick={() => setTimePressure(tp.id)}
                      className={`rounded border px-2 py-0.5 text-[11px] font-medium transition ${
                        timePressure === tp.id
                          ? tp.badgeColor + ' font-semibold ring-1 ring-current'
                          : 'border-botanical-border bg-botanical-surface text-botanical-muted'
                      }`}
                    >
                      {tp.id === 'RELAXED'
                        ? 'Thong thả'
                        : tp.id === 'EXAM_PACE'
                        ? 'Đúng tốc độ thi'
                        : 'Hoảng loạn (<1p)'}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* 5. Ô nhập Đề bài, Bước làm sai & Lời giải chuẩn (hỗ trợ LaTeX & Code) */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-semibold uppercase tracking-wider text-botanical-muted">
                  Nội dung Đề bài & Biểu thức ($\LaTeX$ dùng $...$)
                </label>
                <button
                  type="button"
                  onClick={() => setShowLatexPreview((p) => !p)}
                  className="inline-flex items-center gap-1 text-[11px] font-medium text-botanical-eucalyptus hover:underline"
                >
                  <Eye className="h-3 w-3" />
                  {showLatexPreview ? 'Ẩn khung KaTeX' : 'Hiện khung KaTeX'}
                </button>
              </div>

              <textarea
                rows={2}
                value={questionText}
                onChange={(e) => setQuestionText(e.target.value)}
                placeholder="Gõ tóm tắt đề bài hoặc công thức LaTeX (VD: Tìm m để $y = \frac{mx+4}{x+m}$ nghịch biến...) hoặc dán ảnh ở dưới"
                className="w-full rounded-md border border-botanical-border bg-botanical-canvas p-2.5 text-xs text-botanical-ink focus:border-botanical-sage focus:outline-none"
              />

              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-[11px] font-semibold text-botanical-terracotta">
                    Bước biến đổi / Lựa chọn SAI của tôi:
                  </label>
                  <textarea
                    rows={2}
                    value={myWrongStep}
                    onChange={(e) => setMyWrongStep(e.target.value)}
                    placeholder="VD: Chỉ giải $y' < 0$ mà quên xét $-m \notin (-\infty; 1)$..."
                    className="w-full rounded-md border border-botanical-terracotta/50 bg-botanical-terracottaBg/40 p-2 text-xs text-botanical-ink focus:border-botanical-terracotta focus:outline-none"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-[11px] font-semibold text-botanical-matcha">
                    Lời giải chuẩn / Đáp án đúng:
                  </label>
                  <textarea
                    rows={2}
                    value={correctSolution}
                    onChange={(e) => setCorrectSolution(e.target.value)}
                    placeholder="VD: Kết hợp nghiệm mẫu $-m \ge 1 \Rightarrow -2 < m \le -1$..."
                    className="w-full rounded-md border border-botanical-matcha/50 bg-botanical-matchaBg/40 p-2 text-xs text-botanical-ink focus:border-botanical-matcha focus:outline-none"
                  />
                </div>
              </div>

              {/* Khung xem trước công thức KaTeX trực tiếp */}
              {showLatexPreview &&
                (questionText.trim() ||
                  myWrongStep.trim() ||
                  correctSolution.trim()) && (
                  <div className="rounded-md border border-botanical-border bg-botanical-mossMist/40 p-2.5 text-xs">
                    <div className="mb-1 font-mono text-[10px] font-bold uppercase text-botanical-eucalyptus">
                      Bản dịch Công thức KaTeX / Code trực tiếp:
                    </div>
                    {questionText && (
                      <div className="mb-1">
                        <span className="font-semibold">Đề: </span>
                        <MathText content={questionText} />
                      </div>
                    )}
                    {myWrongStep && (
                      <div className="mb-1 text-botanical-terracotta">
                        <span className="font-semibold">Bước sai: </span>
                        <MathText content={myWrongStep} />
                      </div>
                    )}
                    {correctSolution && (
                      <div className="text-botanical-matcha">
                        <span className="font-semibold">Chuẩn: </span>
                        <MathText content={correctSolution} />
                      </div>
                    )}
                  </div>
                )}
            </div>

            {/* 6. Hai Ô Dán Ảnh Chụp Màn Hình (Cmd+V) + Bút Đỏ Đất Nung */}
            <div className="space-y-2.5">
              <CanvasAnnotator
                slot="problem"
                title="Ô Ảnh 1: Đề bài & Bài làm bị sai của tôi"
                subtitle="Dán ảnh chụp màn hình đề/nháp và dùng Bút Đỏ Đất Nung khoanh đúng dòng bị sai"
                imageUrl={problemImageUrl}
                isActivePasteTarget={activePasteSlot === 'problem'}
                onSelectAsPasteTarget={() => setActivePasteSlot('problem')}
                onImageSaved={(url) => setProblemImageUrl(url)}
              />

              <CanvasAnnotator
                slot="solution"
                title="Ô Ảnh 2: Lời giải chuẩn / Đáp án đúng"
                subtitle="Dán ảnh lời giải mẫu của thầy cô hoặc bảng đáp án chi tiết"
                imageUrl={solutionImageUrl}
                isActivePasteTarget={activePasteSlot === 'solution'}
                onSelectAsPasteTarget={() => setActivePasteSlot('solution')}
                onImageSaved={(url) => setSolutionImageUrl(url)}
              />
            </div>
          </div>
        </div>

        {/* ==================== KHUNG 2: WHY (4/12 cột) ==================== */}
        <div className="botanical-paper-card flex flex-col justify-between rounded-xl p-4 xl:col-span-4">
          <div className="space-y-3.5">
            <div className="border-b border-botanical-border pb-2.5">
              <span className="inline-block rounded bg-botanical-terracotta px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-white">
                KHUNG 2 • WHY
              </span>
              <h3 className="mt-1 text-sm font-bold text-botanical-ink">
                Tại sao lại sai? (Từ điển Chẩn đoán Nguyên nhân gốc)
              </h3>
              <p className="text-[11px] text-botanical-muted">
                Chọn 1 hoặc nhiều nguyên nhân. Nhóm A sẽ được tính vào chỉ số{' '}
                <strong className="text-botanical-terracotta">&ldquo;Thuế Ẩu&rdquo;</strong>.
              </p>
            </div>

            {/* Render 4 nhóm A, B, C, D với bảng màu ngữ nghĩa chuẩn */}
            {(
              [
                'GROUP_A_CARELESS',
                'GROUP_B_KNOWLEDGE',
                'GROUP_C_TRAP',
                'GROUP_D_PSYCH',
              ] as const
            ).map((groupKey) => {
              const meta = WHY_GROUPS_META[groupKey];
              const groupItems = WHY_DICTIONARY.filter(
                (item) => item.group === groupKey
              );

              return (
                <div
                  key={groupKey}
                  className="rounded-lg border p-2.5"
                  style={{
                    backgroundColor: `${meta.bgLight}66`,
                    borderColor: `${meta.border}55`,
                  }}
                >
                  <div className="mb-1.5 flex items-center justify-between">
                    <span
                      className="text-xs font-bold"
                      style={{ color: meta.textMain }}
                    >
                      {meta.title}
                    </span>
                  </div>

                  <div className="space-y-1.5">
                    {groupItems.map((why) => {
                      const isSelected = whyCodes.includes(why.code);
                      return (
                        <button
                          key={why.code}
                          type="button"
                          onClick={() => toggleWhyCode(why.code)}
                          className={`group flex w-full items-start justify-between gap-2 rounded-md border px-2.5 py-1.5 text-left transition ${
                            isSelected
                              ? 'border-botanical-sage bg-botanical-chipBg text-botanical-chipText shadow-sm ring-1 ring-botanical-sage'
                              : 'border-botanical-border bg-botanical-surface text-botanical-ink hover:border-botanical-borderHover'
                          }`}
                        >
                          <div className="pr-1">
                            <div className="text-xs font-semibold leading-snug">
                              {why.title}
                            </div>
                            <div className="mt-0.5 text-[11px] leading-tight text-botanical-muted">
                              {why.description}
                            </div>
                          </div>

                          <kbd
                            className={`shrink-0 rounded border px-1.5 py-0.5 font-mono text-[10px] ${
                              isSelected
                                ? 'border-botanical-sage bg-botanical-sage text-white'
                                : 'border-botanical-border bg-botanical-canvas text-botanical-muted'
                            }`}
                            title={`Phím tắt chọn nhanh: ${why.shortcutKey.toUpperCase()}`}
                          >
                            {why.shortcutKey.toUpperCase()}
                          </kbd>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}

            {/* Ghi chú bổ sung chi tiết nguyên nhân */}
            <div>
              <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-botanical-muted">
                Ghi chú bối cảnh / cảm xúc lúc nhầm lẫn:
              </label>
              <textarea
                rows={2}
                value={whyCustomNotes}
                onChange={(e) => setWhyCustomNotes(e.target.value)}
                placeholder="VD: Lúc đó mắt nhìn nhầm dấu - thành dấu + ở dòng nháp thứ 3..."
                className="w-full rounded-md border border-botanical-border bg-botanical-canvas p-2 text-xs text-botanical-ink focus:border-botanical-sage focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* ==================== KHUNG 3: HOW (3/12 cột) ==================== */}
        <div className="botanical-paper-card flex flex-col justify-between rounded-xl p-4 xl:col-span-3">
          <div className="space-y-4">
            <div className="border-b border-botanical-border pb-2.5">
              <span className="inline-block rounded bg-botanical-matcha px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-white">
                KHUNG 3 • HOW
              </span>
              <h3 className="mt-1 text-sm font-bold text-botanical-ink">
                Phác đồ Hành động Chống Lặp Lại
              </h3>
              <p className="text-[11px] text-botanical-muted">
                Cấm ghi câu vô nghĩa như <em>&ldquo;Lần sau sẽ cẩn thận hơn&rdquo;</em>.
              </p>
            </div>

            {/* Kết quả Khám Nghiệm AI Trực Tiếp (nếu đã bấm nút AI) */}
            {aiAutopsy && (
              <div className="rounded-lg border border-botanical-terracotta/60 bg-botanical-terracottaBg/60 p-3 text-xs">
                <div className="mb-1.5 flex items-center justify-between">
                  <span className="inline-flex items-center gap-1 font-bold text-botanical-terracotta">
                    <Sparkles className="h-3.5 w-3.5" /> Chẩn đoán Nhận thức AI:
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setIfTrigger(aiAutopsy.quy_tac_neu_thi.neu_trigger);
                      setThenAction(aiAutopsy.quy_tac_neu_thi.thi_action);
                    }}
                    className="inline-flex items-center gap-1 rounded bg-botanical-sage px-2 py-0.5 text-[10px] font-semibold text-white hover:opacity-90"
                  >
                    <Wand2 className="h-3 w-3" /> Chèn vào ô NẾU-THÌ
                  </button>
                </div>
                <p className="mb-2 leading-relaxed text-botanical-ink">
                  {aiAutopsy.lo_hong_tu_duy}
                </p>
                <div className="space-y-1 rounded border border-botanical-border bg-botanical-surface p-2 text-[11px]">
                  <div className="text-botanical-terracotta">
                    <strong>Bước sai:</strong>{' '}
                    <MathText content={aiAutopsy.so_sanh_buoc_giai.buoc_sai_cua_ban} />
                  </div>
                  <div className="text-botanical-matcha">
                    <strong>Tư duy chuẩn:</strong>{' '}
                    <MathText content={aiAutopsy.so_sanh_buoc_giai.tu_duy_chuan_xac} />
                  </div>
                </div>
              </div>
            )}

            {/* 1. Quy tắc Phản xạ có điều kiện NẾU - THÌ */}
            <div className="space-y-3 rounded-lg border border-botanical-sage/40 bg-botanical-mossMist/50 p-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-botanical-sage">
                  Quy tắc Phản xạ &ldquo;NẾU — THÌ&rdquo;
                </span>
                <button
                  type="button"
                  onClick={() => {
                    const primary = WHY_DICTIONARY.find((w) =>
                      whyCodes.includes(w.code)
                    );
                    if (primary) {
                      setIfTrigger(primary.defaultIfTrigger);
                      setThenAction(primary.defaultThenAction);
                    }
                  }}
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-botanical-eucalyptus hover:underline"
                >
                  <Wand2 className="h-3 w-3" /> Gợi ý mẫu từ thẻ WHY
                </button>
              </div>

              <div>
                <label className="mb-1 block text-[11px] font-bold text-botanical-ochre">
                  NẾU (Khi mắt tôi nhìn thấy dấu hiệu này trong đề):
                </label>
                <textarea
                  rows={3}
                  value={ifTrigger}
                  onChange={(e) => setIfTrigger(e.target.value)}
                  placeholder="VD: Đề bài yêu cầu hàm phân thức đơn điệu trên khoảng (a; b) hoặc bài Listening Part 1 đọc đến mã bưu điện..."
                  className="w-full rounded-md border border-botanical-border bg-botanical-surface p-2 text-xs text-botanical-ink focus:border-botanical-sage focus:outline-none"
                />
              </div>

              <div>
                <label className="mb-1 block text-[11px] font-bold text-botanical-matcha">
                  THÌ (Thao tác tay/bút BẮT BUỘC phải làm ngay):
                </label>
                <textarea
                  rows={3}
                  value={thenAction}
                  onChange={(e) => setThenAction(e.target.value)}
                  placeholder="VD: Khoanh tròn 2 vòng từ khóa đó và viết điều kiện nghiệm mẫu x = -m không thuộc (a; b) ở dòng đầu tiên trước khi tính đạo hàm."
                  className="w-full rounded-md border border-botanical-border bg-botanical-surface p-2 text-xs text-botanical-ink focus:border-botanical-sage focus:outline-none"
                />
              </div>
            </div>

            {/* 2. Danh sách Hành động Khắc phục [H1] -> [H5] */}
            <div>
              <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-botanical-muted">
                Chế độ Hậu kiểm & Phục thù (Actionable Protocols)
              </label>
              <div className="space-y-1.5">
                {HOW_ACTIONS_DICTIONARY.map((act) => {
                  const active = howActions.includes(act.code);
                  return (
                    <button
                      key={act.code}
                      type="button"
                      onClick={() => toggleHowAction(act.code)}
                      className={`flex w-full items-start gap-2 rounded-md border p-2 text-left transition ${
                        active
                          ? 'border-botanical-matcha bg-botanical-matchaBg text-botanical-ink shadow-sm'
                          : 'border-botanical-border bg-botanical-canvas text-botanical-muted hover:text-botanical-ink'
                      }`}
                    >
                      <CheckCircle2
                        className={`mt-0.5 h-4 w-4 shrink-0 ${
                          active ? 'text-botanical-matcha' : 'text-botanical-border'
                        }`}
                      />
                      <div>
                        <div className="text-xs font-semibold leading-snug">
                          {act.label}
                        </div>
                        <div className="mt-0.5 text-[10px] leading-tight opacity-80">
                          {act.description}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Nút Lưu & Sinh ngay 2 Bài Tập Sinh Đôi để Phục Thù */}
            <div className="space-y-2 pt-2">
              <button
                type="button"
                onClick={() => void handleSaveRecord(true)}
                disabled={isSaving}
                className="flex w-full items-center justify-center gap-2 rounded-lg border border-botanical-sage bg-botanical-chipBg px-3 py-2.5 text-xs font-bold text-botanical-chipText shadow-sm transition hover:bg-botanical-sage hover:text-white"
              >
                <ShieldAlert className="h-4 w-4" />
                Lưu & Đẻ ngay 2 &ldquo;Bài Tập Sinh Đôi&rdquo; Giải Phục Thù
              </button>

              <button
                type="button"
                onClick={() => void handleSaveRecord(false)}
                disabled={isSaving}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-botanical-sage px-3 py-2.5 text-xs font-bold text-white shadow-sm transition hover:opacity-95"
              >
                <Save className="h-4 w-4" />
                {isSaving ? 'Đang lưu vào SQLite...' : 'Lưu Bản Ghi Lỗi Sai (Cmd+Enter)'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Bộ quản lý Link Đề thi, Sách/PDF & Mốc thời gian YouTube (?t=150s) */}
      <ReferenceLocator references={references} onChange={setReferences} />
    </div>
  );
}