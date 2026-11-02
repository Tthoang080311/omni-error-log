// File: src/app/layout.tsx
import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Omni-Subject Smart Error Log | Botanical Paper Studio',
  description:
    'Trạm Phân tích Lỗi sai Đa môn học, Chẩn đoán Nhận thức AI & Lặp lại Ngắt quãng Leitner',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="vi">
      <body className="min-h-screen bg-botanical-canvas text-botanical-ink antialiased">
        {children}
      </body>
    </html>
  );
}