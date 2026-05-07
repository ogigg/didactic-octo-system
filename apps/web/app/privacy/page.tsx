import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy | Sweaty",
  description: "Starter privacy policy for Sweaty.",
};

export default function PrivacyPage() {
  return (
    <main className="min-h-screen px-6 py-16">
      <article className="mx-auto flex max-w-3xl flex-col gap-8">
        <header className="flex flex-col gap-3">
          <a href="/" className="text-caption text-primary hover:text-text">
            Sweaty
          </a>
          <h1 className="text-display-sm font-bold tracking-tight">
            Privacy Policy
          </h1>
          <p className="text-caption text-text-muted">
            Last updated: May 7, 2026
          </p>
        </header>

        <section className="flex flex-col gap-3 text-body text-text-secondary">
          <h2 className="text-title-md font-semibold text-text">
            Information we collect
          </h2>
          <p>
            Sweaty may collect account details, workout preferences, workout
            history, device information, and support messages you choose to
            provide. This helps us operate the app, improve workout generation,
            and respond to support requests.
          </p>
        </section>

        <section className="flex flex-col gap-3 text-body text-text-secondary">
          <h2 className="text-title-md font-semibold text-text">
            How we use information
          </h2>
          <p>
            We use information to provide and improve Sweaty, personalize
            workouts, maintain security, troubleshoot issues, and communicate
            about the service. We do not sell personal information.
          </p>
        </section>

        <section className="flex flex-col gap-3 text-body text-text-secondary">
          <h2 className="text-title-md font-semibold text-text">
            Third-party services
          </h2>
          <p>
            Sweaty may use service providers for hosting, authentication,
            analytics, communications, and AI-assisted workout generation. These
            providers process information only as needed to support the service.
          </p>
        </section>

        <section className="flex flex-col gap-3 text-body text-text-secondary">
          <h2 className="text-title-md font-semibold text-text">
            Your choices
          </h2>
          <p>
            You may request access, correction, export, or deletion of your
            account information by contacting us. Account deletion instructions
            are available on the Delete Account page.
          </p>
        </section>

        <section className="flex flex-col gap-3 text-body text-text-secondary">
          <h2 className="text-title-md font-semibold text-text">Contact</h2>
          <p>
            For privacy questions, contact{" "}
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
