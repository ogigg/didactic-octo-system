import { z } from "zod";

export const feedbackSchema = z.object({
  type: z.enum(["bug_report", "feature_request"]),
  title: z
    .string()
    .min(1, "validation.titleRequired")
    .max(100, "validation.titleTooLong"),
  description: z
    .string()
    .min(1, "validation.descriptionRequired")
    .max(2000, "validation.descriptionTooLong"),
});

export type FeedbackFormData = z.infer<typeof feedbackSchema>;
export type FeedbackValidationKey =
  | "validation.titleRequired"
  | "validation.titleTooLong"
  | "validation.descriptionRequired"
  | "validation.descriptionTooLong";
