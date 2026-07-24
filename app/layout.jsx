export const metadata = {
  title: 'OmniSocial AI Command Center',
  description: 'Automated Cross-Platform Social Media Publishing Hub',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, padding: 0, backgroundColor: '#020617' }}>
        {children}
      </body>
    </html>
  );
}
