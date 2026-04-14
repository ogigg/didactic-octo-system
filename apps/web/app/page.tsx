import { WaitlistForm } from "./waitlist-form";
import { ScrollAnimate } from "./scroll-animate";

const painPoints = [
  {
    icon: "⏱",
    title: "More planning than training",
    description:
      "You spend 20 minutes building a workout before you even touch a barbell.",
  },
  {
    icon: "📋",
    title: "Cookie-cutter programs",
    description:
      "Generic plans that ignore your schedule, equipment, and how you actually feel today.",
  },
  {
    icon: "🗂",
    title: "Exercise libraries, not programs",
    description:
      "Most apps give you a database and call it programming. You still do all the work.",
  },
];

const steps = [
  {
    num: "01",
    title: "Set your preferences",
    description:
      "Goals, equipment, schedule, experience level — tell the app what you're working with.",
  },
  {
    num: "02",
    title: "Get your workout",
    description:
      "A personalized session is generated for you. No browsing, no assembling — it's ready.",
  },
  {
    num: "03",
    title: "Train and adapt",
    description:
      "Log your session, and the app learns. Next workout is smarter than the last.",
  },
];

const features = [
  {
    icon: "🧠",
    title: "AI-powered generation",
    description:
      "Every workout is built from scratch based on your profile, not pulled from a template library.",
  },
  {
    icon: "📈",
    title: "Adapts to your progress",
    description:
      "The app adjusts intensity, volume, and exercise selection based on how you train.",
  },
  {
    icon: "🏋️",
    title: "Works with your setup",
    description:
      "Home gym, commercial gym, limited equipment — workouts fit what you have access to.",
  },
  {
    icon: "⚡",
    title: "Built for the gym",
    description:
      "Clean, fast interface designed for mid-set use. No scrolling through feeds between sets.",
  },
  {
    icon: "🚫",
    title: "No generic subscriptions",
    description:
      "You're not paying for someone else's program. Every session is yours.",
  },
];

// TODO: Replace with real testimonials
const testimonials = [
  {
    quote:
      "I used to spend Sunday nights planning my whole week. Now I just show up and the workout is there.",
    name: "Alex R.",
    label: "Beta tester",
  },
  {
    quote:
      "Finally an app that understands I only have dumbbells and 40 minutes. The workouts actually make sense.",
    name: "Jordan M.",
    label: "Beta tester",
  },
  {
    quote:
      "The progression feels natural — not too aggressive, not too easy. Like having a coach who actually listens.",
    name: "Sam K.",
    label: "Beta tester",
  },
];

export default function Home() {
  return (
    <main className="overflow-x-hidden">
      {/* Hero */}
      <section className="relative min-h-screen flex items-center justify-center px-6 py-24">
        {/* Ambient glow */}
        <div
          className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full pointer-events-none"
          style={{
            background:
              "radial-gradient(circle, rgba(56,152,216,0.07) 0%, transparent 70%)",
          }}
        />
        <div className="relative z-10 max-w-3xl mx-auto text-center flex flex-col items-center gap-10">
          <div className="flex flex-col gap-5">
            <h1 className="text-display-lg font-bold tracking-tight">
              Your workout is already waiting.
            </h1>
            <p className="text-text-secondary text-title-md max-w-xl mx-auto">
              AI-generated workouts built around your goals, equipment, and
              schedule. Just open the app and train.
            </p>
          </div>

          <WaitlistForm />

          {/* Store badges placeholder */}
          <div className="flex gap-4 items-center flex-wrap justify-center">
            {/* TODO: Replace with actual App Store / Play Store badge links */}
            <div className="px-5 py-3 rounded-md bg-bg-subtle border border-border text-text-muted text-caption select-none">
              App Store — Coming Soon
            </div>
            <div className="px-5 py-3 rounded-md bg-bg-subtle border border-border text-text-muted text-caption select-none">
              Google Play — Coming Soon
            </div>
          </div>

          {/* Phone mockup placeholder */}
          <div className="mt-10 w-[280px] h-[560px] rounded-[40px] border-2 border-border bg-bg-elevated flex items-center justify-center overflow-hidden">
            {/* TODO: Replace with actual app screenshot */}
            <div
              className="w-full h-full flex items-center justify-center"
              style={{
                background:
                  "linear-gradient(135deg, var(--color-primary-surface) 0%, var(--color-bg-elevated) 50%, var(--color-primary-container) 100%)",
              }}
            >
              <span className="text-primary text-display-sm font-bold opacity-50">
                Sweaty
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Pain Points */}
      <ScrollAnimate>
        <section className="px-6 py-24 max-w-4xl mx-auto">
          <h2 className="text-display-sm font-bold text-center mb-12 tracking-tight">
            Sound familiar?
          </h2>
          <div className="grid gap-8 md:grid-cols-3">
            {painPoints.map((p) => (
              <div key={p.title} className="text-center flex flex-col gap-3">
                <span className="text-4xl" role="img" aria-label={p.title}>
                  {p.icon}
                </span>
                <h3 className="text-title-md font-semibold">{p.title}</h3>
                <p className="text-text-secondary text-body">{p.description}</p>
              </div>
            ))}
          </div>
        </section>
      </ScrollAnimate>

      {/* How It Works */}
      <ScrollAnimate>
        <section className="px-6 py-24 max-w-4xl mx-auto">
          <h2 className="text-display-sm font-bold text-center mb-12 tracking-tight">
            How it works
          </h2>
          <div className="grid gap-8 md:grid-cols-3">
            {steps.map((s) => (
              <div
                key={s.num}
                className="bg-bg-subtle border border-border rounded-lg p-8 flex flex-col gap-3"
              >
                <span className="text-primary font-bold text-display-sm">
                  {s.num}
                </span>
                <h3 className="text-title-md font-semibold">{s.title}</h3>
                <p className="text-text-secondary text-body">{s.description}</p>
              </div>
            ))}
          </div>
        </section>
      </ScrollAnimate>

      {/* Features */}
      <ScrollAnimate>
        <section className="px-6 py-24 max-w-5xl mx-auto">
          <h2 className="text-display-sm font-bold text-center mb-12 tracking-tight">
            Built different
          </h2>
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((f) => (
              <div
                key={f.title}
                className="bg-bg-elevated border border-border-subtle rounded-lg p-8 flex flex-col gap-3"
              >
                <span className="text-3xl" role="img" aria-label={f.title}>
                  {f.icon}
                </span>
                <h3 className="text-title-sm font-semibold">{f.title}</h3>
                <p className="text-text-secondary text-body">{f.description}</p>
              </div>
            ))}
          </div>
        </section>
      </ScrollAnimate>

      {/* Testimonials */}
      <ScrollAnimate>
        <section className="px-6 py-24 max-w-4xl mx-auto">
          <h2 className="text-display-sm font-bold text-center mb-12 tracking-tight">
            What testers are saying
          </h2>
          <div className="grid gap-8 md:grid-cols-3">
            {testimonials.map((t) => (
              <div
                key={t.name}
                className="bg-bg-elevated border border-border-subtle rounded-lg p-8 flex flex-col gap-4"
              >
                <p className="text-body text-text italic">
                  &ldquo;{t.quote}&rdquo;
                </p>
                <div>
                  <p className="text-title-sm font-semibold">{t.name}</p>
                  <p className="text-caption text-text-muted">{t.label}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      </ScrollAnimate>

      {/* Final CTA */}
      <section className="relative px-6 py-24">
        {/* Ambient glow */}
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full pointer-events-none"
          style={{
            background:
              "radial-gradient(circle, rgba(56,152,216,0.06) 0%, transparent 70%)",
          }}
        />
        <div className="relative z-10 max-w-xl mx-auto text-center flex flex-col items-center gap-8">
          <h2 className="text-display-sm font-bold tracking-tight">
            Be the first to train smarter.
          </h2>
          <p className="text-text-secondary text-body">
            Join the waitlist and get early access when Sweaty launches.
          </p>
          <WaitlistForm />
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-bg-subtle border-t border-border-subtle px-6 py-10">
        <div className="max-w-4xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
          <span className="text-title-md font-bold text-primary">Sweaty</span>
          <nav className="flex gap-6 text-caption text-text-muted">
            {/* TODO: Replace with actual policy page URLs */}
            <a href="/privacy" className="hover:text-text transition-colors">
              Privacy Policy
            </a>
            <a href="/terms" className="hover:text-text transition-colors">
              Terms of Service
            </a>
            {/* TODO: Replace with actual contact email */}
            <a
              href="mailto:hello@sweaty.app"
              className="hover:text-text transition-colors"
            >
              Contact
            </a>
          </nav>
          <p className="text-caption text-text-disabled">
            &copy; {new Date().getFullYear()} Sweaty. All rights reserved.
          </p>
        </div>
      </footer>
    </main>
  );
}
