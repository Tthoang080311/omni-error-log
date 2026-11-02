// File: src/components/ReferenceLocator.tsx
'use client';

import React, { useState } from 'react';
import { ReferenceItem } from '@/types/error-log';
import {
  Youtube,
  Globe,
  BookOpen,
  Plus,
  Trash2,
  ExternalLink,
  Clock,
} from 'lucide-react';

interface ReferenceLocatorProps {
  references: ReferenceItem[];
  onChange: (nextRefs: ReferenceItem[]) => void;
}

export function parseYoutubeTimestampSeconds(
  rawUrl: string,
  manualTimeInput: string
): number | undefined {
  // 1. Nếu người dùng nhập mm:ss hoặc số giây vào ô mốc thời gian
  if (manualTimeInput.trim()) {
    const cleaned = manualTimeInput.trim();
    if (/^\d+:\d{1,2}(:\d{1,2})?$/.test(cleaned)) {
      const parts = cleaned.split(':').map(Number);
      if (parts.length === 2) return parts[0] * 60 + parts[1];
      if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
    }
    const numeric = parseInt(cleaned.replace(/[^\d]/g, ''), 10);
    if (!isNaN(numeric) && numeric > 0) return numeric;
  }

  // 2. Tự động nhận diện từ URL (?t=150s, &t=425, ?start=90)
  try {
    const urlObj = new URL(rawUrl);
    const tParam = urlObj.searchParams.get('t') || urlObj.searchParams.get('start');
    if (tParam) {
      const minSecMatch = tParam.match(/(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s?)?/i);
      if (minSecMatch && (minSecMatch[1] || minSecMatch[2] || minSecMatch[3])) {
        const h = parseInt(minSecMatch[1] || '0', 10);
        const m = parseInt(minSecMatch[2] || '0', 10);
        const s = parseInt(minSecMatch[3] || '0', 10);
        const total = h * 3600 + m * 60 + s;
        if (total > 0) return total;
      }
      const pureNum = parseInt(tParam, 10);
      if (!isNaN(pureNum) && pureNum > 0) return pureNum;
    }
  } catch {
    return undefined;
  }
  return undefined;
}

export function formatSecondsToMinSec(seconds?: number): string {
  if (!seconds || seconds <= 0) return '';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}

export function buildDeepYoutubeUrl(url?: string, seconds?: number): string {
  if (!url) return '#';
  if (!seconds || seconds <= 0) return url;
  try {
    const u = new URL(url);
    u.searchParams.set('t', `${seconds}s`);
    return u.toString();
  } catch {
    return url;
  }
}

export default function ReferenceLocator({
  references,
  onChange,
}: ReferenceLocatorProps) {
  const [activeTab, setActiveTab] = useState<'YOUTUBE' | 'BOOK_PDF' | 'URL'>('YOUTUBE');
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [timeInput, setTimeInput] = useState('');
  const [bookName, setBookName] = useState('');
  const [pageNumber, setPageNumber] = useState('');
  const [questionNumber, setQuestionNumber] = useState('');

  const handleAddReference = () => {
    if (activeTab === 'YOUTUBE' && !url.trim()) return;
    if (activeTab === 'URL' && !url.trim()) return;
    if (activeTab === 'BOOK_PDF' && !bookName.trim()) return;

    const detectedSec =
      activeTab === 'YOUTUBE'
        ? parseYoutubeTimestampSeconds(url, timeInput)
        : undefined;

    const newItem: ReferenceItem = {
      id: `ref-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      type: activeTab,
      title:
        title.trim() ||
        (activeTab === 'YOUTUBE'
          ? 'Video bài giảng chữa chi tiết'
          : activeTab === 'BOOK_PDF'
          ? `${bookName.trim()} (Tr.${pageNumber || '?'} - ${questionNumber || '?'})`
          : 'Đề thi / Tài liệu Online'),
      url: activeTab !== 'BOOK_PDF' ? url.trim() : undefined,
      youtubeTimestampSec: detectedSec,
      bookName: activeTab === 'BOOK_PDF' ? bookName.trim() : undefined,
      pageNumber: activeTab === 'BOOK_PDF' ? pageNumber.trim() : undefined,
      questionNumber: activeTab === 'BOOK_PDF' ? questionNumber.trim() : undefined,
    };

    onChange([...references, newItem]);
    setTitle('');
    setUrl('');
    setTimeInput('');
    setBookName('');
    setPageNumber('');
    setQuestionNumber('');
  };

  const handleRemove = (id: string) => {
    onChange(references.filter((r) => r.id !== id));
  };

  return (
    <div className="rounded-lg border border-botanical-border bg-botanical-surface p-3">
      <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wider text-botanical-sage">
            Định vị Nguồn Đề & Video Chữa Bài (Smart Reference Locator)
          </h4>
          <p className="text-[11px] text-botanical-muted">
            Lưu chính xác giây thầy cô chữa trên YouTube hoặc số trang sách/PDF để tra lại trong 1 giây
          </p>
        </div>

        <div className="flex rounded-md border border-botanical-border bg-botanical-canvas p-0.5 text-[11px]">
          <button
            type="button"
            onClick={() => setActiveTab('YOUTUBE')}
            className={`inline-flex items-center gap-1 rounded px-2 py-1 font-medium transition ${
              activeTab === 'YOUTUBE'
                ? 'bg-botanical-sage text-white'
                : 'text-botanical-ink hover:bg-botanical-mossMist'
            }`}
          >
            <Youtube className="h-3 w-3" /> YouTube (?t=)
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('BOOK_PDF')}
            className={`inline-flex items-center gap-1 rounded px-2 py-1 font-medium transition ${
              activeTab === 'BOOK_PDF'
                ? 'bg-botanical-sage text-white'
                : 'text-botanical-ink hover:bg-botanical-mossMist'
            }`}
          >
            <BookOpen className="h-3 w-3" /> Sách / PDF
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('URL')}
            className={`inline-flex items-center gap-1 rounded px-2 py-1 font-medium transition ${
              activeTab === 'URL'
                ? 'bg-botanical-sage text-white'
                : 'text-botanical-ink hover:bg-botanical-mossMist'
            }`}
          >
            <Globe className="h-3 w-3" /> Link Đề Online
          </button>
        </div>
      </div>

      {/* Khung nhập theo loại nguồn */}
      {activeTab === 'YOUTUBE' && (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-12">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Tên bài giảng (VD: Chữa đề Minh họa Câu 42)"
            className="rounded border border-botanical-border bg-botanical-canvas px-2.5 py-1.5 text-xs text-botanical-ink focus:border-botanical-sage focus:outline-none sm:col-span-4"
          />
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="Dán link YouTube (hỗ trợ tự nhận ?t=150s)..."
            className="rounded border border-botanical-border bg-botanical-canvas px-2.5 py-1.5 text-xs text-botanical-ink focus:border-botanical-sage focus:outline-none sm:col-span-5"
          />
          <input
            type="text"
            value={timeInput}
            onChange={(e) => setTimeInput(e.target.value)}
            placeholder="Mốc giờ (VD: 07:05)"
            className="rounded border border-botanical-border bg-botanical-canvas px-2.5 py-1.5 text-xs text-botanical-ink focus:border-botanical-sage focus:outline-none sm:col-span-2"
          />
          <button
            type="button"
            onClick={handleAddReference}
            className="inline-flex items-center justify-center gap-1 rounded bg-botanical-sage px-2.5 py-1.5 text-xs font-medium text-white hover:opacity-95 sm:col-span-1"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {activeTab === 'BOOK_PDF' && (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-12">
          <input
            type="text"
            value={bookName}
            onChange={(e) => setBookName(e.target.value)}
            placeholder="Tên Sách / File PDF (VD: Cambridge IELTS 18, Đề Sở HN)"
            className="rounded border border-botanical-border bg-botanical-canvas px-2.5 py-1.5 text-xs text-botanical-ink focus:border-botanical-sage focus:outline-none sm:col-span-6"
          />
          <input
            type="text"
            value={pageNumber}
            onChange={(e) => setPageNumber(e.target.value)}
            placeholder="Trang số (VD: Tr. 64)"
            className="rounded border border-botanical-border bg-botanical-canvas px-2.5 py-1.5 text-xs text-botanical-ink focus:border-botanical-sage focus:outline-none sm:col-span-2"
          />
          <input
            type="text"
            value={questionNumber}
            onChange={(e) => setQuestionNumber(e.target.value)}
            placeholder="Câu số (VD: Câu 38)"
            className="rounded border border-botanical-border bg-botanical-canvas px-2.5 py-1.5 text-xs text-botanical-ink focus:border-botanical-sage focus:outline-none sm:col-span-3"
          />
          <button
            type="button"
            onClick={handleAddReference}
            className="inline-flex items-center justify-center gap-1 rounded bg-botanical-sage px-2.5 py-1.5 text-xs font-medium text-white hover:opacity-95 sm:col-span-1"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {activeTab === 'URL' && (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-12">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Tiêu đề tài liệu / phòng thi online"
            className="rounded border border-botanical-border bg-botanical-canvas px-2.5 py-1.5 text-xs text-botanical-ink focus:border-botanical-sage focus:outline-none sm:col-span-5"
          />
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://..."
            className="rounded border border-botanical-border bg-botanical-canvas px-2.5 py-1.5 text-xs text-botanical-ink focus:border-botanical-sage focus:outline-none sm:col-span-6"
          />
          <button
            type="button"
            onClick={handleAddReference}
            className="inline-flex items-center justify-center gap-1 rounded bg-botanical-sage px-2.5 py-1.5 text-xs font-medium text-white hover:opacity-95 sm:col-span-1"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Danh sách các nguồn tham chiếu đã đính kèm */}
      {references.length > 0 && (
        <div className="mt-2.5 flex flex-wrap gap-2">
          {references.map((ref) => (
            <div
              key={ref.id}
              className="inline-flex items-center gap-2 rounded-md border border-botanical-border bg-botanical-mossMist/60 px-2.5 py-1 text-xs text-botanical-ink"
            >
              {ref.type === 'YOUTUBE' && (
                <Youtube className="h-3.5 w-3.5 shrink-0 text-botanical-terracotta" />
              )}
              {ref.type === 'BOOK_PDF' && (
                <BookOpen className="h-3.5 w-3.5 shrink-0 text-botanical-sage" />
              )}
              {ref.type === 'URL' && (
                <Globe className="h-3.5 w-3.5 shrink-0 text-botanical-eucalyptus" />
              )}

              <span className="font-medium">{ref.title}</span>

              {ref.type === 'YOUTUBE' && ref.youtubeTimestampSec && (
                <a
                  href={buildDeepYoutubeUrl(ref.url, ref.youtubeTimestampSec)}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 rounded bg-botanical-terracottaBg px-1.5 py-0.5 font-mono text-[11px] font-semibold text-botanical-terracotta hover:underline"
                  title="Mở YouTube nhảy thẳng tới đúng giây chữa câu này"
                >
                  <Clock className="h-2.5 w-2.5" />
                  {formatSecondsToMinSec(ref.youtubeTimestampSec)}
                </a>
              )}

              {ref.url && (
                <a
                  href={buildDeepYoutubeUrl(ref.url, ref.youtubeTimestampSec)}
                  target="_blank"
                  rel="noreferrer"
                  className="text-botanical-eucalyptus hover:text-botanical-sage"
                  title="Mở liên kết gốc"
                >
                  <ExternalLink className="h-3 w-3" />
                </a>
              )}

              <button
                type="button"
                onClick={() => handleRemove(ref.id)}
                className="text-botanical-muted hover:text-botanical-terracotta"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}