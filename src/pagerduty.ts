import axios from "axios";

export interface PagerDutyUser {
  id: string;
  name: string;
  email: string;
}

interface PagerDutyOnCallResponse {
  users: PagerDutyUser[];
}

export async function getOnDutyUser(): Promise<PagerDutyUser> {
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
