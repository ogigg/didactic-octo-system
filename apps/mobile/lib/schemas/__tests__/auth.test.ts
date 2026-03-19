import {
  forgotPasswordSchema,
  resetPasswordSchema,
  signInSchema,
  signUpSchema,
} from "../auth";

describe("signInSchema", () => {
  it("accepts valid email and password", () => {
    const result = signInSchema.safeParse({
      email: "user@example.com",
      password: "password123",
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid email", () => {
    const result = signInSchema.safeParse({
      email: "not-an-email",
      password: "password123",
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].message).toBe("errors.invalidEmail");
  });

  it("rejects password shorter than 8 characters", () => {
    const result = signInSchema.safeParse({
      email: "user@example.com",
      password: "short",
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].message).toBe("errors.passwordTooShort");
  });
});

describe("signUpSchema", () => {
  it("accepts matching passwords", () => {
    const result = signUpSchema.safeParse({
      email: "user@example.com",
      password: "password123",
      confirmPassword: "password123",
    });
    expect(result.success).toBe(true);
  });

  it("rejects mismatching passwords", () => {
    const result = signUpSchema.safeParse({
      email: "user@example.com",
      password: "password123",
      confirmPassword: "different123",
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].message).toBe("errors.passwordsMustMatch");
  });

  it("rejects invalid email", () => {
    const result = signUpSchema.safeParse({
      email: "bad-email",
      password: "password123",
      confirmPassword: "password123",
    });
    expect(result.success).toBe(false);
  });
});

describe("forgotPasswordSchema", () => {
  it("accepts valid email", () => {
    const result = forgotPasswordSchema.safeParse({
      email: "user@example.com",
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid email", () => {
    const result = forgotPasswordSchema.safeParse({ email: "bad" });
    expect(result.success).toBe(false);
  });
});

describe("resetPasswordSchema", () => {
  it("accepts matching passwords", () => {
    const result = resetPasswordSchema.safeParse({
      password: "newpassword123",
      confirmPassword: "newpassword123",
    });
    expect(result.success).toBe(true);
  });

  it("rejects mismatching passwords", () => {
    const result = resetPasswordSchema.safeParse({
      password: "newpassword123",
      confirmPassword: "different123",
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].message).toBe("errors.passwordsMustMatch");
  });
});
