// File: src/types/error-log.ts

export type SubjectGroup = 'STEM' | 'LANGUAGE' | 'SOCIAL';

export type QuestionFormat =
  | 'MCQ_4'          // Trắc nghiệm 4 lựa chọn
  | 'TRUE_FALSE_SET' // Trắc nghiệm Đúng/Sai nhiều ý
  | 'GRID_IN'        // Điền đáp án ngắn (Grid-in / Fill-in-the-blank)
  | 'DERIVATION'     // Tự luận biến đổi
  | 'ESSAY'          // Viết luận (Essay)
  | 'AUDIO_ORAL';    // Phản xạ Nghe/Nói

export type ProcessBreakpoint =
  | 'STAGE_1_DECODE'    // Giai đoạn 1: Giải mã đề bài
  | 'STAGE_2_RETRIEVE'  // Giai đoạn 2: Truy xuất kiến thức & Lập hướng giải
  | 'STAGE_3_EXECUTE'   // Giai đoạn 3: Thực thi & Biến đổi
  | 'STAGE_4_VERIFY';   // Giai đoạn 4: Kiểm tra & Kết luận

export type TimePressureLevel =
  | 'RELAXED'     // Thong thả
  | 'EXAM_PACE'   // Đúng tốc độ thi
  | 'PANIC';      // Hoảng loạn / Cạn giờ (dưới 1 phút cuối)

export type WhyCategoryGroup =
  | 'GROUP_A_CARELESS'   // Nhóm A: Lỗi Ẩu & Thao tác cơ học ("Thuế Ẩu")
  | 'GROUP_B_KNOWLEDGE'  // Nhóm B: Hổng kiến thức & Ngộ nhận bản chất
  | 'GROUP_C_TRAP'       // Nhóm C: Sập bẫy đề thi & Lỗi chiến thuật
  | 'GROUP_D_PSYCH';     // Nhóm D: Tâm lý & Thể trạng

export type WhyCode =
  | 'A1' | 'A2' | 'A3' | 'A4' | 'A5' | 'A6' | 'A7'
  | 'B1' | 'B2' | 'B3' | 'B4' | 'B5'
  | 'C1' | 'C2' | 'C3' | 'C4' | 'C5'
  | 'D1' | 'D2' | 'D3';

export type HowActionCode = 'H1' | 'H2' | 'H3' | 'H4' | 'H5';

export interface ReferenceItem {
  id: string;
  type: 'URL' | 'YOUTUBE' | 'BOOK_PDF';
  title: string;
  url?: string;
  youtubeTimestampSec?: number; // Mốc giây ?t=150s
  bookName?: string;
  pageNumber?: string;
  questionNumber?: string;
}

export interface TwinQuestion {
  id: string;
  title: string;
  promptLatex: string;
  options?: string[];
  correctAnswer: string;
  trapWarning: string;
  stepByStepSolution: string;
  userAttempt?: string;
  isSolved?: boolean;
}

export interface AiForensicResult {
  lo_hong_tu_duy: string;
  so_sanh_buoc_giai: {
    buoc_sai_cua_ban: string;
    tu_duy_chuan_xac: string;
  };
  quy_tac_neu_thi: {
    neu_trigger: string;
    thi_action: string;
  };
  generatedAt: string;
}

export interface ErrorLogItem {
  id: string;
  createdAt: string;
  updatedAt: string;

  // KHUNG 1: WHAT
  subjectId: string;
  subjectName: string;
  subjectGroup: SubjectGroup;
  topic: string;
  questionFormat: QuestionFormat;
  processBreakpoint: ProcessBreakpoint;
  difficulty: 1 | 2 | 3 | 4 | 5;
  timePressure: TimePressureLevel;
  questionText: string;
  myWrongStep: string;
  correctSolution: string;

  // ĐA PHƯƠNG TIỆN (Ảnh dán Cmd+V đã gộp lớp vẽ Bút Đỏ Đất Nung + Link định vị)
  problemImageUrl?: string;
  solutionImageUrl?: string;
  references: ReferenceItem[];

  // KHUNG 2: WHY
  whyCodes: WhyCode[];
  whyCustomNotes: string;

  // KHUNG 3: HOW
  ifTrigger: string;
  thenAction: string;
  howActions: HowActionCode[];
  inPreExamChecklist: boolean;

  // AI FORENSIC & TWIN PROBLEMS
  aiAutopsy?: AiForensicResult;
  twinQuestions: TwinQuestion[];

  // SPACED REPETITION (Leitner Box 1 -> 5)
  leitnerBox: 1 | 2 | 3 | 4 | 5;
  nextReviewDate: string; // YYYY-MM-DD
  reviewCount: number;
  isResolved: boolean;
}

export interface DashboardAnalytics {
  totalLogs: number;
  resolvedCount: number;
  dueTodayCount: number;
  carelessTaxPercent: number; // Tỷ lệ % lỗi có dính Nhóm A
  subjectCarelessBreakdown: {
    subjectName: string;
    total: number;
    carelessCount: number;
    knowledgeCount: number;
    trapCount: number;
    carelessPercent: number;
  }[];
  paretoWhyDistribution: {
    code: WhyCode;
    label: string;
    group: WhyCategoryGroup;
    count: number;
    percentage: number;
    cumulativePercentage: number;
  }[];
  breakpointFunnel: {
    stage: ProcessBreakpoint;
    label: string;
    count: number;
    percentage: number;
  }[];
}