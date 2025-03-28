import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string(),
  MONGO_URI: z.string(),
  DSC_TOKEN: z.string(),
  COLLECTOR_TOKEN: z.string().optional(),

  KITCHEN_SERVER_ID: z.string(),
  NEW_ORDERS_CHANNEL_ID: z.string(),
  NEW_ORDERS_WEBHOOK: z.string(),
  READY_ORDERS_CHANNEL_ID: z.string(),
  READY_ORDERS_WEBHOOK: z.string(),
  DELIVERED_ORDERS_CHANNEL_ID: z.string(),
  DELIVERED_ORDERS_WEBHOOK: z.string(),
  CANCELLED_ORDERS_CHANNEL_ID: z.string(),
  CANCELLED_ORDERS_WEBHOOK: z.string(),
  LOGS_CHANNEL_ID: z.string(),
  LOGS_WEBHOOK: z.string(),
  CHEF_CHAT_CHANNEL_ID: z.string(),
  CHEF_CHAT_WEBHOOK: z.string(),
  APPLICATIONS_CHANNEL_ID: z.string(),
  APPLICATIONS_WEBHOOK: z.string(),

  TRAINING_SERVER_ID: z.string(),
  TRAINING_SERVER_ORDERS_CHANNEL_ID: z.string(),
  TRAINING_CHANNEL_ID: z.string(),
  TRAINING_NEW_ORDERS_CHANNEL_ID: z.string(),
  TRAINING_NEW_ORDERS_WEBHOOK: z.string(),
  TRAINING_READY_ORDERS_CHANNEL_ID: z.string(),
  TRAINING_READY_ORDERS_WEBHOOK: z.string(),
  TRAINERS_ROLE_ID: z.string(),

  ADMIN_ROLE_ID: z.string(),
  CHEF_ROLE_ID: z.string(),
  TRAINING_ROLE_ID: z.string(),
  ORDER_PING_ROLE_ID: z.string(),
  DELIVERY_PING_ROLE_ID: z.string(),

  SENTRY_DSN: z.string().optional(),
  SENTRY_ORG: z.string().optional(),
  SENTRY_PROJECT: z.string().optional(),
  SENTRY_TOKEN: z.string().optional(),

  NODE_ENV: z.string().optional(),
  SOURCE_COMMIT: z.string().optional(),

  AWS_ACCESS_KEY_ID: z.string(),
  AWS_SECRET_ACCESS_KEY: z.string(),
  S3_REGION: z.string(),
  S3_BUCKET: z.string(),
  FILE_URL_PREFIX: z.string().optional(),

  APPLICATION_URL: z.string(),
});
export default envSchema.parse(process.env);
