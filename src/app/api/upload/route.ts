// File: src/app/api/upload/route.ts
import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { dataUrl, slot } = body as { dataUrl: string; slot?: 'problem' | 'solution' };

    if (!dataUrl || !dataUrl.startsWith('data:image/')) {
      return NextResponse.json(
        { ok: false, error: 'Dữ liệu ảnh Base64 không hợp lệ' },
        { status: 400 }
      );
    }

    const matches = dataUrl.match(/^data:image\/([a-zA-Z0-9+.-]+);base64,(.+)$/);
    if (!matches || matches.length !== 3) {
      return NextResponse.json(
        { ok: false, error: 'Không thể tách định dạng ảnh' },
        { status: 400 }
      );
    }

    const ext = matches[1] === 'jpeg' ? 'jpg' : matches[1];
    const base64Data = matches[2];
    const buffer = Buffer.from(base64Data, 'base64');

    const uploadsDir = path.join(process.cwd(), 'public', 'uploads');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    const filename = `${slot || 'img'}-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 7)}.${ext}`;
    const filePath = path.join(uploadsDir, filename);

    fs.writeFileSync(filePath, buffer);

    return NextResponse.json({
      ok: true,
      url: `/uploads/${filename}`,
      filename,
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: (error as Error).message },
      { status: 500 }
    );
  }
}