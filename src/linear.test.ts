import { LinearWebhookPayload, isRelevantLinearEvent, BUG_LABEL_ID, USER_QUESTION_LABEL_ID } from "./linear";

// Helper functions to create test payloads
const createPayload = (data: { priority: number; labelIds: string[] }): LinearWebhookPayload => ({
  action: "create",
  type: "Issue",
  url: "https://linear.app/created-id",
  data: {
    id: "test-id",
    title: "Test Issue created",
    priority: data.priority,
    labelIds: data.labelIds,
  },
});

const updatePayload = (
  data: { priority: number; labelIds: string[] },
  updatedFrom: { priority: number; labelIds: string[] }
): LinearWebhookPayload => ({
  action: "update",
  type: "Issue",
  url: "https://linear.app/updated-id",
  data: {
    id: "test-id",
    title: "Test Issue updated",
    priority: data.priority,
    labelIds: data.labelIds,
  },
  updatedFrom,
});

describe("isRelevantLinearEvent", () => {
  describe("create events", () => {
    test.each([
      {
        name: "with Urgent priority (1) and relevant labels",
        data: { priority: 1, labelIds: [USER_QUESTION_LABEL_ID] },
        expected: true,
      },
      {
        name: "with Urgent priority (1) but no relevant labels",
        data: { priority: 1, labelIds: [] },
        expected: false,
      },
      {
        name: "with Urgent priority (1) but only irrelevant labels",
        data: { priority: 1, labelIds: ["deadbeef-cafe-bade-feed-cafedeadfeed"] },
        expected: false,
      },
      {
        name: "with non-urgent priority (2)",
        data: { priority: 2, labelIds: [USER_QUESTION_LABEL_ID] },
        expected: false,
      },
      {
        name: "with no priority (0)",
        data: { priority: 0, labelIds: [USER_QUESTION_LABEL_ID] },
        expected: false,
      },
    ])("should return $expected for a create event $name", ({ data, expected }) => {
      const payload = createPayload(data);
      expect(isRelevantLinearEvent(payload)).toBe(expected);
    });
  });

  describe("update events", () => {
    test.each([
      {
        name: "that makes an issue relevant by adding labels",
        data: { priority: 1, labelIds: [USER_QUESTION_LABEL_ID] },
        updatedFrom: { priority: 1, labelIds: [] },
        expected: true,
      },
      {
        name: "that adds a relevant label to an already relevant issue",
        data: { priority: 1, labelIds: [BUG_LABEL_ID, USER_QUESTION_LABEL_ID] },
        updatedFrom: { priority: 1, labelIds: [BUG_LABEL_ID] },
        expected: false,
      },
      {
        name: "that makes an issue relevant by changing priority to Urgent (1)",
        data: { priority: 1, labelIds: [USER_QUESTION_LABEL_ID] },
        updatedFrom: { priority: 2, labelIds: [USER_QUESTION_LABEL_ID] },
        expected: true,
      },
      {
        name: "that removes relevance by changing priority from Urgent (1)",
        data: { priority: 2, labelIds: [USER_QUESTION_LABEL_ID] },
        updatedFrom: { priority: 1, labelIds: [USER_QUESTION_LABEL_ID] },
        expected: false,
      },
      {
        name: "that removes relevance by removing a label",
        data: { priority: 1, labelIds: [] },
        updatedFrom: { priority: 1, labelIds: [USER_QUESTION_LABEL_ID] },
        expected: false,
      },
      {
        name: "that makes an issue relevant through multiple changes",
        data: { priority: 1, labelIds: [USER_QUESTION_LABEL_ID] },
        updatedFrom: { priority: 2, labelIds: [] },
        expected: true,
      },
      {
        name: "with partial updatedFrom information (missing priority)",
        data: { priority: 1, labelIds: [USER_QUESTION_LABEL_ID] },
        updatedFrom: { priority: 1, labelIds: [] },
        expected: true,
      },
      {
        name: "that changes an already-relevant issue in a non-relevant way",
        data: { priority: 1, labelIds: [USER_QUESTION_LABEL_ID] },
        updatedFrom: { priority: 1, labelIds: [USER_QUESTION_LABEL_ID] },
        expected: false,
      },
      {
        name: "that changes between non-urgent priorities (2 to 3)",
        data: { priority: 3, labelIds: [USER_QUESTION_LABEL_ID] },
        updatedFrom: { priority: 2, labelIds: [USER_QUESTION_LABEL_ID] },
        expected: false,
      },
    ])("should return $expected for an update event $name", ({ data, updatedFrom, expected }) => {
      const payload = updatePayload(data, updatedFrom);
      expect(isRelevantLinearEvent(payload)).toBe(expected);
    });
  });
});
