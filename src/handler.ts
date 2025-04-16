import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { isRelevantLinearEvent, verifyLinearWebhook, parseLinearWebhookPayload } from "./linear";
import { setUrgentChannelTopic, notifyOnDutyUserInSlack } from "./slack";
import { LINEAR_WEBHOOK_TS_FIELD } from "@linear/sdk";
import { getOnDutyUser } from "./pagerduty";

export const BUG_LABEL_ID = "5b04a744-c7e8-4024-bc50-465cf1fb10f3";
export const USER_QUESTION_LABEL_ID = "4a1d862d-2f2e-4cf3-82c1-7c78257e2c7a";

export const syncOnCall = async (_event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  const onDutyUser = await getOnDutyUser();
  const newTopic = `On-duty engineer (during working hours): ${onDutyUser.name}`;
  await setUrgentChannelTopic(newTopic);

  return {
    statusCode: 200,
    body: JSON.stringify({ success: true }),
  };
};

export const handleLinearWebhook = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    console.log("Received Linear webhook event:", event);
    const body = event.body || "{}";
    const signature = event.headers["Linear-Signature"]; // The LINEAR_WEBHOOK_SIGNATURE_HEADER const has the wrong captialisation
    if (!signature) {
      throw new Error("Missing Linear webhook signature");
    }

    const rawPayload = JSON.parse(body);
    const timestamp = rawPayload[LINEAR_WEBHOOK_TS_FIELD];

    // Verify and parse the webhook payload
    verifyLinearWebhook(body, signature, timestamp);
    const payload = parseLinearWebhookPayload(body);

    // Check if the event is relevant
    if (!isRelevantLinearEvent(payload)) {
      console.log("Event not relevant, skipping");
      return {
        statusCode: 200,
        body: JSON.stringify({
          message: "Event not relevant, skipping",
        }),
      };
    }

    const onDutyUser = await getOnDutyUser();
    await notifyOnDutyUserInSlack(payload.data.title, payload.url, onDutyUser.email);

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: "Webhook received and processed successfully",
      }),
    };
  } catch (error) {
    console.error("Error handling Linear webhook:", error);
    return {
      statusCode: error instanceof Error && error.message.includes("signature") ? 401 : 500,
      body: JSON.stringify({
        message: "Error handling Linear webhook",
        error: error instanceof Error ? error.message : "Unknown error",
      }),
    };
  }
};
