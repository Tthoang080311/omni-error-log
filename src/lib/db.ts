import path from 'path';
import fs from 'fs';
import {
  ErrorLogItem,
  DashboardAnalytics,
  WhyCode,
  ProcessBreakpoint,
} from '@/types/error-log';
import {
  WHY_DICTIONARY,
  PROCESS_BREAKPOINTS,
  LEITNER_INTERVAL_DAYS,
} from '@/constants/taxonomy';

function getStorageFilePath(): string {
  const isVercel = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
  const baseDir = isVercel ? '/tmp' : path.join(process.cwd(), 'data');
  try {
    if (!fs.existsSync(baseDir)) {
      fs.mkdirSync(baseDir, { recursive: true });
    }
  } catch {
    return '/tmp/error_logs.json';
  }
  return path.join(baseDir, 'error_logs.json');
}

function addDaysToDate(dateStr: string, days: number): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

export function getTodayDateString(): string {
  return new Date().toISOString().split('T')[0];
}

function getInitialSeedLogs(): ErrorLogItem[] {
  const today = getTodayDateString();
  return [
    {
      id: 'err-seed-calc-01',
      createdAt: new Date(Date.now() - 86400000 * 2).toISOString(),
      updatedAt: new Date(Date.now() - 86400000 * 2).toISOString(),
      subjectId: 'math-thpt',
      subjectName: 'Toán THPT',
      subjectGroup: 'STEM',
      topic: 'Hàm số & Đạo hàm',
      questionFormat: 'MCQ_4',
      processBreakpoint: 'STAGE_4_VERIFY',
      difficulty: 3,
      timePressure: 'EXAM_PACE',
      questionText:
        'Tìm tất cả các giá trị thực của tham số $m$ để hàm số $y = \\frac{mx + 4}{x + m}$ nghịch biến trên khoảng $(-\\infty; 1)$.',
      myWrongStep:
        'Chỉ tính đạo hàm $y\' = \\frac{m^2 - 4}{(x+m)^2} < 0 \\iff -2 < m < 2$ rồi chọn ngay đáp án A mà quên mất điều kiện nghiệm mẫu $x = -m$ không được nằm trong khoảng $(-\\infty; 1)$.',
      correctSolution:
        'Điều kiện cần và đủ: $\\begin{cases} y\' = \\frac{m^2 - 4}{(x+m)^2} < 0 \\\\ -m \\notin (-\\infty; 1) \\end{cases} \\iff \\begin{cases} -2 < m < 2 \\\\ -m \\ge 1 \\end{cases} \\iff -2 < m \\le -1$.',
      references: [
        {
          id: 'ref-1',
          type: 'YOUTUBE',
          title: 'Chữa đề khảo sát Hàm số - Bẫy ĐKXĐ tiệm cận đứng',
          url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=425s',
          youtubeTimestampSec: 425,
        },
        {
          id: 'ref-2',
          type: 'BOOK_PDF',
          title: 'Tài liệu Giải tích 12 Nâng cao',
          bookName: 'Chuyên đề Hàm số - Tập 1',
          pageNumber: '48',
          questionNumber: 'Câu 32',
        },
      ],
      whyCodes: ['A7', 'C1'],
      whyCustomNotes: 'Thấy ra $-2 < m < 2$ trùng khít đáp án A nên khoanh luôn không kiểm tra mẫu số.',
      ifTrigger: 'Đề bài yêu cầu hàm phân thức $y = \\frac{ax+b}{cx+d}$ đơn điệu trên một khoảng $(a; b)$ cho trước',
      thenAction: 'Bắt buộc viết hệ 2 dấu ngoặc nhọn ngay đầu dòng: (1) dấu của $y\'$ và (2) nghiệm mẫu $x_0 = -d/c \\notin (a; b)$ trước khi giải.',
      howActions: ['H1', 'H3', 'H4'],
      inPreExamChecklist: true,
      aiAutopsy: {
        lo_hong_tu_duy:
          'Bạn đồng nhất tính đơn điệu trên từng khoảng xác định với tính đơn điệu trên một khoảng con cụ thể, dẫn đến bỏ qua điểm gián đoạn $x = -m$ của hàm phân thức.',
        so_sanh_buoc_giai: {
          buoc_sai_cua_ban: 'Giải $m^2 - 4 < 0 \\Rightarrow -2 < m < 2$ và dừng lại ở điều kiện đạo hàm âm.',
          tu_duy_chuan_xac: 'Hàm số muốn nghịch biến trên $(-\\infty; 1)$ thì trước hết phải XÁC ĐỊNH và LIÊN TỤC trên $(-\\infty; 1)$, tức là điểm gián đoạn $-m \\ge 1$.',
        },
        quy_tac_neu_thi: {
          neu_trigger: 'Hàm phân thức đơn điệu trên khoảng $K$',
          thi_action: 'Ghi điều kiện nghiệm mẫu $-d/c \\notin K$ ở dòng số 1 trước khi tính đạo hàm $ad - bc$.',
        },
        generatedAt: new Date().toISOString(),
      },
      twinQuestions: [
        {
          id: 'twin-calc-1',
          title: 'Bài tập Sinh đôi #1 (Cùng cấu trúc bẫy điểm gián đoạn)',
          promptLatex:
            'Có bao nhiêu giá trị nguyên của tham số $m$ để hàm số $y = \\frac{x + 2}{x - m}$ nghịch biến trên khoảng $(3; +\\infty)$?',
          options: ['A. Vô số', 'B. 5', 'C. 6', 'D. 4'],
          correctAnswer: 'B. 5',
          trapWarning: 'Cẩn thận thiếu dấu bằng ở điều kiện $m \\le 3$ hoặc quên điều kiện $m > -2$.',
          stepByStepSolution:
            'Ta có $y\' = \\frac{-m - 2}{(x-m)^2}$. Hàm số nghịch biến trên $(3; +\\infty) \\iff \\begin{cases} -m - 2 < 0 \\\\ m \\notin (3; +\\infty) \\end{cases} \\iff \\begin{cases} m > -2 \\\\ m \\le 3 \\end{cases} \\iff -2 < m \\le 3$. Vì $m \\in \\mathbb{Z}$ nên $m \\in \\{-1, 0, 1, 2, 3\\}$, có 5 giá trị nguyên.',
        },
      ],
      leitnerBox: 1,
      nextReviewDate: today,
      reviewCount: 1,
      isResolved: false,
    },
    {
      id: 'err-seed-ielts-02',
      createdAt: new Date(Date.now() - 86400000).toISOString(),
      updatedAt: new Date(Date.now() - 86400000).toISOString(),
      subjectId: 'ielts-reading',
      subjectName: 'IELTS Reading',
      subjectGroup: 'LANGUAGE',
      topic: 'True / False / Not Given',
      questionFormat: 'TRUE_FALSE_SET',
      processBreakpoint: 'STAGE_1_DECODE',
      difficulty: 4,
      timePressure: 'PANIC',
      questionText:
        'Passage: "While solar adoption increased substantially in urban coastal districts, rural inland communities largely retained traditional biomass heating due to grid infrastructure costs." \nQuestion: "Rural communities preferred biomass heating because it was more environmentally sustainable than solar power."',
      myWrongStep:
        'Chọn FALSE vì trong bài nói lý do là "due to grid infrastructure costs" chứ không phải vì "environmentally sustainable".',
      correctSolution:
        'Đáp án chuẩn là NOT GIVEN. Bài đọc nêu lý do giữ lại biomass là chi phí hạ tầng lưới điện, nhưng hoàn toàn KHÔNG đề cập hay so sánh xem người dân nông thôn có nghĩ biomass bền vững hơn hay không.',
      references: [
        {
          id: 'ref-3',
          type: 'BOOK_PDF',
          title: 'Cambridge IELTS 18 Academic',
          bookName: 'Cambridge IELTS 18',
          pageNumber: '67',
          questionNumber: 'Passage 2 - Q19',
        },
      ],
      whyCodes: ['C1', 'C2', 'A1'],
      whyCustomNotes: 'Nhầm lẫn kinh điển giữa FALSE (ngược thông tin) và NOT GIVEN (đánh tráo lý do chưa từng được nhắc tới).',
      ifTrigger: 'Câu hỏi T/F/NG có cấu trúc nhân quả "A happened BECAUSE OF B" mà trong bài đọc chỉ nhắc đến A cùng một nguyên nhân C khác',
      thenAction: 'Kiểm tra xem C có loại trừ tuyệt đối B không (có chữ ONLY/SOLELY không). Nếu bài không dùng từ độc tôn mà chỉ nêu C, còn B không được nhắc tới -> Chọn NOT GIVEN.',
      howActions: ['H1', 'H2', 'H4'],
      inPreExamChecklist: true,
      twinQuestions: [],
      leitnerBox: 1,
      nextReviewDate: today,
      reviewCount: 0,
      isResolved: false,
    },
    {
      id: 'err-seed-chem-03',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      subjectId: 'chemistry',
      subjectName: 'Hóa học',
      subjectGroup: 'STEM',
      topic: 'Este - Lipit',
      questionFormat: 'GRID_IN',
      processBreakpoint: 'STAGE_3_EXECUTE',
      difficulty: 3,
      timePressure: 'EXAM_PACE',
      questionText:
        'Thủy phân hoàn toàn $0.15\\text{ mol}$ phenyl axetat ($CH_3COOC_6H_5$) trong dung dịch chứa $0.4\\text{ mol } NaOH$ đun nóng. Cô cạn dung dịch sau phản ứng thu được bao nhiêu gam chất rắn khan?',
      myWrongStep:
        'Tính số mol $NaOH$ phản ứng bằng $0.15\\text{ mol}$ (tỉ lệ 1:1 như este thường) dẫn đến khối lượng chất rắn bị sai.',
      correctSolution:
        'Phenyl axetat là este của phenol nên phản ứng theo tỉ lệ $1:2$: $CH_3COOC_6H_5 + 2NaOH \\rightarrow CH_3COONa + C_6H_5ONa + H_2O$. Chất rắn gồm $0.15\\text{ mol } CH_3COONa (82) + 0.15\\text{ mol } C_6H_5ONa (116) + 0.1\\text{ mol } NaOH_{\\text{dư}} (40) = 33.7\\text{ gam}$.',
      references: [],
      whyCodes: ['B3', 'A3'],
      whyCustomNotes: 'Quên nhân 2 số mol NaOH cho gốc phenol và quên cộng lượng NaOH dư.',
      ifTrigger: 'Đề bài thủy phân este có vòng benzen gắn trực tiếp vào nguyên tử Oxi của nhóm $-COO-$ (este của phenol)',
      thenAction: 'Viết ngay tỉ lệ $n_{NaOH} = 2 n_{\\text{este phenol}}$ và dùng Bảo toàn khối lượng: $m_{\\text{rắn}} = m_{\\text{este}} + m_{NaOH \\text{ ban đầu}} - m_{H_2O}$ với $n_{H_2O} = n_{\\text{este phenol}}$.',
      howActions: ['H1', 'H2', 'H4'],
      inPreExamChecklist: true,
      twinQuestions: [],
      leitnerBox: 2,
      nextReviewDate: addDaysToDate(today, 3),
      reviewCount: 2,
      isResolved: false,
    },
  ];
}

function readLogsFromDisk(): ErrorLogItem[] {
  const filePath = getStorageFilePath();
  try {
    if (!fs.existsSync(filePath)) {
      const seeds = getInitialSeedLogs();
      fs.writeFileSync(filePath, JSON.stringify(seeds, null, 2), 'utf-8');
      return seeds;
    }
    const raw = fs.readFileSync(filePath, 'utf-8');
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed;
    }
    const seeds = getInitialSeedLogs();
    fs.writeFileSync(filePath, JSON.stringify(seeds, null, 2), 'utf-8');
    return seeds;
  } catch {
    return getInitialSeedLogs();
  }
}

function writeLogsToDisk(logs: ErrorLogItem[]): void {
  const filePath = getStorageFilePath();
  try {
    fs.writeFileSync(filePath, JSON.stringify(logs, null, 2), 'utf-8');
  } catch {
    // Fallback an toàn trên môi trường đám mây
  }
}

async function mirrorToSupabaseIfConfigured(item: ErrorLogItem) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) return;

  try {
    const baseUrl = supabaseUrl.replace(/\/$/, '');
    const endpoint = baseUrl.endsWith('/rest/v1')
      ? `${baseUrl}/error_logs`
      : `${baseUrl}/rest/v1/error_logs`;
    await fetch(endpoint, {
      method: 'POST',
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates',
      },
      body: JSON.stringify({
        id: item.id,
        subject_name: item.subjectName,
        topic: item.topic,
        why_codes: item.whyCodes,
        if_trigger: item.ifTrigger,
        then_action: item.thenAction,
        payload: item,
        updated_at: item.updatedAt,
      }),
    });
  } catch {
    // Hoạt động độc lập
  }
}

export function getAllErrorLogs(): ErrorLogItem[] {
  const logs = readLogsFromDisk();
  return logs.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

export function getErrorLogById(id: string): ErrorLogItem | null {
  const logs = readLogsFromDisk();
  return logs.find((l) => l.id === id) || null;
}

export function upsertErrorLog(item: ErrorLogItem): ErrorLogItem {
  const logs = readLogsFromDisk();
  const idx = logs.findIndex((l) => l.id === item.id);
  if (idx >= 0) {
    logs[idx] = item;
  } else {
    logs.unshift(item);
  }
  writeLogsToDisk(logs);
  void mirrorToSupabaseIfConfigured(item);
  return item;
}

export function deleteErrorLog(id: string): boolean {
  const logs = readLogsFromDisk();
  const next = logs.filter((l) => l.id !== id);
  writeLogsToDisk(next);
  return next.length !== logs.length;
}

export function updateLeitnerReview(
  id: string,
  rememberedCorrectly: boolean
): ErrorLogItem | null {
  const existing = getErrorLogById(id);
  if (!existing) return null;

  const today = getTodayDateString();
  const nextBox = rememberedCorrectly
    ? (Math.min(5, existing.leitnerBox + 1) as 1 | 2 | 3 | 4 | 5)
    : 1;
  const intervalDays = LEITNER_INTERVAL_DAYS[nextBox];

  const updated: ErrorLogItem = {
    ...existing,
    updatedAt: new Date().toISOString(),
    leitnerBox: nextBox,
    nextReviewDate: addDaysToDate(today, intervalDays),
    reviewCount: existing.reviewCount + 1,
    isResolved: nextBox >= 4 && rememberedCorrectly,
  };

  return upsertErrorLog(updated);
}

export function computeDashboardAnalytics(logs: ErrorLogItem[]): DashboardAnalytics {
  const totalLogs = logs.length;
  const today = getTodayDateString();

  if (totalLogs === 0) {
    return {
      totalLogs: 0,
      resolvedCount: 0,
      dueTodayCount: 0,
      carelessTaxPercent: 0,
      subjectCarelessBreakdown: [],
      paretoWhyDistribution: [],
      breakpointFunnel: PROCESS_BREAKPOINTS.map((b) => ({
        stage: b.id,
        label: b.title,
        count: 0,
        percentage: 0,
      })),
    };
  }

  const resolvedCount = logs.filter((l) => l.isResolved).length;
  const dueTodayCount = logs.filter(
    (l) => !l.isResolved && l.nextReviewDate <= today
  ).length;

  const logsWithCareless = logs.filter((l) =>
    l.whyCodes.some((code) => code.startsWith('A'))
  );
  const carelessTaxPercent = Math.round((logsWithCareless.length / totalLogs) * 100);

  const subjectMap = new Map<
    string,
    { total: number; carelessCount: number; knowledgeCount: number; trapCount: number }
  >();

  for (const log of logs) {
    const current = subjectMap.get(log.subjectName) || {
      total: 0,
      carelessCount: 0,
      knowledgeCount: 0,
      trapCount: 0,
    };
    current.total += 1;
    if (log.whyCodes.some((c) => c.startsWith('A'))) current.carelessCount += 1;
    if (log.whyCodes.some((c) => c.startsWith('B'))) current.knowledgeCount += 1;
    if (log.whyCodes.some((c) => c.startsWith('C'))) current.trapCount += 1;
    subjectMap.set(log.subjectName, current);
  }

  const subjectCarelessBreakdown = Array.from(subjectMap.entries()).map(
    ([subjectName, stats]) => ({
      subjectName,
      ...stats,
      carelessPercent: Math.round((stats.carelessCount / stats.total) * 100),
    })
  );

  const whyCounter = new Map<WhyCode, number>();
  let totalWhyTagsSelected = 0;

  for (const log of logs) {
    for (const code of log.whyCodes) {
      whyCounter.set(code, (whyCounter.get(code) || 0) + 1);
      totalWhyTagsSelected += 1;
    }
  }

  const sortedWhyEntries = Array.from(whyCounter.entries()).sort(
    (a, b) => b[1] - a[1]
  );

  let runningCumulative = 0;
  const paretoWhyDistribution = sortedWhyEntries.map(([code, count]) => {
    const def = WHY_DICTIONARY.find((d) => d.code === code);
    const percentage =
      totalWhyTagsSelected > 0
        ? Math.round((count / totalWhyTagsSelected) * 1000) / 10
        : 0;
    runningCumulative = Math.min(
      100,
      Math.round((runningCumulative + percentage) * 10) / 10
    );

    return {
      code,
      label: def ? def.title : code,
      group: def ? def.group : 'GROUP_A_CARELESS',
      count,
      percentage,
      cumulativePercentage: runningCumulative,
    };
  });

  const stageCounts = new Map<ProcessBreakpoint, number>();
  for (const log of logs) {
    stageCounts.set(
      log.processBreakpoint,
      (stageCounts.get(log.processBreakpoint) || 0) + 1
    );
  }

  const breakpointFunnel = PROCESS_BREAKPOINTS.map((bp) => {
    const count = stageCounts.get(bp.id) || 0;
    return {
      stage: bp.id,
      label: bp.title,
      count,
      percentage: Math.round((count / totalLogs) * 100),
    };
  });

  return {
    totalLogs,
    resolvedCount,
    dueTodayCount,
    carelessTaxPercent,
    subjectCarelessBreakdown,
    paretoWhyDistribution,
    breakpointFunnel,
  };
}
