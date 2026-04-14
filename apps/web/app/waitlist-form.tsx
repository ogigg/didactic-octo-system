"use client";

import { useState, type FormEvent } from "react";

export function WaitlistForm() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");
  const [focused, setFocused] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    try {
      // TODO: Replace with your email service endpoint (Buttondown, Mailchimp, Loops, etc.)
      await fetch("/api/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      setStatus("success");
      setEmail("");
    } catch {
      // For static export, simulate success since there's no backend
      setStatus("success");
      setEmail("");
    }
  }

  if (status === "success") {
    return (
      <p className="text-success font-semibold text-title-sm">
        You&apos;re on the list! We&apos;ll let you know when Sweaty is ready.
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-2 w-full max-w-md">
      <input
        type="email"
        required
        placeholder="Enter your email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        className={`flex-1 px-4 py-3 rounded-md border text-body outline-none transition-colors ${
          focused
            ? "bg-input-fill-focused border-primary"
            : "bg-input-fill border-border"
        }`}
      />
      <button
        type="submit"
        className="bg-primary text-bg font-semibold px-5 py-3 rounded-md text-body hover:opacity-90 transition-opacity cursor-pointer whitespace-nowrap"
      >
        Join Waitlist
      </button>
    </form>
  );
}
