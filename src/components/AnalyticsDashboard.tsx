// File: src/components/AnalyticsDashboard.tsx
'use client';

import React from 'react';
import { DashboardAnalytics } from '@/types/error-log';
import { WHY_GROUPS_META } from '@/constants/taxonomy';
import {
  AlertOctagon,
  BarChart3,
  Filter,
  CheckCircle2,
  Flame,
  TrendingUp,
} from 'lucide-react';

interface AnalyticsDashboardProps {
  analytics: DashboardAnalytics;
  onSelectWhyFilter?: (whyCode: string) => void;
}

export default function AnalyticsDashboard({
  analytics,
  onSelectWhyFilter,
}: AnalyticsDashboardProps) {
  // Tìm nhóm 20% nguyên nhân đầu bảng tạo ra tới ~80% tổng số lỗi sai
  const vitalFewCauses = analytics.paretoWhyDistribution.filter(
    (item, idx) => idx === 0 || item.cumulativePercentage <= 82
  );

  return (
    <div className="space-y-6">
      {/* 1. BANNER CHỈ SỐ "THUẾ ẨU" (CARELESS MISTAKE TAX) & TỔNG QUAN */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <div className="rounded-xl border border-botanical-terracotta/60 bg-botanical-terracottaBg p-5 shadow-paper lg:col-span-7">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-2">
              <span className="inline-flex items-center gap-1.5 rounded-md bg-botanical-terracotta px-2.5 py-0.5 font-mono text-[11px] font-bold uppercase tracking-wider text-white">
                <AlertOctagon className="h-3.5 w-3.5" /> CHỈ SỐ &ldquo;THUẾ ẨU&rdquo; (CARELESS MISTAKE TAX)
              </span>
              <h2 className="text-lg font-extrabold leading-snug text-botanical-ink">
                &ldquo;Bạn đang tự vứt đi{' '}
                <span className="underline decoration-botanical-terracotta decoration-2">
                  {analytics.carelessTaxPercent}%
                </span>{' '}
                số điểm chỉ vì lỗi ẩu chứ không phải vì không biết làm.&rdquo;
              </h2>
              <p className="text-xs leading-relaxed text-botanical-muted">
                Chỉ số này đo lường tỷ lệ các câu bạn hoàn toàn đủ kiến thức để giải đúng nhưng lại mất điểm do{' '}
                <strong className="text-botanical-terracotta">
                  Nhóm A (Đọc sót từ khóa phủ định, nhầm đơn vị, chuyển vế quên đổi dấu, bấm Casio sai hoặc quên ĐKXĐ)
                </strong>
                . Chỉ cần triệt tiêu Nhóm A bằng quy tắc NẾU-THÌ, điểm số của bạn sẽ tăng tức thì mà chưa cần học thêm kiến thức mới.
              </p>
            </div>

            <div className="flex h-24 w-24 shrink-0 flex-col items-center justify-center rounded-2xl border-2 border-botanical-terracotta bg-botanical-surface text-botanical-terracotta shadow-sm">
              <span className="font-mono text-2xl font-black">
                {analytics.carelessTaxPercent}%
              </span>
              <span className="text-[10px] font-bold uppercase">Thuế Ẩu</span>
            </div>
          </div>
        </div>

        {/* 3 Thẻ chỉ số nhanh */}
        <div className="grid grid-cols-3 gap-3 lg:col-span-5">
          <div className="botanical-paper-card flex flex-col justify-between rounded-xl p-4">
            <span className="text-[11px] font-semibold uppercase text-botanical-muted">
              Tổng Lỗi Đã Mổ Xẻ
            </span>
            <div className="mt-2 font-mono text-3xl font-extrabold text-botanical-ink">
              {analytics.totalLogs}
            </div>
            <span className="mt-1 text-[11px] text-botanical-eucalyptus">
              Bản ghi 3 chiều
            </span>
          </div>

          <div className="botanical-paper-card flex flex-col justify-between rounded-xl p-4">
            <span className="text-[11px] font-semibold uppercase text-botanical-ochre">
              Đến Hạn Phục Thù
            </span>
            <div className="mt-2 flex items-baseline gap-1 font-mono text-3xl font-extrabold text-botanical-ochre">
              {analytics.dueTodayCount}
              <Flame className="h-5 w-5" />
            </div>
            <span className="mt-1 text-[11px] text-botanical-muted">
              Cần giải lại hôm nay
            </span>
          </div>

          <div className="botanical-paper-card flex flex-col justify-between rounded-xl p-4">
            <span className="text-[11px] font-semibold uppercase text-botanical-matcha">
              Đã Triệt Tiêu
            </span>
            <div className="mt-2 flex items-baseline gap-1 font-mono text-3xl font-extrabold text-botanical-matcha">
              {analytics.resolvedCount}
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <span className="mt-1 text-[11px] text-botanical-muted">
              Đạt Hộp Leitner 4-5
            </span>
          </div>
        </div>
      </div>

      {/* 2. BIỂU ĐỒ PARETO 80/20 & PHỄU ĐIỂM GÃY QUY TRÌNH */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        {/* Biểu đồ Pareto 80/20 (7/12 cột) */}
        <div className="botanical-paper-card rounded-xl p-5 xl:col-span-7">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-botanical-border pb-3">
            <div>
              <span className="inline-flex items-center gap-1 rounded bg-botanical-sage px-2 py-0.5 font-mono text-[10px] font-bold uppercase text-white">
                <TrendingUp className="h-3 w-3" /> PARETO 80/20 DIAGNOSTICS
              </span>
              <h3 className="mt-1 text-sm font-bold text-botanical-ink">
                Biểu đồ Pareto 80/20: Thủ phạm Gốc gây ra 80% Lỗi sai
              </h3>
            </div>
            <span className="rounded-md bg-botanical-mossMist px-2.5 py-1 text-[11px] font-semibold text-botanical-sage">
              Tiêu diệt {vitalFewCauses.length} mã đầu bảng để xóa sổ ~80% lỗi
            </span>
          </div>

          {analytics.paretoWhyDistribution.length === 0 ? (
            <p className="py-8 text-center text-xs text-botanical-muted">
              Chưa có dữ liệu thống kê WHY.
            </p>
          ) : (
            <div className="space-y-3">
              {analytics.paretoWhyDistribution.map((item) => {
                const groupMeta = WHY_GROUPS_META[item.group];
                const isVital80 = item.cumulativePercentage <= 82;

                return (
                  <div
                    key={item.code}
                    onClick={() => onSelectWhyFilter && onSelectWhyFilter(item.code)}
                    className="group cursor-pointer rounded-lg border border-botanical-border bg-botanical-canvas/70 p-2.5 transition hover:border-botanical-sage"
                  >
                    <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2 text-xs">
                      <div className="flex items-center gap-2">
                        <span
                          className="rounded px-1.5 py-0.5 font-mono text-[10px] font-bold text-white"
                          style={{ backgroundColor: groupMeta.badgeBg }}
                        >
                          {item.code}
                        </span>
                        <span className="font-semibold text-botanical-ink group-hover:underline">
                          {item.label}
                        </span>
                        {isVital80 && (
                          <span className="rounded bg-botanical-terracottaBg px-1.5 py-0.5 font-mono text-[10px] font-bold text-botanical-terracotta">
                            Trọng tâm 80/20
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-3 font-mono text-xs">
                        <span className="font-bold text-botanical-ink">
                          {item.count} lần ({item.percentage}%)
                        </span>
                        <span className="text-[11px] text-botanical-muted">
                          Lũy kế: {item.cumulativePercentage}%
                        </span>
                      </div>
                    </div>

                    {/* Thanh tiến trình kép: Tỷ lệ đơn lẻ + Đường lũy kế Pareto */}
                    <div className="relative h-2.5 w-full overflow-hidden rounded-full bg-botanical-mossMist">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${Math.max(6, item.percentage)}%`,
                          backgroundColor: groupMeta.badgeBg,
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Phễu Điểm Gãy Quy Trình & Phân rã theo Môn học (5/12 cột) */}
        <div className="space-y-6 xl:col-span-5">
          {/* Phễu Điểm Gãy Quy Trình */}
          <div className="botanical-paper-card rounded-xl p-5">
            <div className="mb-3 border-b border-botanical-border pb-2.5">
              <span className="inline-flex items-center gap-1 rounded bg-botanical-eucalyptus px-2 py-0.5 font-mono text-[10px] font-bold uppercase text-white">
                <Filter className="h-3 w-3" /> PROCESS BREAKPOINT FUNNEL
              </span>
              <h3 className="mt-1 text-sm font-bold text-botanical-ink">
                Phễu Điểm Gãy Quy Trình Tư Duy (Giai đoạn 1 &rarr; 4)
              </h3>
              <p className="text-[11px] text-botanical-muted">
                Xác định xem chuỗi xử lý thông tin của bạn hay đứt gãy ở khâu nào nhất
              </p>
            </div>

            <div className="space-y-3">
              {analytics.breakpointFunnel.map((stageItem, idx) => (
                <div
                  key={stageItem.stage}
                  className="rounded-lg border border-botanical-border bg-botanical-canvas p-3"
                >
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="font-bold text-botanical-ink">
                      {stageItem.label}
                    </span>
                    <span className="font-mono font-bold text-botanical-sage">
                      {stageItem.count} lỗi ({stageItem.percentage}%)
                    </span>
                  </div>
                  <div className="h-2.5 w-full overflow-hidden rounded-full bg-botanical-mossMist">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${Math.max(4, stageItem.percentage)}%`,
                        backgroundColor:
                          idx === 0
                            ? '#C85A3B'
                            : idx === 1
                            ? '#2C4C3E'
                            : idx === 2
                            ? '#D48C2A'
                            : '#3B7A57',
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Bảng phân rã Thuế Ẩu vs Hổng Kiến Thức theo từng môn */}
          <div className="botanical-paper-card rounded-xl p-5">
            <div className="mb-3 border-b border-botanical-border pb-2.5">
              <span className="inline-flex items-center gap-1 rounded bg-botanical-sage px-2 py-0.5 font-mono text-[10px] font-bold uppercase text-white">
                <BarChart3 className="h-3 w-3" /> SUBJECT TAXONOMY
              </span>
              <h3 className="mt-1 text-sm font-bold text-botanical-ink">
                Tỷ trọng &ldquo;Thuế Ẩu&rdquo; vs &ldquo;Hổng Kiến Thức&rdquo; theo Môn
              </h3>
            </div>

            <div className="space-y-3">
              {analytics.subjectCarelessBreakdown.map((sub) => (
                <div
                  key={sub.subjectName}
                  className="rounded-lg border border-botanical-border bg-botanical-canvas p-3 text-xs"
                >
                  <div className="mb-1.5 flex items-center justify-between">
                    <span className="font-bold text-botanical-ink">
                      {sub.subjectName} ({sub.total} câu)
                    </span>
                    <span className="rounded bg-botanical-terracottaBg px-2 py-0.5 font-mono text-[11px] font-bold text-botanical-terracotta">
                      Thuế Ẩu: {sub.carelessPercent}%
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-3 text-[11px] text-botanical-muted">
                    <span className="text-botanical-terracotta">
                      • Nhóm A (Ẩu): <strong>{sub.carelessCount}</strong>
                    </span>
                    <span className="text-botanical-sage">
                      • Nhóm B (Kiến thức): <strong>{sub.knowledgeCount}</strong>
                    </span>
                    <span className="text-botanical-ochre">
                      • Nhóm C (Sập bẫy): <strong>{sub.trapCount}</strong>
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}