import { createClient } from "npm:@supabase/supabase-js@2";
import { z } from "npm:zod@3";
import { corsHeaders, errorResponse, jsonResponse } from "../_shared/cors.ts";
import { reportOperationalEvent } from "../_shared/observability.ts";

const RESEND_API_URL = "https://api.resend.com/emails";
const FROM_EMAIL = "gierszon10@gmail.com";
const TO_EMAIL = "gierszon10@gmail.com";

const requestSchema = z.object({
  type: z.enum(["bug_report", "feature_request"]),
  title: z.string().min(1).max(100),
  description: z.string().min(1).max(2000),
  app_version: z.string().optional(),
  device_model: z.string().optional(),
  os_version: z.string().optional(),
  platform: z.string().optional(),
});

function buildEmailHtml(params: {
  userEmail: string;
  type: string;
  title: string;
  description: string;
  appVersion?: string;
  deviceModel?: string;
  osVersion?: string;
  platform?: string;
}): string {
  const {
    userEmail,
    type,
    title,
    description,
    appVersion,
    deviceModel,
    osVersion,
    platform,
  } = params;

  const typeLabel = type === "bug_report" ? "Bug Report" : "Feature Request";
  const typeColor = type === "bug_report" ? "#ef4444" : "#3b82f6";

  const deviceInfo = [
    appVersion && `App Version: ${appVersion}`,
    deviceModel && `Device Model: ${deviceModel}`,
    osVersion && `OS Version: ${osVersion}`,
    platform && `Platform: ${platform}`,
  ]
    .filter(Boolean)
    .join("<br>");

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1a1a1a; }
          .container { max-width: 600px; margin: 0 auto; padding: 24px; }
          .header { border-bottom: 2px solid #f3f4f6; padding-bottom: 16px; margin-bottom: 24px; }
          .type-badge { display: inline-block; padding: 4px 12px; border-radius: 999px; font-size: 14px; font-weight: 600; margin-bottom: 12px; }
          .title { font-size: 24px; font-weight: 700; margin: 0; }
          .section { margin-bottom: 24px; }
          .section-title { font-size: 14px; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 8px; }
          .section-content { background: #f9fafb; padding: 16px; border-radius: 8px; font-size: 15px; }
          .footer { margin-top: 32px; padding-top: 16px; border-top: 1px solid #f3f4f6; font-size: 12px; color: #6b7280; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <span class="type-badge" style="background-color: ${typeColor}; color: white;">${typeLabel}</span>
            <h1 class="title">${title}</h1>
          </div>
          
          <div class="section">
            <div class="section-title">User</div>
            <div class="section-content">
              <strong>Email:</strong> ${userEmail}
            </div>
          </div>
          
          <div class="section">
            <div class="section-title">Description</div>
            <div class="section-content">
              ${description.replace(/\n/g, "<br>")}
            </div>
          </div>
          
          ${
            deviceInfo
              ? `
          <div class="section">
            <div class="section-title">Device Information</div>
            <div class="section-content">
              ${deviceInfo}
            </div>
          </div>
          `
              : ""
          }
          
          <div class="footer">
            <div style="margin-bottom: 8px;">
              <strong>Feedback ID:</strong> {{feedback_id}}<br>
              <strong>Submitted:</strong> ${new Date().toISOString()}
            </div>
            <div>This feedback was submitted via the Workout App mobile application.</div>
          </div>
        </div>
      </body>
    </html>
  `;
}

Deno.serve(async (req: Request) => {
  const deliveryStartedAt = Date.now();
  let observedUserId: string | undefined;

  console.log("[send-feedback] Request received", {
    method: req.method,
    url: req.url,
  });

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders() });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return errorResponse("Missing authorization header", 401);
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const token = authHeader.replace("Bearer ", "");
    const {
      data: { user },
      error: authError,
    } = await supabaseClient.auth.getUser(token);

    if (authError || !user) {
      return errorResponse("Unauthorized", 401);
    }
    observedUserId = user.id;

    const body = await req.json();
    const parsed = requestSchema.safeParse(body);
    if (!parsed.success) {
      reportOperationalEvent({
        area: "feedback",
        operation: "feedback_delivery",
        outcome: "failure",
        journeyStage: "profile",
        userId: observedUserId,
        durationMs: Date.now() - deliveryStartedAt,
        failureCode: "request_validation_failed",
      });
      return errorResponse(
        `Invalid request: ${parsed.error.issues.map((i) => i.message).join(", ")}`,
        400
      );
    }

    const {
      type,
      title,
      description,
      app_version,
      device_model,
      os_version,
      platform,
    } = parsed.data;

    const { data: feedback, error: insertError } = await supabaseClient
      .from("feedback")
      .insert({
        user_id: user.id,
        type,
        title,
        description,
        app_version: app_version ?? null,
        device_model: device_model ?? null,
        os_version: os_version ?? null,
        platform: platform ?? null,
        status: "open",
      })
      .select("id")
      .single();

    if (insertError || !feedback) {
      console.error("[send-feedback] Database insert error:", insertError);
      reportOperationalEvent({
        area: "feedback",
        operation: "feedback_delivery",
        outcome: "failure",
        journeyStage: "profile",
        userId: observedUserId,
        durationMs: Date.now() - deliveryStartedAt,
        failureCode: "database_insert_failed",
      });
      return errorResponse("Failed to save feedback", 500);
    }

    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      console.error("[send-feedback] RESEND_API_KEY not configured");
      reportOperationalEvent({
        area: "feedback",
        operation: "feedback_delivery",
        outcome: "failure",
        journeyStage: "profile",
        userId: observedUserId,
        durationMs: Date.now() - deliveryStartedAt,
        failureCode: "email_provider_not_configured",
      });
      return errorResponse("Email service not configured", 500);
    }

    const emailHtml = buildEmailHtml({
      userEmail: user.email ?? "unknown",
      type,
      title,
      description,
      appVersion: app_version,
      deviceModel: device_model,
      osVersion: os_version,
      platform,
    }).replace("{{feedback_id}}", feedback.id);

    const emailResponse = await fetch(RESEND_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: [TO_EMAIL],
        subject: `[Workout App] ${type === "bug_report" ? "Bug Report" : "Feature Request"}: ${title}`,
        html: emailHtml,
      }),
    });

    if (!emailResponse.ok) {
      console.error("[send-feedback] Resend API error", {
        status: emailResponse.status,
      });
      reportOperationalEvent({
        area: "feedback",
        operation: "feedback_delivery",
        outcome: "failure",
        journeyStage: "profile",
        userId: observedUserId,
        durationMs: Date.now() - deliveryStartedAt,
        failureCode: "email_provider_failed",
      });
      return errorResponse("Failed to send email notification", 500);
    }

    console.log("[send-feedback] Success!", {
      feedbackId: feedback.id,
      userId: user.id,
      type,
    });
    reportOperationalEvent({
      area: "feedback",
      operation: "feedback_delivery",
      outcome: "success",
      journeyStage: "profile",
      userId: observedUserId,
      durationMs: Date.now() - deliveryStartedAt,
    });

    return jsonResponse({ success: true, id: feedback.id });
  } catch (err) {
    console.error("[send-feedback] Unhandled error:", err);
    reportOperationalEvent({
      area: "feedback",
      operation: "feedback_delivery",
      outcome: "failure",
      journeyStage: "profile",
      userId: observedUserId,
      durationMs: Date.now() - deliveryStartedAt,
      failureCode: "unhandled_exception",
    });
    return errorResponse("Internal server error", 500);
  }
});
