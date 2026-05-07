import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Delete Account | Sweaty",
  description: "Account deletion instructions for Sweaty.",
};

export default function DeleteAccountPage() {
  return (
    <main className="min-h-screen px-6 py-16">
      <article className="mx-auto flex max-w-3xl flex-col gap-8">
        <header className="flex flex-col gap-3">
          <a href="/" className="text-caption text-primary hover:text-text">
            Sweaty
          </a>
          <h1 className="text-display-sm font-bold tracking-tight">
            Delete Account
          </h1>
          <p className="text-caption text-text-muted">
            Last updated: May 7, 2026
          </p>
        </header>

        <section className="flex flex-col gap-3 text-body text-text-secondary">
          <h2 className="text-title-md font-semibold text-text">
            Request deletion
          </h2>
          <p>
            To request deletion of your Sweaty account and associated personal
            information, email{" "}
            <a href="mailto:hello@sweaty.app" className="text-primary">
              hello@sweaty.app
            </a>{" "}
            from the email address connected to your account.
          </p>
        </section>

        <section className="flex flex-col gap-3 text-body text-text-secondary">
          <h2 className="text-title-md font-semibold text-text">
            What to include
          </h2>
          <p>
            Please include the subject line &quot;Delete my Sweaty account&quot;
            and any account details needed to identify your account. We may ask
            for verification before processing the request.
          </p>
        </section>

        <section className="flex flex-col gap-3 text-body text-text-secondary">
          <h2 className="text-title-md font-semibold text-text">
            What is deleted
          </h2>
          <p>
            We will delete or de-identify account information and workout data
            associated with your account, except where retention is required for
            security, legal, tax, accounting, or dispute-resolution purposes.
          </p>
        </section>

        <section className="flex flex-col gap-3 text-body text-text-secondary">
          <h2 className="text-title-md font-semibold text-text">Timing</h2>
          <p>
            We aim to respond to deletion requests within a reasonable time
            after verifying the account owner.
          </p>
        </section>
      </article>
    </main>
  );
}
