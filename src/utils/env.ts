import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string(),
  DSC_TOKEN: z.string(),
  KITCHEN_SERVER_ID: z.string(),
  NEW_ORDERS_CHANNEL_ID: z.string(),
  NEW_ORDERS_WEBHOOK: z.string(),
  FILL_ORDERS_CHANNEL_ID: z.string(),
  FILL_ORDERS_WEBHOOK: z.string(),
  READY_ORDERS_CHANNEL_ID: z.string(),
  READY_ORDERS_WEBHOOK: z.string(),
  DELIVERING_ORDERS_CHANNEL_ID: z.string(),
  DELIVERING_ORDERS_WEBHOOK: z.string(),
  DELIVERED_ORDERS_CHANNEL_ID: z.string(),
  DELIVERED_ORDERS_WEBHOOK: z.string(),
  CANCELLED_ORDERS_CHANNEL_ID: z.string(),
  CANCELLED_ORDERS_WEBHOOK: z.string(),
  LOGS_CHANNEL_ID: z.string(),
  LOGS_WEBHOOK: z.string(),
  CHEF_CHAT_CHANNEL_ID: z.string(),
  CHEF_CHAT_WEBHOOK: z.string(),
  ORDER_PING_ROLE_ID: z.string(),
  DELIVERY_PING_ROLE_ID: z.string(),
  DEVELOPERS: z.string().default(""),
});
export default envSchema.parse(process.env);
