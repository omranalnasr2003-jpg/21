import './globals.css'
export const metadata = {
  title: '21 – Das Kartenspiel',
  description: 'Klassisches 21er Kartenspiel – Online Multiplayer von Omran & Nyaz',
}
export default function RootLayout({ children }) {
  return (
    <html lang="de">
      <body>{children}</body>
    </html>
  )
}
