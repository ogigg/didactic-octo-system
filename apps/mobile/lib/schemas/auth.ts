import { z } from "zod";

export const signInSchema = z.object({
  email: z.string().email("errors.invalidEmail"),
  password: z.string().min(8, "errors.passwordTooShort"),
});

export const signUpSchema = z
  .object({
    email: z.string().email("errors.invalidEmail"),
    password: z.string().min(8, "errors.passwordTooShort"),
    confirmPassword: z.string().min(8, "errors.passwordTooShort"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "errors.passwordsMustMatch",
    path: ["confirmPassword"],
  });

export const forgotPasswordSchema = z.object({
  email: z.string().email("errors.invalidEmail"),
});

export const resetPasswordSchema = z
  .object({
    password: z.string().min(8, "errors.passwordTooShort"),
    confirmPassword: z.string().min(8, "errors.passwordTooShort"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "errors.passwordsMustMatch",
    path: ["confirmPassword"],
  });

export type SignInFormData = z.infer<typeof signInSchema>;
export type SignUpFormData = z.infer<typeof signUpSchema>;
export type ForgotPasswordFormData = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordFormData = z.infer<typeof resetPasswordSchema>;
export type AuthValidationKey =
  | "errors.invalidEmail"
  | "errors.passwordTooShort"
  | "errors.passwordsMustMatch";
