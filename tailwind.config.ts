// File: tailwind.config.ts
import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        botanical: {
          canvas: '#F4F6F0',        // Nền chính: Kem Giấy Nhám pha trà xanh nhạt
          surface: '#FAFBF8',       // Nền thẻ & Khung làm việc: Trắng Ngà
          mossMist: '#E6ECE2',      // Nền phụ: Sương Mù Rêu
          border: '#D0DBD0',        // Đường viền 1px Xanh Xám Đá
          borderHover: '#8FA998',   // Viền khi hover
          sage: '#2C4C3E',          // Màu chủ đạo (Primary Brand): Xanh Rêu Rừng / Deep Sage
          eucalyptus: '#52796F',    // Màu nhấn phụ (Secondary Accent): Xanh Khuynh Diệp
          chipBg: '#D8E6DF',        // Nền thẻ chip khi được chọn: Xanh Ngọc Bích Nhạt
          chipText: '#1B3B2B',      // Chữ thẻ chip khi được chọn
          ink: '#1C2822',           // Chữ chính: Than Chì Rêu Đậm
          muted: '#5A6B60',         // Chữ phụ/chú thích: Xám Lá Khô
          terracotta: '#C85A3B',    // Lỗi sai / Bút khoanh vùng / Nhóm Ẩu: Đỏ Đất Nung
          terracottaBg: '#F9EBE7',  // Nền nhạt Đỏ Đất Nung
          ochre: '#D48C2A',         // Cảnh báo / Sập bẫy đề: Vàng Nghệ Trầm
          ochreBg: '#FDF4E7',       // Nền nhạt Vàng Nghệ Trầm
          matcha: '#3B7A57',        // Thành công / Đã khắc phục: Xanh Lá Trà
          matchaBg: '#E5F2EA',      // Nền nhạt Xanh Lá Trà
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        serif: ['Georgia', 'Cambria', '"Times New Roman"', 'serif'],
        mono: ['"JetBrains Mono"', 'Menlo', 'Monaco', 'Consolas', 'monospace'],
      },
      boxShadow: {
        paper: '0 2px 8px -2px rgba(28, 40, 34, 0.06), 0 1px 3px -1px rgba(28, 40, 34, 0.04)',
        elevated: '0 12px 28px -6px rgba(28, 40, 34, 0.12), 0 4px 10px -3px rgba(28, 40, 34, 0.06)',
      },
    },
  },
  plugins: [],
};

export default config;