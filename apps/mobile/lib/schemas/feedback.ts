import { z } from "zod";

export const feedbackSchema = z.object({
  type: z.enum(["bug_report", "feature_request"]),
  title: z.string().min(1).max(100),
  description: z.string().min(1).max(2000),
});

export type FeedbackFormData = z.infer<typeof feedbackSchema>;
