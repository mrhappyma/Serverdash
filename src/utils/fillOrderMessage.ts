import { order } from "@prisma/client";
import { s3FilePrefix } from "../modules/s3";

const fillOrderMessage = (order: order, message: string) => {
  return message
    .replaceAll("$mention", `<@${order.customerId}>`)
    .replaceAll("$item", fileUrl(order.fileUrl!)!)
    .replaceAll("$number", order.id.toString())
    .replaceAll("$chef", order.chefUsername!)
    .replaceAll("$order", order.order)
    .replaceAll("$server", order.guildName!);
};
export default fillOrderMessage;

export const fileUrl = (u: string) => {
  return u.startsWith("s3 ") ? `${s3FilePrefix}/${u.split("s3 ")[1]}` : u;
};
