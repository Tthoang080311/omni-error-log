import { NextRequest, NextResponse } from 'next/server';
import {
  getAllErrorLogs,
  upsertErrorLog,
  deleteErrorLog,
  updateLeitnerReview,
  computeDashboardAnalytics,
  getTodayDateString,
} from '@/lib/db';
import { ErrorLogItem } from '@/types/error-log';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(req: NextRequest) {
  try {
    const logs = await getAllErrorLogs(req.headers);
    const analytics = computeDashboardAnalytics(logs);
    return NextResponse.json({ ok: true, logs, analytics });
  } catch (error) {
    return NextResponse.json({ ok: false, error: (error as Error).message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const now = new Date().toISOString();
    const today = getTodayDateString();
    const leitnerBox = (body.leitnerBox || 1) as 1 | 2 | 3 | 4 | 5;

    const newItem: ErrorLogItem = {
      id: body.id || `err-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      createdAt: body.createdAt || now,
      updatedAt: now,
      subjectId: body.subjectId || 'math-thpt',
      subjectName: body.subjectName || 'Toán THPT',
      subjectGroup: body.subjectGroup || 'STEM',
      topic: body.topic || 'Chuyên đề chung',
      questionFormat: body.questionFormat || 'MCQ_4',
      processBreakpoint: body.processBreakpoint || 'STAGE_1_DECODE',
      difficulty: body.difficulty || 3,
      timePressure: body.timePressure || 'EXAM_PACE',
      questionText: body.questionText || '',
      myWrongStep: body.myWrongStep || '',
      correctSolution: body.correctSolution || '',
      problemImageUrl: body.problemImageUrl || undefined,
      solutionImageUrl: body.solutionImageUrl || undefined,
      references: Array.isArray(body.references) ? body.references : [],
      whyCodes: Array.isArray(body.whyCodes) ? body.whyCodes : ['A1'],
      whyCustomNotes: body.whyCustomNotes || '',
      ifTrigger: body.ifTrigger || '',
      thenAction: body.thenAction || '',
      howActions: Array.isArray(body.howActions) ? body.howActions : ['H1'],
      inPreExamChecklist: Boolean(body.inPreExamChecklist || (Array.isArray(body.howActions) && body.howActions.includes('H4'))),
      aiAutopsy: body.aiAutopsy || undefined,
      twinQuestions: Array.isArray(body.twinQuestions) ? body.twinQuestions : [],
      leitnerBox,
      nextReviewDate: body.nextReviewDate || today,
      reviewCount: body.reviewCount ?? 0,
      isResolved: Boolean(body.isResolved),
    };

    const saved = await upsertErrorLog(newItem, req.headers);
    const logs = await getAllErrorLogs(req.headers);
    const analytics = computeDashboardAnalytics(logs);

    return NextResponse.json({ ok: true, item: saved, logs, analytics });
  } catch (error) {
    return NextResponse.json({ ok: false, error: (error as Error).message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, action, rememberedCorrectly, updatedItem } = body;

    if (action === 'review' && id) {
      const item = await updateLeitnerReview(id, Boolean(rememberedCorrectly), req.headers);
      const logs = await getAllErrorLogs(req.headers);
      const analytics = computeDashboardAnalytics(logs);
      return NextResponse.json({ ok: true, item, logs, analytics });
    }

    if (updatedItem && updatedItem.id) {
      const saved = await upsertErrorLog({ ...updatedItem, updatedAt: new Date().toISOString() }, req.headers);
      const logs = await getAllErrorLogs(req.headers);
      const analytics = computeDashboardAnalytics(logs);
      return NextResponse.json({ ok: true, item: saved, logs, analytics });
    }

    return NextResponse.json({ ok: false, error: 'Thiếu tham số' }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ ok: false, error: (error as Error).message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ ok: false, error: 'Thiếu ID' }, { status: 400 });
    await deleteErrorLog(id, req.headers);
    const logs = await getAllErrorLogs(req.headers);
    const analytics = computeDashboardAnalytics(logs);
    return NextResponse.json({ ok: true, logs, analytics });
  } catch (error) {
    return NextResponse.json({ ok: false, error: (error as Error).message }, { status: 500 });
  }
}
