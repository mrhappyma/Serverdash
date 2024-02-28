import { order } from "@prisma/client";
import { s3FilePrefix } from "../modules/s3";

const fillOrderMessage = (order: order, message: string) => {
  return message
    .replace("$mention", `<@${order.customerId}>`)
    .replace("$item", fileUrl(order.fileUrl!)!)
    .replace("$number", order.id.toString())
    .replace("$chef", order.chefUsername!)
    .replace("$order", order.order)
    .replace("$server", order.guildName!);
};
export default fillOrderMessage;

export const fileUrl = (u?: string) => {
  if (!u) return undefined;
  return u.startsWith("s3 ") ? `${s3FilePrefix}/${u.split("s3 ")[1]}` : u;
};
