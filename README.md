# OnDuty Slack

A serverless application that does a couple of tasks related to the on-duty engineer.

## Features

As of April '25:

1. It sets the #urgent channel topic to note who is on-duty.
2. If an Urgent Linear issue is created which relates to the on-duty engineers responsibilites, it notifies them in the #urgent channel.

## Setup

1. Install dependencies:

   ```bash
   npm install
   ```

1. Configure environment variables in a .env file (see .env.sample for what is required)

1. Run the app locally:

   ```bash
   npm run build
   npm run start
   ```

1. Run the tests:

   ```bash
   npm test -- --watchAll
   ```

1. Deploy the application (requires AWS credentials in your shell):

   ```bash
   npm run deploy
   ```

## Security

All sensitive credentials are stored in AWS Systems Manager Parameter Store and are accessed securely by the Lambda function using IAM roles.

Credential setup was a one-time, manual thing:

```bash
aws ssm put-parameter \
    --name "/onduty-slack/slack-bot-token" \
    --value "your-slack-bot-token" \
    --type "SecureString" \
    --description "Slack Bot Token for OnDuty Slack app"

aws ssm put-parameter \
    --name "/onduty-slack/pagerduty-api-token" \
    --value "your-pagerduty-api-token" \
    --type "SecureString" \
    --description "PagerDuty API Token for OnDuty Slack app"

aws ssm put-parameter \
    --name "/onduty-slack/pagerduty-schedule-id" \
    --value "your-pagerduty-schedule-id" \
    --type "SecureString" \
    --description "PagerDuty Schedule ID for OnDuty Slack app"

aws ssm put-parameter \
    --name "/onduty-slack/linear-webhook-secret" \
    --value "your-linear-webhook-secret" \
    --type "SecureString" \
    --description "Linear Webhook Secret for OnDuty Slack app"
```
