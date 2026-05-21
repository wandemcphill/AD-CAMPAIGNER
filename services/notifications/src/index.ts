export const notificationsService = {
  name: "notifications",
  channels: ["email", "in-app", "websocket", "whatsapp-ready"],
  responsibilities: ["delivery", "preferences", "templates", "retries"]
} as const;
