// File: src/components/CommandPalette.tsx
'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  Search,
  PlusCircle,
  BarChart3,
  RotateCw,
  Sparkles,
  Download,
  CheckSquare,
  X,
  CornerDownLeft,
} from 'lucide-react';
import { INITIAL_SUBJECTS } from '@/constants/taxonomy';

export interface CommandActionItem {
  id: string;
  title: string;
  subtitle: string;
  shortcut?: string;
  category: 'NAVIGATION' | 'AI_ACTION' | 'SUBJECT_FILTER' | 'EXPORT';
  onSelect: () => void;
}

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onSwitchTab: (tab: 'WORKSTATION' | 'ANALYTICS' | 'REVIEW' | 'CHECKLIST') => void;
  onTriggerAiAutopsy: () => void;
  onExportAnkiCsv: () => void;
  onFilterSubject: (subjectId: string | 'ALL') => void;
}

export default function CommandPalette({
  isOpen,
  onClose,
  onSwitchTab,
  onTriggerAiAutopsy,
  onExportAnkiCsv,
  onFilterSubject,
}: CommandPaletteProps) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);

  const actions: CommandActionItem[] = useMemo(() => {
    const baseActions: CommandActionItem[] = [
      {
        id: 'nav-workstation',
        title: 'Mở Trạm Nhập Lỗi 3 Chiều (WHAT - WHY - HOW)',
        subtitle: 'Ghi nhận lỗi sai mới, dán ảnh Cmd+V và khoanh Bút Đỏ Đất Nung',
        shortcut: 'G W',
        category: 'NAVIGATION',
        onSelect: () => onSwitchTab('WORKSTATION'),
      },
      {
        id: 'nav-analytics',
        title: 'Mở Dashboard Phân tích Pareto 80/20 & Chỉ số "Thuế Ẩu"',
        subtitle: 'Xem tỷ lệ mất điểm oan do lỗi cơ học Nhóm A và điểm gãy quy trình',
        shortcut: 'G A',
        category: 'NAVIGATION',
        onSelect: () => onSwitchTab('ANALYTICS'),
      },
      {
        id: 'nav-review',
        title: 'Bắt đầu Chế độ Phục Thù (Redemption Review - Leitner SRS)',
        subtitle: 'Ẩn lời giải, tự giải lại các câu đến hạn ôn tập hôm nay',
        shortcut: 'G R',
        category: 'NAVIGATION',
        onSelect: () => onSwitchTab('REVIEW'),
      },
      {
        id: 'nav-checklist',
        title: 'Mở Tờ Checklist "Chống Sai Ngu" 5 Phút Trước Giờ Thi',
        subtitle: 'Tổng hợp toàn bộ phản xạ NẾU - THÌ đã ghim [H4]',
        shortcut: 'G C',
        category: 'NAVIGATION',
        onSelect: () => onSwitchTab('CHECKLIST'),
      },
      {
        id: 'ai-autopsy-now',
        title: 'Chạy AI Khám Nghiệm Lỗi Sai 1-Click ngay bây giờ',
        subtitle: 'Phân tích lỗ hổng nhận thức từ ảnh chụp đề bài & tự sinh quy tắc NẾU-THÌ',
        shortcut: 'Cmd+J',
        category: 'AI_ACTION',
        onSelect: () => onTriggerAiAutopsy(),
      },
      {
        id: 'export-anki-csv',
        title: 'Xuất toàn bộ Lỗi sai ra file Flashcard Anki (.csv)',
        subtitle: 'Tải xuống file CSV chuẩn 2 mặt để Import 1-Click vào Anki',
        shortcut: 'Cmd+E',
        category: 'EXPORT',
        onSelect: () => onExportAnkiCsv(),
      },
      {
        id: 'filter-all',
        title: 'Hiển thị Tất cả Môn học',
        subtitle: 'Xóa bộ lọc môn học hiện tại',
        category: 'SUBJECT_FILTER',
        onSelect: () => onFilterSubject('ALL'),
      },
    ];

    const subjectFilters: CommandActionItem[] = INITIAL_SUBJECTS.map((sub) => ({
      id: `filter-${sub.id}`,
      title: `Lọc theo môn: ${sub.name}`,
      subtitle: `${sub.groupLabel} — ${sub.defaultTopics.slice(0, 3).join(', ')}`,
      category: 'SUBJECT_FILTER',
      onSelect: () => onFilterSubject(sub.id),
    }));

    return [...baseActions, ...subjectFilters];
  }, [onSwitchTab, onTriggerAiAutopsy, onExportAnkiCsv, onFilterSubject]);

  const filteredActions = useMemo(() => {
    if (!query.trim()) return actions;
    const q = query.toLowerCase();
    return actions.filter(
      (a) =>
        a.title.toLowerCase().includes(q) || a.subtitle.toLowerCase().includes(q)
    );
  }, [actions, query]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query, isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) =>
          filteredActions.length > 0 ? (prev + 1) % filteredActions.length : 0
        );
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) =>
          filteredActions.length > 0
            ? (prev - 1 + filteredActions.length) % filteredActions.length
            : 0
        );
      } else if (e.key === 'Enter' && filteredActions[selectedIndex]) {
        e.preventDefault();
        filteredActions[selectedIndex].onSelect();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, filteredActions, selectedIndex, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-botanical-ink/40 pt-20 backdrop-blur-[2px]">
      <div className="w-full max-w-2xl overflow-hidden rounded-xl border border-botanical-border bg-botanical-surface shadow-elevated">
        {/* Thanh tìm kiếm lệnh */}
        <div className="flex items-center border-b border-botanical-border bg-botanical-canvas px-4 py-3">
          <Search className="mr-3 h-4 w-4 text-botanical-eucalyptus" />
          <input
            type="text"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Gõ lệnh nhanh, tên môn học (Toán, IELTS, Hóa, SAT...) hoặc thao tác AI..."
            className="w-full bg-transparent text-sm text-botanical-ink placeholder-botanical-muted focus:outline-none"
          />
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-botanical-muted hover:bg-botanical-mossMist hover:text-botanical-ink"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Danh sách kết quả */}
        <div className="max-h-[380px] overflow-y-auto p-2">
          {filteredActions.length === 0 ? (
            <div className="py-8 text-center text-xs text-botanical-muted">
              Không tìm thấy lệnh phù hợp với &ldquo;{query}&rdquo;
            </div>
          ) : (
            filteredActions.map((item, idx) => {
              const isSelected = idx === selectedIndex;
              return (
                <button
                  key={item.id}
                  type="button"
                  onMouseEnter={() => setSelectedIndex(idx)}
                  onClick={() => {
                    item.onSelect();
                    onClose();
                  }}
                  className={`flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left transition ${
                    isSelected
                      ? 'bg-botanical-chipBg text-botanical-chipText'
                      : 'text-botanical-ink hover:bg-botanical-mossMist/60'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-botanical-border bg-botanical-surface text-botanical-sage">
                      {item.category === 'NAVIGATION' && (
                        <BarChart3 className="h-3.5 w-3.5" />
                      )}
                      {item.category === 'AI_ACTION' && (
                        <Sparkles className="h-3.5 w-3.5 text-botanical-terracotta" />
                      )}
                      {item.category === 'EXPORT' && (
                        <Download className="h-3.5 w-3.5 text-botanical-matcha" />
                      )}
                      {item.category === 'SUBJECT_FILTER' && (
                        <CheckSquare className="h-3.5 w-3.5 text-botanical-eucalyptus" />
                      )}
                    </span>
                    <div>
                      <div className="text-xs font-semibold">{item.title}</div>
                      <div className="text-[11px] text-botanical-muted">
                        {item.subtitle}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {item.shortcut && (
                      <kbd className="rounded border border-botanical-border bg-botanical-surface px-1.5 py-0.5 font-mono text-[10px] text-botanical-muted">
                        {item.shortcut}
                      </kbd>
                    )}
                    {isSelected && (
                      <CornerDownLeft className="h-3.5 w-3.5 text-botanical-sage" />
                    )}
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* Footer hướng dẫn phím tắt */}
        <div className="flex items-center justify-between border-t border-botanical-border bg-botanical-canvas px-4 py-2 text-[11px] text-botanical-muted">
          <div className="flex items-center gap-3">
            <span>
              <strong className="font-mono text-botanical-ink">↑↓</strong> Di chuyển
            </span>
            <span>
              <strong className="font-mono text-botanical-ink">Enter</strong> Thực thi
            </span>
            <span>
              <strong className="font-mono text-botanical-ink">1-9</strong> Chọn nhanh thẻ WHY
            </span>
          </div>
          <span>Botanical Paper Studio UX</span>
        </div>
      </div>
    </div>
  );
}