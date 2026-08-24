import type { Metadata } from "next";import "./globals.css";
export const metadata:Metadata={title:"منصة كدان للأداء والمبادرات الاستراتيجية",description:"مركز كدان المؤسسي لإدارة الاستراتيجية والأداء والمبادرات"};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="ar" dir="rtl"><body>{children}</body></html>}
