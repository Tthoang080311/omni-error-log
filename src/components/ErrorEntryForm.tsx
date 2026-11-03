// File: src/components/ErrorEntryForm.tsx
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch';
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
  X,
  FolderKanban,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  PenTool,
  Search,
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

const LOCAL_SUBJECTS_STORAGE_KEY = 'OMNI_SUBJECTS_AND_TOPICS_V2';
const LOCAL_SOURCES_STORAGE_KEY = 'OMNI_CUSTOM_SOURCES_LIST_V1';
const SOURCE_REF_PREFIX = '[NGUỒN]: ';

function extractSourceFromItem(item?: ErrorLogItem | null): string {
  if (!item) return '';
  const anyItem = item as Record<string, unknown>;
  if (typeof anyItem.sourceName === 'string' && anyItem.sourceName.trim()) {
    return anyItem.sourceName.trim();
  }
  const refs = Array.isArray(item.references) ? item.references : [];
  const tagged = refs.find(
    (r) => typeof r?.title === 'string' && r.title.startsWith(SOURCE_REF_PREFIX)
  );
  if (tagged) {
    return tagged.title.slice(SOURCE_REF_PREFIX.length).trim();
  }
  return '';
}

export default function ErrorEntryForm({
  editingItem,
  customApiKey,
  onSaveSuccess,
  onCancelEdit,
}: ErrorEntryFormProps) {
  // 1. Danh sách môn học & chuyên đề nhỏ (Lưu bền vững trong localStorage, cho phép tự thêm / tự xoá)
  const [subjects, setSubjects] = useState<SubjectDefinition[]>(INITIAL_SUBJECTS);
  const [showAddSubject, setShowAddSubject] = useState(false);
  const [newSubjectName, setNewSubjectName] = useState('');
  const [newSubjectGroup, setNewSubjectGroup] = useState<SubjectGroup>('STEM');

  // 2. Danh sách Nguồn đề / Bộ đề (Cho phép tự thêm / tự xoá ngay trong Khung 1)
  const [savedSources, setSavedSources] = useState<string[]>([
    'Bluebook Practice Test',
    'Cambridge IELTS',
    'Đề Thi Thử Sở / Trường',
  ]);
  const [sourceName, setSourceName] = useState<string>('');

  // KHUNG 1: WHAT
  const [subjectId, setSubjectId] = useState<string>(
    INITIAL_SUBJECTS[0]?.id || 'math-thpt'
  );
  const [topic, setTopic] = useState<string>(
    INITIAL_SUBJECTS[0]?.defaultTopics?.[0] || 'Hàm số & Đạo hàm'
  );
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

  // ĐA PHƯƠNG TIỆN & CHẾ ĐỘ ZOOM ẢNH ĐỀ BÀI TRONG FORM
  const [problemImageUrl, setProblemImageUrl] = useState<string | undefined>(
    undefined
  );
  const [solutionImageUrl, setSolutionImageUrl] = useState<string | undefined>(
    undefined
  );
  const [activePasteSlot, setActivePasteSlot] = useState<'problem' | 'solution'>(
    'problem'
  );
  const [imageInspectMode, setImageInspectMode] = useState<
    'ANNOTATE' | 'ZOOM'
  >('ANNOTATE');
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

  // Khôi phục danh sách Môn học + Chuyên đề nhỏ + Nguồn đề đã lưu từ localStorage
  useEffect(() => {
    try {
      const rawSubs = window.localStorage.getItem(LOCAL_SUBJECTS_STORAGE_KEY);
      if (rawSubs) {
        const parsedSubs = JSON.parse(rawSubs);
        if (Array.isArray(parsedSubs) && parsedSubs.length > 0) {
          setSubjects(parsedSubs);
        }
      }
      const rawSources = window.localStorage.getItem(LOCAL_SOURCES_STORAGE_KEY);
      if (rawSources) {
        const parsedSources = JSON.parse(rawSources);
        if (Array.isArray(parsedSources)) {
          setSavedSources(parsedSources);
        }
      }
    } catch {
      // Bỏ qua nếu lỗi parse
    }
  }, []);

  const persistSubjectsToStorage = useCallback(
    (nextSubjects: SubjectDefinition[]) => {
      setSubjects(nextSubjects);
      try {
        window.localStorage.setItem(
          LOCAL_SUBJECTS_STORAGE_KEY,
          JSON.stringify(nextSubjects)
        );
      } catch {
        // Bỏ qua
      }
    },
    []
  );

  const persistSourcesToStorage = useCallback((nextSources: string[]) => {
    setSavedSources(nextSources);
    try {
      window.localStorage.setItem(
        LOCAL_SOURCES_STORAGE_KEY,
        JSON.stringify(nextSources)
      );
    } catch {
      // Bỏ qua
    }
  }, []);

  const selectedSubject =
    subjects.find((s) => s.id === subjectId) || subjects[0];

  // Nạp dữ liệu khi chỉnh sửa một bản ghi có sẵn
  useEffect(() => {
    if (!editingItem) return;
    setSubjectId(editingItem.subjectId);
    setTopic(editingItem.topic);
    setSourceName(extractSourceFromItem(editingItem));
    setQuestionFormat(editingItem.questionFormat);
    setProcessBreakpoint(editingItem.processBreakpoint);
    setDifficulty(editingItem.difficulty);
    setTimePressure(editingItem.timePressure);
    setQuestionText(editingItem.questionText);
    setMyWrongStep(editingItem.myWrongStep);
    setCorrectSolution(editingItem.correctSolution);
    setProblemImageUrl(editingItem.problemImageUrl);
    setSolutionImageUrl(editingItem.solutionImageUrl);
    setReferences(
      (editingItem.references || []).filter(
        (r) =>
          !(typeof r?.title === 'string' && r.title.startsWith(SOURCE_REF_PREFIX))
      )
    );
    setWhyCodes(editingItem.whyCodes);
    setWhyCustomNotes(editingItem.whyCustomNotes);
    setIfTrigger(editingItem.ifTrigger);
    setThenAction(editingItem.thenAction);
    setHowActions(editingItem.howActions);
    setAiAutopsy(editingItem.aiAutopsy);
    setTwinQuestions(editingItem.twinQuestions || []);
  }, [editingItem]);

  // --- HÀM TỰ GHI / TỰ XOÁ CHUYÊN ĐỀ NHỎ TRỰC TIẾP TRONG KHUNG 1 ---
  const handleSaveCurrentTopicToChips = useCallback(() => {
    const cleanTopic = topic.trim();
    if (!cleanTopic) return;
    const nextSubjects = subjects.map((sub) => {
      if (sub.id !== selectedSubject.id) return sub;
      const exists = sub.defaultTopics.includes(cleanTopic);
      if (exists) return sub;
      return {
        ...sub,
        defaultTopics: [cleanTopic, ...sub.defaultTopics],
      };
    });
    persistSubjectsToStorage(nextSubjects);
  }, [persistSubjectsToStorage, selectedSubject.id, subjects, topic]);

  const handleDeleteTopicChip = useCallback(
    (topicToDelete: string) => {
      const nextSubjects = subjects.map((sub) => {
        if (sub.id !== selectedSubject.id) return sub;
        const filtered = sub.defaultTopics.filter((t) => t !== topicToDelete);
        return {
          ...sub,
          defaultTopics: filtered,
        };
      });
      persistSubjectsToStorage(nextSubjects);
      if (topic === topicToDelete) {
        const remaining =
          nextSubjects.find((s) => s.id === selectedSubject.id)
            ?.defaultTopics || [];
        setTopic(remaining[0] || '');
      }
    },
    [persistSubjectsToStorage, selectedSubject.id, subjects, topic]
  );

  // --- HÀM TỰ GHI / TỰ XOÁ NGUỒN ĐỀ TRỰC TIẾP TRONG KHUNG 1 ---
  const handleSaveCurrentSourceToChips = useCallback(() => {
    const cleanSource = sourceName.trim();
    if (!cleanSource) return;
    if (!savedSources.includes(cleanSource)) {
      persistSourcesToStorage([cleanSource, ...savedSources]);
    }
  }, [persistSourcesToStorage, savedSources, sourceName]);

  const handleDeleteSourceChip = useCallback(
    (sourceToDelete: string) => {
      const next = savedSources.filter((s) => s !== sourceToDelete);
      persistSourcesToStorage(next);
      if (sourceName === sourceToDelete) {
        setSourceName('');
      }
    },
    [persistSourcesToStorage, savedSources, sourceName]
  );

  // Chọn hoặc bỏ chọn mã lỗi WHY
  const toggleWhyCode = useCallback((code: WhyCode) => {
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
  }, []);

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
      defaultTopics: ['Chuyên đề 1', 'Chuyên đề 2'],
    };

    const nextSubjects = [...subjects, newSub];
    persistSubjectsToStorage(nextSubjects);
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

      // Tự động lưu Chuyên đề nhỏ & Nguồn đề mới vào danh sách chip nếu chưa có
      const cleanTopic = topic.trim() || 'Chuyên đề chung';
      const cleanSource = sourceName.trim();

      if (cleanTopic && !selectedSubject.defaultTopics.includes(cleanTopic)) {
        const nextSubjects = subjects.map((sub) =>
          sub.id === selectedSubject.id
            ? { ...sub, defaultTopics: [cleanTopic, ...sub.defaultTopics] }
            : sub
        );
        persistSubjectsToStorage(nextSubjects);
      }

      if (cleanSource && !savedSources.includes(cleanSource)) {
        persistSourcesToStorage([cleanSource, ...savedSources]);
      }

      // Đóng gói Nguồn đề vào references để đồng bộ 100% với SQLite & Supabase
      const cleanUserRefs = references.filter(
        (r) =>
          !(typeof r?.title === 'string' && r.title.startsWith(SOURCE_REF_PREFIX))
      );
      const finalReferences: ReferenceItem[] = cleanSource
        ? [
            {
              id: `src_${Date.now()}`,
              title: `${SOURCE_REF_PREFIX}${cleanSource}`,
              type: 'BOOK',
            },
            ...cleanUserRefs,
          ]
        : cleanUserRefs;

      setIsSaving(true);
      try {
        const payload = {
          id: editingItem?.id,
          createdAt: editingItem?.createdAt,
          subjectId: selectedSubject.id,
          subjectName: selectedSubject.name,
          subjectGroup: selectedSubject.group,
          topic: cleanTopic,
          sourceName: cleanSource,
          questionFormat,
          processBreakpoint,
          difficulty,
          timePressure,
          questionText,
          myWrongStep,
          correctSolution,
          problemImageUrl,
          solutionImageUrl,
          references: finalReferences,
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
            {
              ...data.item,
              topic: cleanTopic,
              sourceName: cleanSource,
              references: finalReferences,
            },
            triggerTwinModalAfter || howActions.includes('H3')
          );

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
      topic,
      sourceName,
      selectedSubject,
      subjects,
      persistSubjectsToStorage,
      savedSources,
      persistSourcesToStorage,
      references,
      editingItem,
      questionFormat,
      processBreakpoint,
      difficulty,
      timePressure,
      myWrongStep,
      correctSolution,
      solutionImageUrl,
      whyCodes,
      whyCustomNotes,
      howActions,
      aiAutopsy,
      twinQuestions,
      onSaveSuccess,
    ]
  );

  // Phím tắt toàn cục trong Form
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
      {/* Thanh trạng thái trên cùng của Trạm Nhập Lỗi (Flat 2D) */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-botanical-border bg-botanical-surface px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-botanical-sage bg-botanical-sage text-white">
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
            className="inline-flex items-center gap-1.5 rounded-lg border border-botanical-sage bg-botanical-sage px-4 py-1.5 text-xs font-semibold text-white transition hover:opacity-95 disabled:opacity-50"
          >
            <Save className="h-3.5 w-3.5" />
            {isSaving ? 'Đang lưu...' : 'Lưu vào Sổ Tay Nhận Thức (Cmd+Enter)'}
          </button>
        </div>
      </div>

      {validationError && (
        <div className="flex items-center gap-2 rounded-lg border border-botanical-terracotta bg-botanical-terracottaBg px-4 py-2.5 text-xs font-medium text-botanical-terracotta">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>{validationError}</span>
        </div>
      )}

      {/* BỐ CỤC 3 CỘT TRỤ CỘT: WHAT - WHY - HOW */}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
        {/* ==================== KHUNG 1: WHAT (5/12 cột) ==================== */}
        <div className="botanical-paper-card flex flex-col justify-between rounded-xl border border-botanical-border bg-botanical-surface p-4 xl:col-span-5">
          <div className="space-y-4">
            {/* Tiêu đề Khung 1 */}
            <div className="flex items-center justify-between border-b border-botanical-border pb-2.5">
              <div>
                <span className="inline-block rounded bg-botanical-sage px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-white">
                  KHUNG 1 • WHAT
                </span>
                <h3 className="mt-1 text-sm font-bold text-botanical-ink">
                  Sai cái gì? Ở môn nào? Thuộc nguồn đề nào?
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

            {showAddSubject && (
              <div className="rounded-lg border border-botanical-border bg-botanical-mossMist/60 p-2.5">
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-12">
                  <input
                    type="text"
                    value={newSubjectName}
                    onChange={(e) => setNewSubjectName(e.target.value)}
                    placeholder="Tên môn mới (VD: AP Physics C, Tiếng Pháp...)"
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

            {/* 1A. CHỌN MÔN HỌC & TỰ GHI / TỰ XOÁ CHUYÊN ĐỀ NHỎ */}
            <div className="space-y-2.5 rounded-lg border border-botanical-border bg-botanical-canvas p-3">
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-12">
                <div className="sm:col-span-5">
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
                      } else {
                        setTopic('');
                      }
                    }}
                    className="w-full rounded-md border border-botanical-border bg-botanical-surface px-2.5 py-1.5 text-xs font-semibold text-botanical-ink focus:border-botanical-sage focus:outline-none"
                  >
                    {subjects.map((sub) => (
                      <option key={sub.id} value={sub.id}>
                        [{sub.groupLabel}] {sub.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="sm:col-span-7">
                  <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-botanical-muted">
                    Chuyên đề nhỏ (Tự gõ rồi bấm + để lưu tag)
                  </label>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="text"
                      value={topic}
                      onChange={(e) => setTopic(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleSaveCurrentTopicToChips();
                        }
                      }}
                      placeholder="Tự gõ tên chuyên đề nhỏ..."
                      className="flex-1 rounded-md border border-botanical-border bg-botanical-surface px-2.5 py-1.5 text-xs font-semibold text-botanical-ink focus:border-botanical-sage focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={handleSaveCurrentTopicToChips}
                      title="Lưu chuyên đề đang gõ vào danh sách bấm nhanh bên dưới"
                      className="inline-flex shrink-0 items-center gap-1 rounded-md border border-botanical-sage bg-botanical-sage px-2.5 py-1.5 text-xs font-bold text-white hover:opacity-90"
                    >
                      <Plus className="h-3.5 w-3.5" /> Lưu
                    </button>
                  </div>
                </div>
              </div>

              {/* Danh sách Chip Chuyên đề nhỏ: Bấm chữ để chọn, bấm × để xoá */}
              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                {selectedSubject.defaultTopics.length === 0 ? (
                  <span className="text-[11px] italic text-botanical-muted">
                    Môn này chưa có chuyên đề nào. Hãy gõ vào ô trên rồi bấm &ldquo;+ Lưu&rdquo;.
                  </span>
                ) : (
                  selectedSubject.defaultTopics.map((t) => {
                    const isSelected = topic === t;
                    return (
                      <div
                        key={t}
                        className={`inline-flex items-center rounded-md border text-[11px] font-medium transition ${
                          isSelected
                            ? 'border-botanical-sage bg-botanical-sage text-white'
                            : 'border-botanical-border bg-botanical-surface text-botanical-ink hover:border-botanical-sage'
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => setTopic(t)}
                          className="px-2 py-0.5 font-semibold"
                        >
                          {t}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteTopicChip(t)}
                          title={`Xoá chuyên đề "${t}"`}
                          className={`border-l px-1.5 py-0.5 ${
                            isSelected
                              ? 'border-white/30 text-white hover:bg-botanical-terracotta'
                              : 'border-botanical-border text-botanical-muted hover:text-botanical-terracotta'
                          }`}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* 1B. NGUỒN ĐỀ / BỘ ĐỀ (ĐỂ GHÉP CÁC CÂU CÙNG NGUỒN THÀNH 1 KHU) */}
            <div className="space-y-2 rounded-lg border border-botanical-border bg-botanical-canvas p-3">
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-botanical-sage">
                  <FolderKanban className="h-3.5 w-3.5" />
                  Nguồn đề / Bộ đề (Tự động gom các câu cùng nguồn thành 1 khu)
                </label>
              </div>

              <div className="flex items-center gap-1.5">
                <input
                  type="text"
                  value={sourceName}
                  onChange={(e) => setSourceName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleSaveCurrentSourceToChips();
                    }
                  }}
                  placeholder="Gõ tên đề (VD: Bluebook Test 5, Cam 19 Test 2, Đề Lý Sở HN)..."
                  className="flex-1 rounded-md border border-botanical-border bg-botanical-surface px-2.5 py-1.5 text-xs font-semibold text-botanical-ink focus:border-botanical-sage focus:outline-none"
                />
                <button
                  type="button"
                  onClick={handleSaveCurrentSourceToChips}
                  className="inline-flex shrink-0 items-center gap-1 rounded-md border border-botanical-terracotta bg-botanical-terracotta px-2.5 py-1.5 text-xs font-bold text-white"
                >
                  <Plus className="h-3.5 w-3.5" /> Lưu Nguồn
                </button>
              </div>

              {/* Danh sách Chip Nguồn đề: Bấm để chọn, bấm × để xoá */}
              {savedSources.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                  {savedSources.map((src) => {
                    const isSelected = sourceName === src;
                    return (
                      <div
                        key={src}
                        className={`inline-flex items-center rounded-md border text-[11px] font-medium transition ${
                          isSelected
                            ? 'border-botanical-terracotta bg-botanical-terracotta text-white'
                            : 'border-botanical-border bg-botanical-surface text-botanical-ink hover:border-botanical-terracotta'
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() =>
                            setSourceName((prev) => (prev === src ? '' : src))
                          }
                          className="px-2 py-0.5 font-semibold"
                        >
                          📚 {src}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteSourceChip(src)}
                          title={`Xoá nguồn "${src}"`}
                          className={`border-l px-1.5 py-0.5 ${
                            isSelected
                              ? 'border-white/30 text-white'
                              : 'border-botanical-border text-botanical-muted hover:text-botanical-terracotta'
                          }`}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
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
                          ? 'border-botanical-sage bg-botanical-chipBg text-botanical-chipText'
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

            {/* 3. Điểm gãy trong quy trình tư duy */}
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
                          ? 'border-botanical-sage bg-botanical-chipBg text-botanical-chipText'
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
                      className="p-0.5 transition"
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
                          ? tp.badgeColor + ' font-semibold'
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

            {/* 5. Ô nhập Đề bài, Bước làm sai & Lời giải chuẩn */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-semibold uppercase tracking-wider text-botanical-muted">
                  Nội dung Đề bài &amp; Biểu thức ($\LaTeX$ dùng $...$)
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

            {/* 6. Hai Ô Dán Ảnh Chụp Màn Hình (Cmd+V) + Chuyển Đổi Bút Đỏ / Zoom Soi Đề */}
            <div className="space-y-2.5">
              {(problemImageUrl || solutionImageUrl) && (
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-botanical-border bg-botanical-canvas px-3 py-1.5 text-xs">
                  <span className="font-mono text-[10px] font-bold uppercase text-botanical-sage">
                    Chế độ tương tác ảnh trong Form:
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setImageInspectMode('ANNOTATE')}
                      className={`inline-flex items-center gap-1 rounded border px-2 py-0.5 text-[11px] font-bold ${
                        imageInspectMode === 'ANNOTATE'
                          ? 'border-botanical-terracotta bg-botanical-terracotta text-white'
                          : 'border-botanical-border bg-botanical-surface text-botanical-ink'
                      }`}
                    >
                      <PenTool className="h-3 w-3" /> Khoanh Bút Đỏ
                    </button>
                    <button
                      type="button"
                      onClick={() => setImageInspectMode('ZOOM')}
                      className={`inline-flex items-center gap-1 rounded border px-2 py-0.5 text-[11px] font-bold ${
                        imageInspectMode === 'ZOOM'
                          ? 'border-botanical-sage bg-botanical-sage text-white'
                          : 'border-botanical-border bg-botanical-surface text-botanical-ink'
                      }`}
                    >
                      <Search className="h-3 w-3" /> Zoom In / Out Đề Bài
                    </button>
                  </div>
                </div>
              )}

              {imageInspectMode === 'ZOOM' &&
              (problemImageUrl || solutionImageUrl) ? (
                <div className="space-y-2.5">
                  {[
                    {
                      label: 'Ô Ảnh 1 (Đề bài): Cuộn chuột để Zoom In / Out',
                      url: problemImageUrl,
                    },
                    {
                      label: 'Ô Ảnh 2 (Lời giải): Cuộn chuột để Zoom In / Out',
                      url: solutionImageUrl,
                    },
                  ]
                    .filter((slotItem) => Boolean(slotItem.url))
                    .map((slotItem) => (
                      <div
                        key={slotItem.label}
                        className="rounded-lg border border-botanical-border bg-botanical-canvas p-2.5"
                      >
                        <TransformWrapper
                          initialScale={1}
                          minScale={0.5}
                          maxScale={5}
                          wheel={{ step: 0.15 }}
                        >
                          {({ zoomIn, zoomOut, resetTransform }) => (
                            <>
                              <div className="mb-1.5 flex items-center justify-between border-b border-botanical-border pb-1">
                                <span className="font-mono text-[10px] font-bold text-botanical-sage">
                                  {slotItem.label}
                                </span>
                                <div className="flex items-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() => zoomIn(0.3)}
                                    className="rounded border border-botanical-border bg-botanical-surface px-1.5 py-0.5 font-mono text-[10px] font-bold"
                                  >
                                    <ZoomIn className="inline h-3 w-3" /> +
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => zoomOut(0.3)}
                                    className="rounded border border-botanical-border bg-botanical-surface px-1.5 py-0.5 font-mono text-[10px] font-bold"
                                  >
                                    <ZoomOut className="inline h-3 w-3" /> -
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => resetTransform()}
                                    className="rounded border border-botanical-border bg-botanical-surface px-1.5 py-0.5 font-mono text-[10px] font-bold"
                                  >
                                    <RotateCcw className="inline h-3 w-3" /> 100%
                                  </button>
                                </div>
                              </div>
                              <div className="overflow-hidden rounded border border-botanical-border bg-botanical-surface">
                                <TransformComponent
                                  wrapperClass="!w-full !max-h-[340px] cursor-grab active:cursor-grabbing"
                                  contentClass="!w-full flex justify-center"
                                >
                                  <img
                                    src={slotItem.url}
                                    alt={slotItem.label}
                                    className="max-h-[320px] w-auto object-contain select-none p-1"
                                  />
                                </TransformComponent>
                              </div>
                            </>
                          )}
                        </TransformWrapper>
                      </div>
                    ))}
                </div>
              ) : (
                <>
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
                </>
              )}
            </div>
          </div>
        </div>

        {/* ==================== KHUNG 2: WHY (4/12 cột) ==================== */}
        <div className="botanical-paper-card flex flex-col justify-between rounded-xl border border-botanical-border bg-botanical-surface p-4 xl:col-span-4">
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
                <strong className="text-botanical-terracotta">
                  &ldquo;Thuế Ẩu&rdquo;
                </strong>
                .
              </p>
            </div>

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
                              ? 'border-botanical-sage bg-botanical-chipBg text-botanical-chipText'
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
        <div className="botanical-paper-card flex flex-col justify-between rounded-xl border border-botanical-border bg-botanical-surface p-4 xl:col-span-3">
          <div className="space-y-4">
            <div className="border-b border-botanical-border pb-2.5">
              <span className="inline-block rounded bg-botanical-matcha px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-white">
                KHUNG 3 • HOW
              </span>
              <h3 className="mt-1 text-sm font-bold text-botanical-ink">
                Phác đồ Hành động Chống Lặp Lại
              </h3>
              <p className="text-[11px] text-botanical-muted">
                Cấm ghi câu vô nghĩa như{' '}
                <em>&ldquo;Lần sau sẽ cẩn thận hơn&rdquo;</em>.
              </p>
            </div>

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
                    <MathText
                      content={aiAutopsy.so_sanh_buoc_giai.buoc_sai_cua_ban}
                    />
                  </div>
                  <div className="text-botanical-matcha">
                    <strong>Tư duy chuẩn:</strong>{' '}
                    <MathText
                      content={aiAutopsy.so_sanh_buoc_giai.tu_duy_chuan_xac}
                    />
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
                Chế độ Hậu kiểm &amp; Phục thù (Actionable Protocols)
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
                          ? 'border-botanical-matcha bg-botanical-matchaBg text-botanical-ink'
                          : 'border-botanical-border bg-botanical-canvas text-botanical-muted hover:text-botanical-ink'
                      }`}
                    >
                      <CheckCircle2
                        className={`mt-0.5 h-4 w-4 shrink-0 ${
                          active
                            ? 'text-botanical-matcha'
                            : 'text-botanical-border'
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

            {/* Nút Lưu & Sinh ngay 2 Bài Tập Sinh Đôi */}
            <div className="space-y-2 pt-2">
              <button
                type="button"
                onClick={() => void handleSaveRecord(true)}
                disabled={isSaving}
                className="flex w-full items-center justify-center gap-2 rounded-lg border border-botanical-sage bg-botanical-chipBg px-3 py-2.5 text-xs font-bold text-botanical-chipText transition hover:bg-botanical-sage hover:text-white"
              >
                <ShieldAlert className="h-4 w-4" />
                Lưu &amp; Đẻ ngay 2 &ldquo;Bài Tập Sinh Đôi&rdquo; Giải Phục Thù
              </button>

              <button
                type="button"
                onClick={() => void handleSaveRecord(false)}
                disabled={isSaving}
                className="flex w-full items-center justify-center gap-2 rounded-lg border border-botanical-sage bg-botanical-sage px-3 py-2.5 text-xs font-bold text-white transition hover:opacity-95"
              >
                <Save className="h-4 w-4" />
                {isSaving
                  ? 'Đang lưu vào SQLite...'
                  : 'Lưu Bản Ghi Lỗi Sai (Cmd+Enter)'}
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
