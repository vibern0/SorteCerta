import { Footer } from "./components/Footer";
import { Header } from "./components/Header";
import { Hero } from "./components/Hero";
import { HowItWorks } from "./components/HowItWorks";
import { TrustSection } from "./components/TrustSection";

export default function App() {
  return (
    <div className="site-shell">
      <Header />
      <main>
        <Hero />
        <HowItWorks />
        <TrustSection />
      </main>
      <Footer />
    </div>
  );
}
