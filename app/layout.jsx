export const metadata = {
  title: 'AI Social Media Automation',
  description: 'Automated video post generator - OmniSocial AI Command Center',
}

export default function RootLayout({ children }) {
  const globalCss = `
    :root { --bg: #020617; --panel: #0f172a; --muted: #64748b; --accent: #38bdf8; --text: #f8fafc; }
    html, body, #__next { height: 100%; margin: 0; padding: 0; background: var(--bg); color: var(--text); font-family: Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial; }
    img, video, canvas { max-width: 100%; height: auto; }
  `;

  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <style dangerouslySetInnerHTML={{ __html: globalCss }} />
      </head>
      <body>
        {children}
      </body>
    </html>
  )
}
