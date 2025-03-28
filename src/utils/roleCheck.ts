import bot from "..";
import env from "./env";

const roles = {
  admin: env.ADMIN_ROLE_ID,
  training: env.TRAINING_ROLE_ID,
  chef: env.CHEF_ROLE_ID,
};

declare type Role = keyof typeof roles;
export default function hasKitchenRole(role: Role, userId: string) {
  return bot.client.guilds.cache
    .get(env.KITCHEN_SERVER_ID)
    ?.members.cache.get(userId)
    ?.roles.cache.has(roles[role]);
}
