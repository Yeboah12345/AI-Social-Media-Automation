import './globals.css'

export const metadata = {
  title: 'AI Social Media Automation',
  description: 'Automated video post generator - OmniSocial AI Command Center',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head />
      <body>
        {children}
      </body>
    </html>
  )
}
