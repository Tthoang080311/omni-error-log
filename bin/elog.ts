#!/usr/bin/env tsx
import readline from 'readline/promises';
import { stdin as input, stdout as output } from 'process';
import {
  getAllErrorLogs,
  upsertErrorLog,
  computeDashboardAnalytics,
  getTodayDateString,
} from '../src/lib/db';
import {
  INITIAL_SUBJECTS,
  WHY_DICTIONARY,
} from '../src/constants/taxonomy';
import { ErrorLogItem, WhyCode } from '../src/types/error-log';

const ANSI = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  sage: '\x1b[38;2;44;76;62m',
  terracotta: '\x1b[38;2;200;90;59m',
  ochre: '\x1b[38;2;212;140;42m',
  matcha: '\x1b[38;2;59;122;87m',
  muted: '\x1b[38;2;90;107;96m',
};

function printBanner() {
  console.log(
    `\n${ANSI.bold}${ANSI.sage}╔══════════════════════════════════════════════════════════════════════════╗${ANSI.reset}`
  );
  console.log(
    `${ANSI.bold}${ANSI.sage}║   OMNI-SUBJECT SMART ERROR LOG CLI • TRẠM CHẨN ĐOÁN NHẬN THỨC TERMINAL   ║${ANSI.reset}`
  );
  console.log(
    `${ANSI.bold}${ANSI.sage}╚══════════════════════════════════════════════════════════════════════════╝${ANSI.reset}\n`
  );
}

function renderAsciiBar(percent: number, width = 24): string {
  const filled = Math.round((Math.min(100, Math.max(0, percent)) / 100) * width);
  const empty = Math.max(0, width - filled);
  return '█'.repeat(filled) + '░'.repeat(empty);
}

function runReportCommand() {
  printBanner();
  const logs = getAllErrorLogs();
  const analytics = computeDashboardAnalytics(logs);
  const today = getTodayDateString();

  console.log(
    `${ANSI.bold}1. TỔNG QUAN HỆ THỐNG & CHỈ SỐ "THUẾ ẨU" (CARELESS MISTAKE TAX):${ANSI.reset}`
  );
  console.log(
    `   • Tổng số bản ghi lỗi sai : ${ANSI.bold}${analytics.totalLogs}${ANSI.reset}`
  );
  console.log(
    `   • Cần phục thù hôm nay    : ${ANSI.bold}${ANSI.ochre}${analytics.dueTodayCount} câu${ANSI.reset}`
  );
  console.log(
    `   • Đã khắc phục (Hộp 4-5)  : ${ANSI.bold}${ANSI.matcha}${analytics.resolvedCount} câu${ANSI.reset}`
  );
  console.log(
    `   • ${ANSI.bold}${ANSI.terracotta}CHỈ SỐ THUẾ ẨU          : ${analytics.carelessTaxPercent}%${ANSI.reset} [${renderAsciiBar(
      analytics.carelessTaxPercent
    )}]`
  );
  console.log(
    `     ${ANSI.terracotta}"Bạn đang tự vứt đi ${analytics.carelessTaxPercent}% số điểm chỉ vì lỗi ẩu chứ không phải vì không biết làm."${ANSI.reset}\n`
  );

  console.log(
    `${ANSI.bold}2. PHÂN TÍCH PARETO 80/20 (TOP NGUYÊN NHÂN GỐC GÂY MẤT ĐIỂM):${ANSI.reset}`
  );
  for (const p of analytics.paretoWhyDistribution.slice(0, 6)) {
    const bar = renderAsciiBar(p.percentage, 18);
    const tag80 =
      p.cumulativePercentage <= 82
        ? `${ANSI.terracotta}[THỦ PHẠM 80/20]${ANSI.reset}`
        : '';
    console.log(
      `   ${bar} ${String(p.percentage).padStart(4, ' ')}% (Lũy kế ${String(
        p.cumulativePercentage
      ).padStart(5, ' ')}%) | ${ANSI.bold}${p.label}${ANSI.reset} ${tag80}`
    );
  }

  console.log(
    `\n${ANSI.bold}3. DANH SÁCH CÂU HỎI ĐẾN HẠN PHỤC THÙ HÔM NAY (${today}):${ANSI.reset}`
  );
  const dueLogs = logs.filter((l) => !l.isResolved && l.nextReviewDate <= today);
  if (dueLogs.length === 0) {
    console.log(
      `   ${ANSI.matcha}✓ Không còn câu hỏi nào tồn đọng hôm nay!${ANSI.reset}\n`
    );
  } else {
    dueLogs.forEach((item, idx) => {
      console.log(
        `   ${idx + 1}. ${ANSI.bold}[${item.subjectName} - ${item.topic}]${ANSI.reset} (Hộp ${item.leitnerBox})`
      );
      console.log(`      Đề : ${item.questionText.slice(0, 95)}...`);
      console.log(
        `      ${ANSI.ochre}NẾU:${ANSI.reset} ${item.ifTrigger} ${ANSI.matcha}-> THÌ:${ANSI.reset} ${item.thenAction}\n`
      );
    });
  }
}

function runChecklistCommand() {
  printBanner();
  const logs = getAllErrorLogs().filter(
    (l) => l.inPreExamChecklist || l.howActions.includes('H4')
  );
  console.log(
    `${ANSI.bold}${ANSI.matcha}TỜ CHECKLIST "CHỐNG SAI NGU" ĐỌC 5 PHÚT TRƯỚC GIỜ THI (${logs.length} quy tắc):${ANSI.reset}\n`
  );
  logs.forEach((item, idx) => {
    console.log(
      `${idx + 1}. ${ANSI.bold}[${item.subjectName} • ${item.topic}]${ANSI.reset} (Mã lỗi: ${item.whyCodes.join(
        ', '
      )})`
    );
    console.log(`   • ${ANSI.ochre}NẾU nhìn thấy :${ANSI.reset} ${item.ifTrigger}`);
    console.log(`   • ${ANSI.matcha}THÌ bắt buộc  :${ANSI.reset} ${item.thenAction}\n`);
  });
}

async function runQuickAddCommand() {
  printBanner();
  const rl = readline.createInterface({ input, output });

  try {
    console.log(`${ANSI.bold}Chọn môn học nhanh:${ANSI.reset}`);
    INITIAL_SUBJECTS.slice(0, 9).forEach((s, i) => {
      console.log(`  [${i + 1}] ${s.name} (${s.defaultTopics.slice(0, 2).join(', ')})`);
    });

    const subIdxRaw = await rl.question('\nNhập số thứ tự môn học (mặc định 1 - Toán THPT): ');
    const subIdx = Math.max(
      0,
      Math.min(8, (parseInt(subIdxRaw.trim(), 10) || 1) - 1)
    );
    const chosenSub = INITIAL_SUBJECTS[subIdx];

    const topic =
      (await rl.question(
        `Chuyên đề (Enter để chọn "${chosenSub.defaultTopics[0]}"): `
      )).trim() || chosenSub.defaultTopics[0];

    const questionText = await rl.question('Nội dung đề bài / câu bị sai: ');
    const myWrongStep = await rl.question('Bước biến đổi hoặc lựa chọn SAI của bạn: ');
    const correctSolution = await rl.question('Lời giải chuẩn / Đáp án đúng: ');

    console.log(
      `\n${ANSI.bold}Mã lỗi WHY phổ biến:${ANSI.reset} A1 (Sót từ khóa phủ định) | A3 (Nhầm dấu) | A7 (Quên ĐKXĐ) | B1 (Điểm mù) | C1 (Bẫy đáp án nhiễu)`
    );
    const whyInput =
      (await rl.question('Nhập mã lỗi WHY (cách nhau dấu phẩy, mặc định A1): '))
        .trim()
        .toUpperCase() || 'A1';

    const whyCodes = whyInput
      .split(',')
      .map((s) => s.trim() as WhyCode)
      .filter(Boolean);

    const primaryWhyDef = WHY_DICTIONARY.find((w) => w.code === whyCodes[0]);

    const ifTrigger =
      (
        await rl.question(
          `Quy tắc NẾU (Enter để dùng gợi ý: "${primaryWhyDef?.defaultIfTrigger.slice(
            0,
            50
          )}..."): `
        )
      ).trim() ||
      primaryWhyDef?.defaultIfTrigger ||
      `Gặp dạng bài ${topic}`;

    const thenAction =
      (
        await rl.question(
          `Hành động THÌ (Enter để dùng gợi ý: "${primaryWhyDef?.defaultThenAction.slice(
            0,
            50
          )}..."): `
        )
      ).trim() ||
      primaryWhyDef?.defaultThenAction ||
      'Khoanh tròn từ khóa giới hạn và kiểm tra điều kiện xác định ở dòng đầu tiên.';

    const now = new Date().toISOString();
    const today = getTodayDateString();

    const newItem: ErrorLogItem = {
      id: `err-cli-${Date.now()}`,
      createdAt: now,
      updatedAt: now,
      subjectId: chosenSub.id,
      subjectName: chosenSub.name,
      subjectGroup: chosenSub.group,
      topic,
      questionFormat: 'MCQ_4',
      processBreakpoint: 'STAGE_1_DECODE',
      difficulty: 3,
      timePressure: 'EXAM_PACE',
      questionText: questionText || '(Ghi nhanh qua Terminal CLI)',
      myWrongStep,
      correctSolution,
      references: [],
      whyCodes: whyCodes.length > 0 ? whyCodes : ['A1'],
      whyCustomNotes: 'Ghi nhanh qua công cụ dòng lệnh elog CLI',
      ifTrigger,
      thenAction,
      howActions: ['H1', 'H4'],
      inPreExamChecklist: true,
      twinQuestions: [],
      leitnerBox: 1,
      nextReviewDate: today,
      reviewCount: 0,
      isResolved: false,
    };

    upsertErrorLog(newItem);
    console.log(
      `\n${ANSI.bold}${ANSI.matcha}✓ Đã lưu thành công bản ghi [${newItem.id}] vào ./data/error_logs.db!${ANSI.reset}\n`
    );
  } finally {
    rl.close();
  }
}

async function main() {
  const cmd = (process.argv[2] || 'report').toLowerCase();
  if (cmd === 'add') {
    await runQuickAddCommand();
  } else if (cmd === 'checklist') {
    runChecklistCommand();
  } else {
    runReportCommand();
  }
}

void main();
