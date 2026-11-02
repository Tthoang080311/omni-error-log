// File: src/app/api/ai/route.ts
import { NextRequest, NextResponse } from 'next/server';
import {
  runAiForensicAutopsy,
  generateIsomorphicTwinQuestions,
} from '@/lib/ai-service';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { mode, payload } = body;

    if (mode === 'autopsy') {
      const autopsy = await runAiForensicAutopsy(payload);
      return NextResponse.json({ ok: true, autopsy });
    }

    if (mode === 'twins') {
      const twins = await generateIsomorphicTwinQuestions(payload);
      return NextResponse.json({ ok: true, twins });
    }

    return NextResponse.json(
      { ok: false, error: 'Chế độ AI không hợp lệ (chỉ hỗ trợ autopsy | twins)' },
      { status: 400 }
    );
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: (error as Error).message },
      { status: 500 }
    );
  }
}