import { Inter } from "next/font/google";
import "./globals.css";
import Navbar from "./components/NavBar";
import Footer from "./components/Footer";
import { AuthProvider } from "./contexts/AuthContext";
import { UserDataProvider } from "./contexts/UserDataContext";
import GlobalAuthModal from "./components/GlobalAuthModal";
import ServiceWorkerRegister from "./components/ServiceWorkerRegister";
import PullToRefresh from "./components/PullToRefresh";

const inter = Inter({ subsets: ["latin"] });

export const metadata = {
  title: "WatchHive",
  description: "Movies and TV Shows",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "WatchHive",
    statusBarStyle: "black-translucent",
  },
  themeColor: "#0a0a0a",
  icons: {
    icon: {
      url: "/beengie/beengie-logo.png",
      type: "image/png",
      sizes: "1385x1313",
    },
    shortcut: {
      url: "/beengie/beengie-logo.png",
      type: "image/png",
      sizes: "1385x1313",
    },
    apple: {
      url: "/beengie/beengie-logo.png",
      type: "image/png",
      sizes: "1385x1313",
    },
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={`${inter.className} flex flex-col min-h-screen`}>
        <AuthProvider>
          <UserDataProvider>
            <PullToRefresh>
              <Navbar />
              <main className="flex-grow">{children}</main>
              <Footer />
            </PullToRefresh>
            <GlobalAuthModal />
            <ServiceWorkerRegister />
          </UserDataProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
