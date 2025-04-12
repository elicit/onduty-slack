import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { WebClient } from "@slack/web-api";
import axios from "axios";
import { LinearWebhooks, LINEAR_WEBHOOK_SIGNATURE_HEADER, LINEAR_WEBHOOK_TS_FIELD } from "@linear/sdk";

interface PagerDutyUser {
  id: string;
  name: string;
  email: string;
}

interface PagerDutyOnCallResponse {
  users: PagerDutyUser[];
}

// Label IDs
export const BUG_LABEL_ID = "5b04a744-c7e8-4024-bc50-465cf1fb10f3";
export const INCIDENT_REMEDIATION_LABEL_ID = "b65ce122-babb-42aa-9b32-f865b7e8a606";
export const TECH_DEBT_LABEL_ID = "14d3c314-7ef7-4773-b205-d115ca4d875c";

export const syncOnCall = async (_event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  const slack = new WebClient(process.env.SLACK_BOT_TOKEN);
  const onDutyUser = await getOnDutyUser();

  // Get Slack user ID from email
  const slackUser = await slack.users.lookupByEmail({
    email: onDutyUser.email,
  });

  if (!slackUser.ok || !slackUser.user) {
    throw new Error(`Could not find Slack user for email: ${onDutyUser.email}`);
  }
  return {
    statusCode: 200,
    body: JSON.stringify({ success: true }),
  };
};

async function getOnDutyUser() {
  const pagerDutyToken = process.env.PAGERDUTY_API_TOKEN;
  const scheduleId = process.env.PAGERDUTY_SCHEDULE_ID;

  if (!pagerDutyToken || !scheduleId) {
    throw new Error("Missing required environment variables");
  }

  // Get current on-call user from PagerDuty
  const response = await axios.get<PagerDutyOnCallResponse>(`https://api.pagerduty.com/schedules/${scheduleId}/users`, {
    headers: {
      Authorization: `Token token=${pagerDutyToken}`,
      Accept: "application/vnd.pagerduty+json;version=2",
    },
  });

  const onCallUser = response.data.users[0];

  if (!onCallUser) {
    throw new Error("No on-call user found in PagerDuty schedule");
  }
  return onCallUser;
}

export interface LinearWebhookPayload {
  action: string;
  type: string;
  data: {
    id: string;
    priorityLabel: string;
    labelIds: string[];
  };
  updatedFrom?: {
    priorityLabel?: string;
    labelIds?: string[];
  };
}

export function isRelevantLinearEvent(payload: LinearWebhookPayload): boolean {
  if (payload.type !== "Issue") {
    return false;
  }

  const isUrgent = payload.data.priorityLabel === "Urgent";
  const hasRelevantLabel = payload.data.labelIds.some((id) =>
    [BUG_LABEL_ID, INCIDENT_REMEDIATION_LABEL_ID, TECH_DEBT_LABEL_ID].includes(id)
  );

  if (payload.action === "create") {
    return isUrgent && hasRelevantLabel;
  }

  if (payload.action === "update" && payload.updatedFrom) {
    // If priorityLabel is not in updatedFrom, it means it hasn't changed
    const wasUrgent =
      payload.updatedFrom.priorityLabel === undefined ? isUrgent : payload.updatedFrom.priorityLabel === "Urgent";
    // If labelIds is not in updatedFrom, it means labels haven't changed
    const hadRelevantLabel =
      payload.updatedFrom.labelIds === undefined
        ? hasRelevantLabel
        : payload.updatedFrom.labelIds.some((id) =>
            [BUG_LABEL_ID, INCIDENT_REMEDIATION_LABEL_ID, TECH_DEBT_LABEL_ID].includes(id)
          );

    // Notify only if the issue became relevant (wasn't before and is now)
    return !(wasUrgent && hadRelevantLabel) && isUrgent && hasRelevantLabel;
  }

  return false;
}

export const handleLinearWebhook = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const webhookSecret = process.env.LINEAR_WEBHOOK_SECRET;
    if (!webhookSecret) {
      throw new Error("Missing LINEAR_WEBHOOK_SECRET environment variable");
    }

    const webhook = new LinearWebhooks(webhookSecret);
    const signature = event.headers[LINEAR_WEBHOOK_SIGNATURE_HEADER];
    if (!signature) {
      throw new Error("Missing Linear webhook signature");
    }
    const body = event.body || "{}";
    const payload = JSON.parse(body);
    const timestamp = payload[LINEAR_WEBHOOK_TS_FIELD];

    // Verify the webhook signature
    webhook.verify(Buffer.from(body), signature, timestamp);

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

    // Get the on-duty user and their Slack ID
    const slack = new WebClient(process.env.SLACK_BOT_TOKEN);
    const onDutyUser = await getOnDutyUser();
    const slackUser = await slack.users.lookupByEmail({
      email: onDutyUser.email,
    });

    if (!slackUser.ok || !slackUser.user) {
      throw new Error(`Could not find Slack user for email: ${onDutyUser.email}`);
    }

    // Find the #urgent channel
    const channels = await slack.conversations.list({
      types: "public_channel",
    });

    if (!channels.ok || !channels.channels) {
      throw new Error("Failed to fetch Slack channels");
    }

    // TODO: change to urgent
    const urgentChannel = channels.channels.find((channel) => channel.name === "dev-notifications");
    if (!urgentChannel) {
      throw new Error("Could not find #urgent channel");
    }

    // Post message to #urgent
    const message = await slack.chat.postMessage({
      channel: urgentChannel.id!,
      text: `Hey <@${slackUser.user.id}>, there's a new urgent issue: ${payload.data.title}\n${payload.url}`,
    });

    if (!message.ok) {
      throw new Error("Failed to post message to #urgent");
    }

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
