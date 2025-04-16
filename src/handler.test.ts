import { LinearWebhookPayload, isRelevantLinearEvent, BUG_LABEL_ID, USER_QUESTION_LABEL_ID } from "./handler";

interface IssueData {
  id: string;
  priorityLabel: string;
  labelIds: string[];
}

// Helper functions to create test payloads
const createPayload = (data: Partial<IssueData> = {}): LinearWebhookPayload => ({
  action: "create",
  type: "Issue",
  url: "https://linear.app/created-id",
  data: {
    id: "test-id",
    title: "Test Issue created",
    priorityLabel: "Urgent",
    labelIds: [],
    ...data,
  },
});

const updatePayload = (data: Partial<IssueData> = {}, updatedFrom: Partial<IssueData> = {}): LinearWebhookPayload => ({
  action: "update",
  type: "Issue",
  url: "https://linear.app/updated-id",
  data: {
    id: "test-id",
    title: "Test Issue updated",
    priorityLabel: "Urgent",
    labelIds: [],
    ...data,
  },
  updatedFrom,
});

describe("isRelevantLinearEvent", () => {
  it("should return true for a create event with Urgent priority relevant labels", () => {
    const payload = createPayload({
      labelIds: [BUG_LABEL_ID, USER_QUESTION_LABEL_ID],
    });
    expect(isRelevantLinearEvent(payload)).toBe(true);
  });

  it("should return false for a create event with Urgent priority but no labels", () => {
    const payload = createPayload({
      labelIds: [], // no labels
    });
    expect(isRelevantLinearEvent(payload)).toBe(false);
  });

  it("should return false for a create event with Urgent priority but no relevant labels", () => {
    const payload = createPayload({
      labelIds: ["deadbeef-cafe-bade-feed-cafedeadfeed"],
    });
    expect(isRelevantLinearEvent(payload)).toBe(false);
  });

  it("should return false for a create event without Urgent priority but a relevant label", () => {
    const payload = createPayload({
      priorityLabel: "High",
      labelIds: [BUG_LABEL_ID],
    });
    expect(isRelevantLinearEvent(payload)).toBe(false);
  });

  it("should return true for an update event that makes an issue relevant", () => {
    const payload = updatePayload(
      {
        labelIds: [USER_QUESTION_LABEL_ID],
      },
      {
        labelIds: [], // was not relevant before
      }
    );
    expect(isRelevantLinearEvent(payload)).toBe(true);
  });

  it("should return false for an update event that adds a relevant label to an already relevant issue", () => {
    const payload = updatePayload(
      {
        labelIds: [BUG_LABEL_ID, USER_QUESTION_LABEL_ID],
      },
      {
        labelIds: [BUG_LABEL_ID], // was already relevant (had bug label)
      }
    );
    expect(isRelevantLinearEvent(payload)).toBe(false);
  });

  it("should return true for an update event that makes an issue relevant by changing priority to Urgent", () => {
    const payload = updatePayload(
      {
        labelIds: [BUG_LABEL_ID],
      },
      {
        priorityLabel: "Low", // was not Urgent before
      }
    );
    expect(isRelevantLinearEvent(payload)).toBe(true);
  });

  it("should return false for an update event that removes relevance by changing priority", () => {
    const payload = updatePayload(
      {
        priorityLabel: "High", // no longer Urgent
        labelIds: [BUG_LABEL_ID], // still have bug label
      },
      {
        priorityLabel: "Urgent", // was Urgent before
      }
    );
    expect(isRelevantLinearEvent(payload)).toBe(false);
  });

  it("should return false for an update event that removes relevance by removing a label", () => {
    const payload = updatePayload(
      {
        labelIds: [], // no more relevant labels
      },
      {
        labelIds: [BUG_LABEL_ID], // had bug label before
      }
    );
    expect(isRelevantLinearEvent(payload)).toBe(false);
  });

  it("should return true for an update event that makes an issue relevant through multiple changes", () => {
    const payload = updatePayload(
      {
        priorityLabel: "Urgent", // changed to Urgent
        labelIds: [BUG_LABEL_ID], // added bug label
      },
      {
        priorityLabel: "Low",
        labelIds: [], // had no relevant labels before
      }
    );
    expect(isRelevantLinearEvent(payload)).toBe(true);
  });

  it("should return true for an update event with partial updatedFrom information", () => {
    const payload = updatePayload(
      {
        labelIds: [BUG_LABEL_ID],
      },
      {
        labelIds: [],
      }
    );
    expect(isRelevantLinearEvent(payload)).toBe(true);
  });

  it("should return false for an update event that changes an already-relevant issue in a non-relevant way", () => {
    const payload = updatePayload(
      {
        // Issue remains Urgent and has a relevant label
        labelIds: [BUG_LABEL_ID],
      },
      {
        // No changes to priority or relevant labels
        // This simulates a change to something like title or description
      }
    );
    expect(isRelevantLinearEvent(payload)).toBe(false);
  });
});
