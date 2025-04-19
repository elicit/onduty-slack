import { z } from "zod";
import { LinearWebhooks } from "@linear/sdk";

export const BUG_LABEL_ID = "5b04a744-c7e8-4024-bc50-465cf1fb10f3";
export const USER_QUESTION_LABEL_ID = "4a1d862d-2f2e-4cf3-82c1-7c78257e2c7a";

export const LinearWebhookPayloadSchema = z.object({
  action: z.string(),
  type: z.string(),
  url: z.string(),
  data: z.object({
    id: z.string(),
    title: z.string(),
    priority: z.number(),
    labelIds: z.array(z.string()),
  }),
  updatedFrom: z
    .object({
      priority: z.number().optional(),
      labelIds: z.array(z.string()).optional(),
    })
    .optional(),
});

export type LinearWebhookPayload = z.infer<typeof LinearWebhookPayloadSchema>;

export function isRelevantLinearEvent(payload: LinearWebhookPayload): boolean {
  if (payload.type !== "Issue") {
    return false;
  }

  const isUrgent = payload.data.priority === 1;
  const hasRelevantLabel = payload.data.labelIds.some((id) => [BUG_LABEL_ID, USER_QUESTION_LABEL_ID].includes(id));

  if (payload.action === "create") {
    return isUrgent && hasRelevantLabel;
  }

  if (payload.action === "update" && payload.updatedFrom) {
    // If priority is not in updatedFrom, it means it hasn't changed
    const wasUrgent = payload.updatedFrom.priority === undefined ? isUrgent : payload.updatedFrom.priority === 1;
    // If labelIds is not in updatedFrom, it means labels haven't changed
    const hadRelevantLabel =
      payload.updatedFrom.labelIds === undefined
        ? hasRelevantLabel
        : payload.updatedFrom.labelIds.some((id) => [BUG_LABEL_ID, USER_QUESTION_LABEL_ID].includes(id));

    // Notify only if the issue became relevant (wasn't before and is now)
    return !(wasUrgent && hadRelevantLabel) && isUrgent && hasRelevantLabel;
  }

  return false;
}

export function verifyLinearWebhook(body: string, signature: string, timestamp: string): void {
  const webhookSecret = process.env.LINEAR_WEBHOOK_SECRET;
  if (!webhookSecret) {
    throw new Error("Missing LINEAR_WEBHOOK_SECRET environment variable");
  }

  const webhook = new LinearWebhooks(webhookSecret);
  webhook.verify(Buffer.from(body), signature, Number(timestamp));
}

export function parseLinearWebhookPayload(body: string): LinearWebhookPayload {
  const rawPayload = JSON.parse(body);

  // Parse and validate the payload using the Zod schema
  const payloadResult = LinearWebhookPayloadSchema.safeParse(rawPayload);
  if (!payloadResult.success) {
    throw new Error(`Invalid Linear webhook payload: ${payloadResult.error.message}`);
  }

  return payloadResult.data;
}
