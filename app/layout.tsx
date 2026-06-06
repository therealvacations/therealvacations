export const metadata = {
  title: 'The Real Vacations',
  description: 'All-inclusive group trips + flights, hotels & more',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
