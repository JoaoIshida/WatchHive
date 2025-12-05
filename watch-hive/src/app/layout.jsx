import { Inter } from "next/font/google";
import "./globals.css";
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import { AuthProvider } from "./contexts/AuthContext";
import GlobalAuthModal from "./components/GlobalAuthModal";

const inter = Inter({ subsets: ["latin"] });

export const metadata = {
  title: "WatchHive",
  description: "Movies and TV Shows",
  icons: {
    icon: {
      url: '/watchhive-icon.png',
      type: 'image/png',
      sizes: 'any',
    },
    shortcut: {
      url: '/watchhive-icon.png',
      type: 'image/png',
    },
    apple: {
      url: '/watchhive-icon.png',
      type: 'image/png',
    },
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={`${inter.className} flex flex-col min-h-screen`}>
        <AuthProvider>
          <Navbar />
          <main className="flex-grow">
          {children}
          </main>
          <Footer />
          <GlobalAuthModal />
        </AuthProvider>
      </body>
    </html>
  );
}
