import "./globals.css";

// 🌟 1. สร้างตัวแปร viewport แยกออกมาต่างหาก
export const viewport = {
    themeColor: '#2563eb',
    };
export const metadata = {
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
