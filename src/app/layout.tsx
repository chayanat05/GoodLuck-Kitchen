import type { Metadata, Viewport } from "next";
import "./globals.css";

// 🌟 1. สร้างตัวแปร viewport แยกออกมาต่างหาก
export const viewport: Viewport = {
    themeColor: '#2563eb',
};

export const metadata: Metadata = {
    title: 'Rider App',
    description: 'ระบบจัดการออเดอร์',
    appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Rider App',
    },
}

export default function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
    <html lang="th">
        <body className="bg-gray-100">{children}</body>
    </html>
);
}
