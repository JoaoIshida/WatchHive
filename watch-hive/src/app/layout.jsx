import { Inter } from "next/font/google";
import "./globals.css";
import Navbar from "./components/NavBar";
import Footer from "./components/Footer";
import { AuthProvider } from "./contexts/AuthContext";
import { UserDataProvider } from "./contexts/UserDataContext";
import GlobalAuthModal from "./components/GlobalAuthModal";
import ServiceWorkerRegister from "./components/ServiceWorkerRegister";
import PullToRefresh from "./components/PullToRefresh";
import { getSiteUrl } from "./lib/siteUrl";
import {
  SITE_DESCRIPTION,
  SITE_NAME,
  SITE_OG_IMAGE_ALT,
  SITE_TITLE,
} from "./lib/siteMetadata";

const inter = Inter({ subsets: ["latin"] });

export const viewport = {
  themeColor: "#0a0a0a",
};

export const metadata = {
  metadataBase: new URL(getSiteUrl()),
  title: {
    default: SITE_TITLE,
    template: `%s | ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  manifest: "/manifest.webmanifest",
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "/",
    siteName: SITE_NAME,
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: SITE_OG_IMAGE_ALT,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    images: ["/opengraph-image"],
  },
  appleWebApp: {
    capable: true,
    title: SITE_NAME,
    statusBarStyle: "black-translucent",
  },
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
