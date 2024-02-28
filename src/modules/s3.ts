import { S3 } from "aws-sdk";
import env from "../utils/env";

export default new S3({
  region: env.S3_REGION,
  credentials: {
    accessKeyId: env.AWS_ACCESS_KEY_ID,
    secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
  },
});

export const s3FilePrefix =
  env.FILE_URL_PREFIX || `https://${env.S3_BUCKET}.s3.amazonaws.com`;
