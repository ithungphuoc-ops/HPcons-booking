import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "HP Cons Booking",
  description: "Đặt lịch tài nguyên nội bộ — Công ty Cổ phần Đầu tư Hưng Phước",
  icons: { icon: "/logo.png" },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="vi"
      className={`${geistSans.variable} ${geistMono.variable} h-full`}
    >
      <head>
        {/* Đọc lựa chọn sáng/tối đã lưu (20/07/2026) TRƯỚC khi React hydrate —
            tránh nháy sai theme 1 khắc lúc tải trang. Không có lựa chọn lưu
            sẵn -> mặc định theo hệ điều hành. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('booking-theme');if(t==='dark'||(!t&&window.matchMedia('(prefers-color-scheme: dark)').matches))document.documentElement.classList.add('dark');}catch(e){}})();`,
          }}
        />
      </head>
      <body className="min-h-full flex flex-col">
        {children}
        {/* Bong bóng góp ý/báo lỗi xuyên suốt hệ sinh thái (27/07/2026) — app
            thí điểm đầu tiên. File phục vụ từ app tổng, không cần code riêng
            ở đây ngoài đúng 1 dòng này (xem change cross-app-feedback-widget
            ở repo hpcons-portal). URL lấy từ env — mặc định production, đổi
            NEXT_PUBLIC_FEEDBACK_WIDGET_URL trong .env.local để trỏ về app
            tổng chạy local lúc test, không cần sửa/revert code. */}
        <script
          src={process.env.NEXT_PUBLIC_FEEDBACK_WIDGET_URL || 'https://account.hpcore.vn/feedback-widget.js'}
          data-app="Booking"
          async
        />
      </body>
    </html>
  );
}
