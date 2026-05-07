import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service | Sweaty",
  description: "Starter terms of service for Sweaty.",
};

export default function TermsPage() {
  return (
    <main className="min-h-screen px-6 py-16">
      <article className="mx-auto flex max-w-3xl flex-col gap-8">
        <header className="flex flex-col gap-3">
          <a href="/" className="text-caption text-primary hover:text-text">
            Sweaty
          </a>
          <h1 className="text-display-sm font-bold tracking-tight">
            Terms of Service
          </h1>
          <p className="text-caption text-text-muted">
            Last updated: May 7, 2026
          </p>
        </header>

        <section className="flex flex-col gap-3 text-body text-text-secondary">
          <h2 className="text-title-md font-semibold text-text">
            Use of Sweaty
          </h2>
          <p>
            Sweaty provides workout planning and logging tools. You are
            responsible for using the service safely and for making sure any
            workout is appropriate for your health, ability, and environment.
          </p>
        </section>

        <section className="flex flex-col gap-3 text-body text-text-secondary">
          <h2 className="text-title-md font-semibold text-text">
            Fitness guidance
          </h2>
          <p>
            Sweaty is not medical advice and is not a substitute for a qualified
            healthcare, fitness, or safety professional. Stop exercising and
            seek professional guidance if you feel pain, dizziness, or other
            concerning symptoms.
          </p>
        </section>

        <section className="flex flex-col gap-3 text-body text-text-secondary">
          <h2 className="text-title-md font-semibold text-text">
            Accounts and content
          </h2>
          <p>
            You are responsible for the information you provide and for keeping
            your account secure. Do not use Sweaty for unlawful, harmful, or
            abusive activity.
          </p>
        </section>

        <section className="flex flex-col gap-3 text-body text-text-secondary">
          <h2 className="text-title-md font-semibold text-text">
            Changes and availability
          </h2>
          <p>
            Sweaty may change over time, and features may be added, changed, or
            removed. We may update these terms by posting a revised version.
          </p>
        </section>

        <section className="flex flex-col gap-3 text-body text-text-secondary">
          <h2 className="text-title-md font-semibold text-text">Contact</h2>
          <p>
            For questions about these terms, contact{" "}
            <a href="mailto:hello@sweaty.app" className="text-primary">
              hello@sweaty.app
            </a>
            .
          </p>
        </section>
      </article>
    </main>
  );
}
