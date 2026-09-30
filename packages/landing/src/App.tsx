import { Footer } from "./components/Footer";
import { Header } from "./components/Header";
import { Hero } from "./components/Hero";
import { HowItWorks } from "./components/HowItWorks";
import { TrustSection } from "./components/TrustSection";
import { WaitlistForm } from "./components/WaitlistForm";

export default function App() {
  return (
    <div className="site-shell">
      <Header />
      <main>
        <Hero />
        <HowItWorks />
        <TrustSection />
        <section className="waitlist-section" id="waitlist" aria-labelledby="waitlist-title">
          <div className="section-inner waitlist-layout">
            <div className="section-copy">
              <p className="eyebrow">Invitation only</p>
              <h2 id="waitlist-title">Already have a code?</h2>
              <p>
                Use the email tied to your invitation and complete the quick check to save your place.
              </p>
            </div>
            <WaitlistForm />
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
