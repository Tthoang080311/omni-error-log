// File: src/constants/taxonomy.ts
import {
  SubjectGroup,
  QuestionFormat,
  ProcessBreakpoint,
  TimePressureLevel,
  WhyCategoryGroup,
  WhyCode,
  HowActionCode,
} from '@/types/error-log';

export interface SubjectDefinition {
  id: string;
  name: string;
  group: SubjectGroup;
  groupLabel: string;
  defaultTopics: string[];
}

export const INITIAL_SUBJECTS: SubjectDefinition[] = [
  // Khối Tự nhiên & Định lượng
  {
    id: 'math-thpt',
    name: 'Toán THPT',
    group: 'STEM',
    groupLabel: 'Tự nhiên & Định lượng',
    defaultTopics: ['Hàm số & Đạo hàm', 'Mũ & Logarit', 'Nguyên hàm - Tích phân', 'Hình học Oxyz', 'Xác suất thống kê', 'Số phức'],
  },
  {
    id: 'ap-calc-bc',
    name: 'AP Calculus BC',
    group: 'STEM',
    groupLabel: 'Tự nhiên & Định lượng',
    defaultTopics: ['Limits & Continuity', 'Differentiation', 'Integration by Parts', 'Taylor & Maclaurin Series', 'Parametric & Polar', 'Differential Equations'],
  },
  {
    id: 'sat-math',
    name: 'SAT Math',
    group: 'STEM',
    groupLabel: 'Tự nhiên & Định lượng',
    defaultTopics: ['Heart of Algebra', 'Problem Solving & Data Analysis', 'Passport to Advanced Math', 'Geometry & Trigonometry'],
  },
  {
    id: 'physics',
    name: 'Vật lý',
    group: 'STEM',
    groupLabel: 'Tự nhiên & Định lượng',
    defaultTopics: ['Dao động cơ', 'Sóng cơ & Sóng ánh sáng', 'Điện xoay chiều', 'Nhiệt học', 'Vật lý hạt nhân'],
  },
  {
    id: 'chemistry',
    name: 'Hóa học',
    group: 'STEM',
    groupLabel: 'Tự nhiên & Định lượng',
    defaultTopics: ['Este - Lipit', 'Cân bằng hóa học', 'Điện phân', 'Kim loại kiềm - kiềm thổ - nhôm', 'Hữu cơ tổng hợp'],
  },
  {
    id: 'cs-prog',
    name: 'Tin học / Lập trình',
    group: 'STEM',
    groupLabel: 'Tự nhiên & Định lượng',
    defaultTopics: ['Quy hoạch động (DP)', 'Đồ thị (BFS/DFS/Dijkstra)', 'Cấu trúc dữ liệu', 'Độ phức tạp thuật toán', 'Xử lý chuỗi & Mảng'],
  },
  {
    id: 'economics',
    name: 'Kinh tế học (Vi mô / Vĩ mô / Kinh tế lượng)',
    group: 'STEM',
    groupLabel: 'Tự nhiên & Định lượng',
    defaultTopics: ['Cung - Cầu & Độ co giãn', 'Cấu trúc thị trường', 'Chính sách Tài khóa & Tiền tệ', 'Hồi quy OLS & Kiểm định giả thuyết'],
  },

  // Khối Ngôn ngữ & Học thuật
  {
    id: 'ielts-listening',
    name: 'IELTS Listening',
    group: 'LANGUAGE',
    groupLabel: 'Ngôn ngữ & Học thuật',
    defaultTopics: ['Part 1: Form Completion', 'Part 2: Map & Matching', 'Part 3: Academic Discussion (MCQ)', 'Part 4: Note Completion'],
  },
  {
    id: 'ielts-reading',
    name: 'IELTS Reading',
    group: 'LANGUAGE',
    groupLabel: 'Ngôn ngữ & Học thuật',
    defaultTopics: ['True / False / Not Given', 'Yes / No / Not Given', 'Matching Headings', 'Summary Completion', 'Multiple Choice'],
  },
  {
    id: 'ielts-writing',
    name: 'IELTS Writing',
    group: 'LANGUAGE',
    groupLabel: 'Ngôn ngữ & Học thuật',
    defaultTopics: ['Task 1: Line/Bar/Pie Charts', 'Task 1: Map & Process', 'Task 2: Opinion / Discussion Essay', 'Cohesion & Lexical Resource'],
  },
  {
    id: 'ielts-speaking',
    name: 'IELTS Speaking',
    group: 'LANGUAGE',
    groupLabel: 'Ngôn ngữ & Học thuật',
    defaultTopics: ['Part 1: Fluency', 'Part 2: Cue Card Storytelling', 'Part 3: Abstract Discussion', 'Pronunciation & Grammar Range'],
  },
  {
    id: 'sat-rw',
    name: 'SAT Reading & Writing',
    group: 'LANGUAGE',
    groupLabel: 'Ngôn ngữ & Học thuật',
    defaultTopics: ['Craft and Structure', 'Command of Evidence (Textual/Quantitative)', 'Standard English Conventions', 'Rhetorical Synthesis'],
  },
  {
    id: 'eng-thpt',
    name: 'Tiếng Anh THPT',
    group: 'LANGUAGE',
    groupLabel: 'Ngôn ngữ & Học thuật',
    defaultTopics: ['Ngữ âm & Trọng âm', 'Thì & Sự phối thì', 'Mệnh đề quan hệ & Đảo ngữ', 'Collocations & Phrasal Verbs', 'Đọc hiểu & Đọc điền'],
  },
  {
    id: 'second-lang',
    name: 'Ngoại ngữ 2 (Pháp / Nhật / Trung)',
    group: 'LANGUAGE',
    groupLabel: 'Ngôn ngữ & Học thuật',
    defaultTopics: ['Từ vựng & Hán tự (Kanji/Hanzi)', 'Chia động từ & Ngữ pháp', 'Đọc hiểu ngữ cảnh', 'Nghe phản xạ'],
  },

  // Khối Xã hội
  {
    id: 'history',
    name: 'Lịch sử',
    group: 'SOCIAL',
    groupLabel: 'Khoa học Xã hội',
    defaultTopics: ['Lịch sử Việt Nam 1919-1945', 'Kháng chiến chống Pháp & Mỹ', 'Lịch sử Thế giới Hiện đại', 'Quan hệ Quốc tế'],
  },
  {
    id: 'geography',
    name: 'Địa lý',
    group: 'SOCIAL',
    groupLabel: 'Khoa học Xã hội',
    defaultTopics: ['Kỹ năng Atlat & Biểu đồ', 'Địa lý Tự nhiên', 'Địa lý Kinh tế ngành', 'Địa lý các vùng kinh tế'],
  },
  {
    id: 'literature',
    name: 'Văn học',
    group: 'SOCIAL',
    groupLabel: 'Khoa học Xã hội',
    defaultTopics: ['Đọc hiểu văn bản', 'Nghị luận xã hội', 'Nghị luận văn học', 'Lý luận văn học'],
  },
];

export const QUESTION_FORMATS: {
  id: QuestionFormat;
  label: string;
  shortDesc: string;
}[] = [
  { id: 'MCQ_4', label: 'Trắc nghiệm 4 lựa chọn (MCQ)', shortDesc: 'A, B, C, D truyền thống' },
  { id: 'TRUE_FALSE_SET', label: 'Trắc nghiệm Đúng/Sai nhiều ý', shortDesc: 'Chùm 4 mệnh đề Đúng/Sai hoặc T/F/NG' },
  { id: 'GRID_IN', label: 'Điền đáp án ngắn (Grid-in / Fill)', shortDesc: 'Trả lời ngắn bằng số hoặc từ khóa' },
  { id: 'DERIVATION', label: 'Tự luận biến đổi', shortDesc: 'Trình bày các bước giải toán/code' },
  { id: 'ESSAY', label: 'Viết luận (Essay)', shortDesc: 'Đoạn văn hoặc bài luận học thuật' },
  { id: 'AUDIO_ORAL', label: 'Phản xạ Nghe / Nói', shortDesc: 'Bắt âm thanh hoặc trả lời trực tiếp' },
];

export const PROCESS_BREAKPOINTS: {
  id: ProcessBreakpoint;
  stepNumber: number;
  title: string;
  subtitle: string;
  examples: string;
}[] = [
  {
    id: 'STAGE_1_DECODE',
    stepNumber: 1,
    title: 'Giai đoạn 1: Giải mã đề bài',
    subtitle: 'Đọc sót dữ kiện, hiểu sai câu hỏi hoặc yêu cầu đề',
    examples: 'Sót chữ KHÔNG, nhầm đơn vị, đọc lướt giả thiết nguyên dương',
  },
  {
    id: 'STAGE_2_RETRIEVE',
    stepNumber: 2,
    title: 'Giai đoạn 2: Truy xuất & Lập hướng giải',
    subtitle: 'Chọn sai công thức, áp dụng nhầm định lý, sai cấu trúc ngữ pháp/từ vựng',
    examples: 'Quên công thức tích phân từng phần, nhầm cấu trúc đảo ngữ',
  },
  {
    id: 'STAGE_3_EXECUTE',
    stepNumber: 3,
    title: 'Giai đoạn 3: Thực thi & Biến đổi',
    subtitle: 'Hướng đi đúng nhưng tính toán sai, biến đổi đại số lỗi, diễn đạt lủng củng',
    examples: 'Chuyển vế quên đổi dấu, đạo hàm nhầm hệ số, chia động từ sai số ít/nhiều',
  },
  {
    id: 'STAGE_4_VERIFY',
    stepNumber: 4,
    title: 'Giai đoạn 4: Kiểm tra & Kết luận',
    subtitle: 'Quên đối chiếu ĐKXĐ, quên đổi đơn vị cuối, khoanh nhầm đáp án vào phiếu',
    examples: 'Không loại nghiệm ngoại lai, tính ra x=2 nhưng đề hỏi 2x+1',
  },
];

export const TIME_PRESSURE_LEVELS: {
  id: TimePressureLevel;
  label: string;
  badgeColor: string;
}[] = [
  {
    id: 'RELAXED',
    label: 'Thong thả (Tự luyện tập)',
    badgeColor: 'bg-[#E5F2EA] text-[#3B7A57] border-[#3B7A57]/30',
  },
  {
    id: 'EXAM_PACE',
    label: 'Đúng tốc độ phòng thi',
    badgeColor: 'bg-[#FDF4E7] text-[#D48C2A] border-[#D48C2A]/30',
  },
  {
    id: 'PANIC',
    label: 'Hoảng loạn / Cạn giờ (Dưới 1 phút cuối)',
    badgeColor: 'bg-[#F9EBE7] text-[#C85A3B] border-[#C85A3B]/30',
  },
];

export interface WhyDefinition {
  code: WhyCode;
  group: WhyCategoryGroup;
  groupTitle: string;
  shortcutKey: string;
  title: string;
  description: string;
  defaultIfTrigger: string;
  defaultThenAction: string;
}

export const WHY_GROUPS_META: Record<
  WhyCategoryGroup,
  {
    title: string;
    subtitle: string;
    bgLight: string;
    border: string;
    textMain: string;
    badgeBg: string;
  }
> = {
  GROUP_A_CARELESS: {
    title: 'Nhóm A: Lỗi Ẩu & Thao tác cơ học ("Thuế Ẩu")',
    subtitle: 'Biết làm nhưng mất điểm oan do mắt nhìn, tay viết hoặc máy tính',
    bgLight: '#F9EBE7',
    border: '#C85A3B',
    textMain: '#C85A3B',
    badgeBg: '#C85A3B',
  },
  GROUP_B_KNOWLEDGE: {
    title: 'Nhóm B: Hổng kiến thức & Ngộ nhận bản chất',
    subtitle: 'Điểm mù lý thuyết, quên công thức/từ vựng hoặc hiểu sai điều kiện định lý',
    bgLight: '#E6ECE2',
    border: '#2C4C3E',
    textMain: '#2C4C3E',
    badgeBg: '#2C4C3E',
  },
  GROUP_C_TRAP: {
    title: 'Nhóm C: Sập bẫy đề thi & Lỗi chiến thuật',
    subtitle: 'Bị lừa bởi đáp án nhiễu, suy diễn quá đà hoặc sa lầy cách giải cồng kềnh',
    bgLight: '#FDF4E7',
    border: '#D48C2A',
    textMain: '#D48C2A',
    badgeBg: '#D48C2A',
  },
  GROUP_D_PSYCH: {
    title: 'Nhóm D: Tâm lý & Thể trạng',
    subtitle: 'Đứt quãng tập trung, khớp tâm lý trước bài lạ hoặc suy kiệt năng lượng cuối giờ',
    bgLight: '#D8E6DF',
    border: '#52796F',
    textMain: '#1B3B2B',
    badgeBg: '#52796F',
  },
};

export const WHY_DICTIONARY: WhyDefinition[] = [
  // ================= NHÓM A: LỖI ẨU & THAO TÁC CƠ HỌC =================
  {
    code: 'A1',
    group: 'GROUP_A_CARELESS',
    groupTitle: 'Nhóm A: Thuế Ẩu',
    shortcutKey: '1',
    title: '[A1] Đọc lướt bỏ sót từ khóa phủ định/giới hạn',
    description: 'Sót chữ KHÔNG, NGOẠI TRỪ, NOT, ONLY, at least, nguyên dương, phân biệt.',
    defaultIfTrigger: 'Đề bài có chứa từ chỉ giới hạn tập hợp (nguyên dương, phân biệt) hoặc từ phủ định (KHÔNG, NOT, EXCEPT, at least)',
    defaultThenAction: 'Lấy bút khoanh tròn 2 vòng quanh từ khóa đó ngay lập tức trước khi đọc xuống các phương án A, B, C, D.',
  },
  {
    code: 'A2',
    group: 'GROUP_A_CARELESS',
    groupTitle: 'Nhóm A: Thuế Ẩu',
    shortcutKey: '2',
    title: '[A2] Nhầm đơn vị đo hoặc nhìn nhầm trục đồ thị',
    description: 'cm vs m, độ vs radian, phần trăm vs số tuyệt đối, nhìn nhầm trục tung/hoành hoặc đồ thị f(x) vs f\'(x).',
    defaultIfTrigger: 'Đề bài có kèm hình vẽ đồ thị bảng biến thiên hoặc các đại lượng khác hệ đơn vị chuẩn SI',
    defaultThenAction: 'Ghi to tên hàm ở đầu trục (f(x) hay f\'(x)) và đổi toàn bộ số liệu về cùng 1 đơn vị chuẩn ở dòng nháp đầu tiên.',
  },
  {
    code: 'A3',
    group: 'GROUP_A_CARELESS',
    groupTitle: 'Nhóm A: Thuế Ẩu',
    shortcutKey: '3',
    title: '[A3] Lỗi tính nhẩm / Nhầm dấu đại số cơ bản',
    description: 'Chuyển vế quên đổi dấu +/-, nhân phá ngoặc có dấu trừ phía trước bị sai, cộng trừ nhẩm sai số đơn giản.',
    defaultIfTrigger: 'Thực hiện phép biến đổi phá dấu ngoặc có dấu trừ (-) đằng trước hoặc chuyển vế bất phương trình chia cho số âm',
    defaultThenAction: 'Tuyệt đối không làm tắt gộp 2 bước trong đầu; viết rõ dòng trung gian đổi dấu từng hạng tử ra giấy nháp.',
  },
  {
    code: 'A4',
    group: 'GROUP_A_CARELESS',
    groupTitle: 'Nhóm A: Thuế Ẩu',
    shortcutKey: '4',
    title: '[A4] Bấm máy tính Casio lỗi / Sai chế độ máy',
    description: 'Nhập thiếu ngoặc ở mẫu số/số mũ, bấm nhầm phím, để sai chế độ Radian/Degree.',
    defaultIfTrigger: 'Bấm biểu thức phân số phức tạp, tích phân hoặc lượng giác trên máy tính cầm tay',
    defaultThenAction: 'Kiểm tra chữ R/D trên đỉnh màn hình Casio và luôn đóng mở ngoặc bao quanh toàn bộ tử số, mẫu số trước khi bấm CALC/bằng.',
  },
  {
    code: 'A5',
    group: 'GROUP_A_CARELESS',
    groupTitle: 'Nhóm A: Thuế Ẩu',
    shortcutKey: '5',
    title: '[A5] Chép sai số từ đề ra nháp hoặc khoanh nhầm đáp án',
    description: 'Đề cho số 6 chép ra nháp thành số 9, hoặc nháp đúng ra đáp án A nhưng tay lại tô vào ô B.',
    defaultIfTrigger: 'Chép phương trình từ đề ra giấy nháp hoặc chuẩn bị tô đáp án cuối cùng vào phiếu trả lời',
    defaultThenAction: 'Dùng đầu bút dò đối chiếu lại từng hệ số đề bài với dòng nháp đầu tiên, và đọc thầm "Câu X chọn Y" khi tô.',
  },
  {
    code: 'A6',
    group: 'GROUP_A_CARELESS',
    groupTitle: 'Nhóm A: Thuế Ẩu',
    shortcutKey: '6',
    title: '[A6] Nháp quá bẩn và lộn xộn',
    description: 'Viết đè lên nhau, chữ xấu tự nhìn nhầm số mũ hoặc chỉ số dưới, không tìm thấy kết quả trung gian.',
    defaultIfTrigger: 'Bắt đầu giải một câu vận dụng có từ 3 bước biến đổi trở lên',
    defaultThenAction: 'Kẻ chia đôi tờ giấy nháp theo chiều dọc, đánh số thứ tự câu rõ ràng và đóng khung các kết quả trung gian.',
  },
  {
    code: 'A7',
    group: 'GROUP_A_CARELESS',
    groupTitle: 'Nhóm A: Thuế Ẩu',
    shortcutKey: '7',
    title: '[A7] Quên kiểm tra Điều kiện xác định / Điều kiện biên',
    description: 'Giải xong không loại nghiệm ngoại lai, quên xét mẫu số khác 0, biểu thức trong logarit dương hoặc trường hợp a = 0.',
    defaultIfTrigger: 'Gặp phương trình chứa căn, ẩn ở mẫu, hàm logarit, hoặc tham số m đứng trước bậc cao nhất',
    defaultThenAction: 'Viết "ĐKXĐ: ..." đóng khung ở góc trên cùng bên phải phần nháp và xét riêng trường hợp hệ số a = 0 đầu tiên.',
  },

  // ================= NHÓM B: HỔNG KIẾN THỨC & NGỘ NHẬN BẢN CHẤT =================
  {
    code: 'B1',
    group: 'GROUP_B_KNOWLEDGE',
    groupTitle: 'Nhóm B: Hổng Kiến Thức',
    shortcutKey: '8',
    title: '[B1] Điểm mù hoàn toàn (Chưa từng biết)',
    description: 'Kiến thức, định lý, từ vựng học thuật hoặc cấu trúc mới tinh chưa từng gặp bao giờ.',
    defaultIfTrigger: 'Gặp khái niệm, thuật ngữ hoặc dạng bài hoàn toàn mới làm tắc nghẽn ngay từ bước đọc đề',
    defaultThenAction: 'Đóng gói ngay khái niệm này thành thẻ Flashcard Anki kèm 1 ví dụ mẫu chuẩn mực và ôn lại theo chu kỳ 1-3-7 ngày.',
  },
  {
    code: 'B2',
    group: 'GROUP_B_KNOWLEDGE',
    groupTitle: 'Nhóm B: Hổng Kiến Thức',
    shortcutKey: '9',
    title: '[B2] Quên tạm thời kiến thức đã học',
    description: 'Biết chắc là đã từng học nhưng trong lúc làm bài không tài nào truy xuất được chính xác công thức/từ vựng đó.',
    defaultIfTrigger: 'Nhớ mang máng hình dáng công thức nhưng phân vân dấu cộng/trừ hoặc hệ số 1/2, 1/3',
    defaultThenAction: 'Tự chứng minh nhanh lại từ trường hợp đơn giản nhất (thay số nhỏ n=1, n=2) thay vì đoán mò công thức.',
  },
  {
    code: 'B3',
    group: 'GROUP_B_KNOWLEDGE',
    groupTitle: 'Nhóm B: Hổng Kiến Thức',
    shortcutKey: 'q',
    title: '[B3] Nhầm lẫn 2 khái niệm gần giống nhau',
    description: 'Nhầm công thức đạo hàm với nguyên hàm, nhầm 2 từ tiếng Anh/Pháp có mặt chữ hoặc phát âm na ná nhau.',
    defaultIfTrigger: 'Gặp một cặp khái niệm song sinh dễ lộn (ví dụ: đạo hàm vs nguyên hàm của sin/cos, affect vs effect)',
    defaultThenAction: 'Lập bảng so sánh đối xứng 2 cột ngay trong sổ tay lỗi sai để đặt 2 khái niệm cạnh nhau và chỉ rõ điểm khác biệt.',
  },
  {
    code: 'B4',
    group: 'GROUP_B_KNOWLEDGE',
    groupTitle: 'Nhóm B: Hổng Kiến Thức',
    shortcutKey: 'w',
    title: '[B4] Học vẹt công thức nhưng không hiểu bản chất',
    description: 'Chỉ biết áp số vào công thức mẫu, khi đề đổi cách hỏi ngược hoặc hỏi ý nghĩa vật lý/hình học là đứng hình.',
    defaultIfTrigger: 'Đề bài không cho số liệu trực tiếp mà hỏi bản chất đồ thị, ý nghĩa hình học của đạo hàm/tích phân hoặc cơ chế phản ứng',
    defaultThenAction: 'Dừng việc áp công thức giải nhanh; vẽ hình minh họa hoặc viết định nghĩa gốc của đại lượng đó ra nháp.',
  },
  {
    code: 'B5',
    group: 'GROUP_B_KNOWLEDGE',
    groupTitle: 'Nhóm B: Hổng Kiến Thức',
    shortcutKey: 'e',
    title: '[B5] Áp dụng định lý khi chưa đủ điều kiện tiên quyết',
    description: 'Dùng BĐT Cô-si khi chưa chứng minh các số dương, dùng định lý L\'Hôpital khi chưa phải dạng vô định 0/0.',
    defaultIfTrigger: 'Chuẩn bị áp dụng BĐT AM-GM (Cô-si), quy tắc L\'Hôpital, hoặc định lý giá trị trung gian',
    defaultThenAction: 'Kiểm tra và viết đủ điều kiện tiên quyết (số không âm, hàm liên tục, dạng vô định) trước khi viết dấu suy ra.',
  },

  // ================= NHÓM C: SẬP BẪY ĐỀ THI & LỖI CHIẾN THUẬT =================
  {
    code: 'C1',
    group: 'GROUP_C_TRAP',
    groupTitle: 'Nhóm C: Bẫy & Chiến Thuật',
    shortcutKey: 'r',
    title: '[C1] Sập bẫy đáp án nhiễu (Distractor Trap)',
    description: 'Đáp án chứa từ khóa y hệt bài đọc/bài nghe nhưng bị đánh tráo chủ vị, quan hệ nhân-quả hoặc từ chỉ mức độ.',
    defaultIfTrigger: 'Trong IELTS Reading/Listening hoặc SAT RW, thấy một phương án lặp lại nguyên xi nhiều từ vựng giống hệt bài gốc',
    defaultThenAction: 'Bật cảnh giác đỏ: kiểm tra ngay động từ chính, trạng từ chỉ mức độ (all, only, never, always) và chiều mũi tên nhân-quả.',
  },
  {
    code: 'C2',
    group: 'GROUP_C_TRAP',
    groupTitle: 'Nhóm C: Bẫy & Chiến Thuật',
    shortcutKey: 't',
    title: '[C2] Suy diễn quá đà (Overthinking)',
    description: 'Tự vẽ thêm giả thiết ngoài phạm vi bài đọc/đề bài, biến câu hỏi True/Not Given hoặc đọc hiểu đơn giản thành phức tạp.',
    defaultIfTrigger: 'Phải dùng câu "Có lẽ là vì...", "Chắc ý tác giả ngầm hiểu là..." để nối từ bài đọc sang đáp án',
    defaultThenAction: 'Cắt đứt ngay chuỗi suy diễn cá nhân; nếu không chỉ tay được vào đúng câu chữ chứng minh trực tiếp trong văn bản thì chọn NOT GIVEN / loại bỏ.',
  },
  {
    code: 'C3',
    group: 'GROUP_C_TRAP',
    groupTitle: 'Nhóm C: Bẫy & Chiến Thuật',
    shortcutKey: 'y',
    title: '[C3] Thiên kiến xác nhận (Confirmation Bias)',
    description: 'Đọc lướt rồi đoán trước đáp án theo cảm tính/kiến thức đời thực, sau đó cố bẻ dữ kiện đề để bảo vệ ý mình.',
    defaultIfTrigger: 'Chọn ngay 1 phương án vì thấy nó hợp lý với kiến thức bên ngoài mà chưa đọc hết 3 phương án còn lại',
    defaultThenAction: 'Áp dụng phương pháp loại trừ ngược: bắt buộc phải chỉ ra điểm sai cụ thể của 3 phương án kia trước khi chốt đáp án.',
  },
  {
    code: 'C4',
    group: 'GROUP_C_TRAP',
    groupTitle: 'Nhóm C: Bẫy & Chiến Thuật',
    shortcutKey: 'u',
    title: '[C4] Giải thủ công cồng kềnh (Brute-force kém tối ưu)',
    description: 'Chọn cách biến đổi đại số dài 2 trang giấy thay vì nhận ra tính chất đối xứng, hàm đặc trưng hoặc thử giá trị đặc biệt.',
    defaultIfTrigger: 'Biến đổi đại số quá 5 dòng mà biểu thức ngày càng phình to và bậc phương trình vượt quá bậc 3',
    defaultThenAction: 'Dừng bút ngay lập tức, nhìn lại tính đối xứng của biểu thức, xét tính đơn điệu hàm đặc trưng hoặc thay giá trị đặc biệt để thử.',
  },
  {
    code: 'C5',
    group: 'GROUP_C_TRAP',
    groupTitle: 'Nhóm C: Bẫy & Chiến Thuật',
    shortcutKey: 'i',
    title: '[C5] Sa lầy tâm lý chi phí chìm (Sunk-cost Fallacy)',
    description: 'Cố đấm ăn xôi 1 câu khó suốt 10 phút vì tiếc công đã nháp dở, làm cháy sạch thời gian kiểm tra các câu dễ.',
    defaultIfTrigger: 'Đã ngồi quá 3 phút trên một câu trắc nghiệm mà chưa ra hướng thu gọn kết quả',
    defaultThenAction: 'Khoanh tròn số câu trên đề, đánh dấu tạm phương án có xác suất cao nhất và chuyển sang câu tiếp theo ngay lập tức.',
  },

  // ================= NHÓM D: TÂM LÝ & THỂ TRẠNG =================
  {
    code: 'D1',
    group: 'GROUP_D_PSYCH',
    groupTitle: 'Nhóm D: Tâm Lý & Thể Trạng',
    shortcutKey: 'o',
    title: '[D1] Đứt quãng sự tập trung (Mind-wandering)',
    description: 'Đang nghe IELTS Listening hoặc đọc bài dài thì tâm trí trôi đi mất vài giây đúng chỗ chứa thông tin quyết định.',
    defaultIfTrigger: 'Khi nghe băng IELTS Listening hoặc đọc văn bản học thuật dài trên 700 từ',
    defaultThenAction: 'Dùng đầu bút chì di chuyển liên tục theo từng cụm từ khóa đang nghe/đọc (Active Pointer Tracking) để neo giữ sự chú ý.',
  },
  {
    code: 'D2',
    group: 'GROUP_D_PSYCH',
    groupTitle: 'Nhóm D: Tâm Lý & Thể Trạng',
    shortcutKey: 'p',
    title: '[D2] Khớp tâm lý khi gặp câu hình thức lạ',
    description: 'Đề thực chất dùng kiến thức cơ bản nhưng ngụy trang bằng ký hiệu lạ hoặc bài toán thực tế dài khiến hoảng loạn bỏ cuộc.',
    defaultIfTrigger: 'Gặp bài toán thực tế có lời văn dài hoặc định nghĩa ký hiệu mới lạ trong đề thi',
    defaultThenAction: 'Hít sâu 1 nhịp, gạch bỏ lớp vỏ ngôn từ rườm rà và tóm tắt đề về đúng các biến số x, y cùng công thức toán/lý cốt lõi.',
  },
  {
    code: 'D3',
    group: 'GROUP_D_PSYCH',
    groupTitle: 'Nhóm D: Tâm Lý & Thể Trạng',
    shortcutKey: 'a',
    title: '[D3] Suy kiệt năng lượng cuối giờ (Cognitive Fatigue)',
    description: '30 phút cuối não quá tải, mắt mờ, đọc chữ trượt qua đầu không đọng lại ý, tính toán ẩu hàng loạt.',
    defaultIfTrigger: 'Bước vào 1/3 thời gian cuối của bài thi khi não bắt đầu căng cứng',
    defaultThenAction: 'Nhắm mắt nghỉ 10 giây, thả lỏng vai, chuyển sang kiểm tra lại ĐKXĐ và đơn vị của các câu đã làm trước khi đụng vào câu lấy 10 điểm.',
  },
];

export interface HowActionDefinition {
  code: HowActionCode;
  label: string;
  description: string;
}

export const HOW_ACTIONS_DICTIONARY: HowActionDefinition[] = [
  {
    code: 'H1',
    label: '[H1] Đưa vào Lịch Ôn tập Ngắt quãng (Spaced Repetition: 1 - 3 - 7 - 21 ngày)',
    description: 'Tự động xếp lịch câu hỏi vào Hộp Leitner để giải lại không nhìn đáp án.',
  },
  {
    code: 'H2',
    label: '[H2] Xuất thành thẻ Flashcard Anki (Mặt trước: Đề + Bẫy / Mặt sau: Nếu-Thì + Giải)',
    description: 'Đánh dấu để xuất ra file .csv chuẩn cấu trúc import 1-click vào Anki.',
  },
  {
    code: 'H3',
    label: '[H3] Yêu cầu AI đẻ ngay 2 "Bài tập Sinh đôi" (Twin Questions) giải phục thù tại chỗ',
    description: 'Giữ nguyên cấu trúc logic & bẫy nhận thức nhưng thay số liệu/bối cảnh mới.',
  },
  {
    code: 'H4',
    label: '[H4] Ghi vào Tờ Checklist "Chống Sai Ngu" đọc 5 phút trước khi vào phòng thi',
    description: 'Ghim quy tắc NẾU-THÌ của lỗi này vào bảng Cẩm nang Phòng thi.',
  },
  {
    code: 'H5',
    label: '[H5] Mở lại sách / video bài giảng học lại từ gốc chuyên đề này',
    description: 'Đánh dấu cần ôn lại lý thuyết nền tảng qua tài liệu tham chiếu đã gắn.',
  },
];

export const LEITNER_INTERVAL_DAYS: Record<1 | 2 | 3 | 4 | 5, number> = {
  1: 1,
  2: 3,
  3: 7,
  4: 14,
  5: 21,
};