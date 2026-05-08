export const metadata = {
  title: "AIインフラ株 判断くん",
  description: "日本株の短期売買判断アプリ",
}

export default function RootLayout({ children }) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  )
}