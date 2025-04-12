# OnDuty Slack

A serverless application that syncs PagerDuty on-call schedules with Slack user groups.

## Features

- Automatically updates a Slack user group with the current on-call person from PagerDuty
- Runs on an hourly schedule using AWS Lambda
- Built with TypeScript and Serverless Framework

## Prerequisites

- Node.js 18.x or later
- AWS account with appropriate permissions
- PagerDuty account with API access
- Slack workspace with admin permissions

## Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Configure environment variables in AWS Systems Manager Parameter Store:

   - `/onduty-slack/slack-bot-token`: Your Slack bot token
   - `/onduty-slack/pagerduty-api-token`: Your PagerDuty API token
   - `/onduty-slack/pagerduty-schedule-id`: The ID of your PagerDuty schedule
   - `/onduty-slack/slack-user-group-id`: The ID of your Slack user group

3. Deploy the application:
   ```bash
   npm run deploy
   ```

## Development

- Build the project: `npm run build`
- Run tests: `npm test`
- Lint the code: `npm run lint`

## Architecture

The application consists of a single AWS Lambda function that:

1. Fetches the current on-call user from PagerDuty
2. Looks up the corresponding Slack user by email
3. Updates the specified Slack user group with the on-call user

The function runs on an hourly schedule using AWS EventBridge.

## Security

All sensitive credentials are stored in AWS Systems Manager Parameter Store and are accessed securely by the Lambda function using IAM roles.
