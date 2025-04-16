import { WebClient } from "@slack/web-api";

async function getUrgentChannel(slack: WebClient) {
  const channels = await slack.conversations.list({
    types: "public_channel",
  });

  if (!channels.ok || !channels.channels) {
    throw new Error("Failed to fetch Slack channels");
  }

  const urgentChannel = channels.channels.find((channel) => channel.name === "urgent");
  if (!urgentChannel) {
    throw new Error("Could not find #urgent channel");
  }

  return urgentChannel;
}

async function getUserByEmail(slack: WebClient, email: string) {
  const slackUser = await slack.users.lookupByEmail({
    email,
  });

  if (!slackUser.ok || !slackUser.user) {
    throw new Error(`Could not find Slack user for email: ${email}`);
  }

  return slackUser.user;
}

async function updateChannelTopic(slack: WebClient, channelId: string, topic: string) {
  const updateResult = await slack.conversations.setTopic({
    channel: channelId,
    topic,
  });

  if (!updateResult.ok) {
    throw new Error("Failed to update channel description");
  }
}

export async function setUrgentChannelTopic(newTopic: string) {
  const slack = new WebClient(process.env.SLACK_BOT_TOKEN);
  const urgentChannel = await getUrgentChannel(slack);

  // Get current channel info
  const channelInfo = await slack.conversations.info({
    channel: urgentChannel.id!,
  });

  if (!channelInfo.ok || !channelInfo.channel) {
    throw new Error("Failed to get channel info");
  }

  // Only update if the topic would change
  if (channelInfo.channel.topic?.value !== newTopic) {
    await updateChannelTopic(slack, urgentChannel.id!, newTopic);
  }
}

export async function notifyOnDutyUserInSlack(issueTitle: string, issueUrl: string, onDutyUserEmail: string) {
  const slack = new WebClient(process.env.SLACK_BOT_TOKEN);
  const slackUser = await getUserByEmail(slack, onDutyUserEmail);
  const urgentChannel = await getUrgentChannel(slack);

  const message = await slack.chat.postMessage({
    channel: urgentChannel.id!,
    text: `Hey <@${slackUser.id}>, there's a new urgent issue: ${issueTitle}\n${issueUrl}`,
  });

  if (!message.ok) {
    throw new Error("Failed to post message to #urgent");
  }
}
