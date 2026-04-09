import { supabase } from "@/lib/supabase";
import type { FeedbackFormData } from "@/lib/schemas/feedback";

interface SendFeedbackRequest extends FeedbackFormData {
  app_version?: string;
  device_model?: string;
  os_version?: string;
  platform?: string;
}

export async function sendFeedback(
  request: SendFeedbackRequest
): Promise<void> {
  const { error } = await supabase.functions.invoke("send-feedback", {
    body: request,
  });

  if (error) {
    throw new Error(error.message);
  }
}
