import type { User, UserIdentity } from "@supabase/supabase-js";

import { getAccountSignIn, isApplePrivateRelayEmail } from "../account-sign-in";

function identity(provider: string, lastSignInAt?: string): UserIdentity {
  return {
    id: `${provider}-identity`,
    identity_id: `${provider}-identity`,
    user_id: "user-1",
    provider,
    identity_data: {},
    last_sign_in_at: lastSignInAt,
  };
}

function user(
  email: string | undefined,
  identities: UserIdentity[] | undefined
): Pick<User, "email" | "identities"> {
  return { email, identities };
}

describe("getAccountSignIn", () => {
  it("maps an email and password account", () => {
    expect(
      getAccountSignIn(
        user("anna@example.com", [
          identity("email", "2026-09-20T10:00:00.000Z"),
        ])
      )
    ).toEqual({
      email: "anna@example.com",
      isApplePrivateRelay: false,
      providers: ["email"],
      lastUsedProvider: null,
    });
  });

  it("flags an Apple hidden email and keeps the relay address", () => {
    expect(
      getAccountSignIn(
        user("x7k2p9@privaterelay.appleid.com", [
          identity("apple", "2026-09-20T10:00:00.000Z"),
        ])
      )
    ).toEqual({
      email: "x7k2p9@privaterelay.appleid.com",
      isApplePrivateRelay: true,
      providers: ["apple"],
      lastUsedProvider: null,
    });
  });

  it("maps a Google account", () => {
    expect(
      getAccountSignIn(user("anna@gmail.com", [identity("google")]))
    ).toMatchObject({
      email: "anna@gmail.com",
      isApplePrivateRelay: false,
      providers: ["google"],
    });
  });

  it("lists every linked method in display order and marks the last used one", () => {
    expect(
      getAccountSignIn(
        user("x7k2p9@privaterelay.appleid.com", [
          identity("email", "2026-09-01T08:00:00.000Z"),
          identity("google", "2026-09-24T18:30:00.000Z"),
          identity("apple", "2026-09-10T12:00:00.000Z"),
        ])
      )
    ).toEqual({
      email: "x7k2p9@privaterelay.appleid.com",
      isApplePrivateRelay: true,
      providers: ["email", "apple", "google"],
      lastUsedProvider: "google",
    });
  });

  it("leaves the last used method empty when no identity has a sign-in time", () => {
    expect(
      getAccountSignIn(
        user("anna@example.com", [identity("apple"), identity("email")])
      ).lastUsedProvider
    ).toBeNull();
  });

  it("ignores providers the app does not offer", () => {
    expect(
      getAccountSignIn(
        user("anna@example.com", [
          identity("github", "2026-09-25T10:00:00.000Z"),
          identity("email", "2026-09-20T10:00:00.000Z"),
          identity("apple", "2026-09-01T10:00:00.000Z"),
        ])
      )
    ).toMatchObject({
      providers: ["email", "apple"],
      lastUsedProvider: "email",
    });
  });

  it("handles a user without an email or identities", () => {
    expect(getAccountSignIn(user(undefined, undefined))).toEqual({
      email: null,
      isApplePrivateRelay: false,
      providers: [],
      lastUsedProvider: null,
    });
    expect(getAccountSignIn(user("  ", [])).email).toBeNull();
  });
});

describe("isApplePrivateRelayEmail", () => {
  it("matches the relay domain regardless of case", () => {
    expect(isApplePrivateRelayEmail("X7K2@PrivateRelay.AppleID.com")).toBe(
      true
    );
  });

  it("does not match lookalike domains", () => {
    expect(isApplePrivateRelayEmail("anna@appleid.com")).toBe(false);
    expect(
      isApplePrivateRelayEmail("anna@privaterelay.appleid.com.example.org")
    ).toBe(false);
  });
});
