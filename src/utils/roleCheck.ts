import bot from "..";
import env from "./env";

const roles = {
  admin: env.ADMIN_ROLE_ID,
  training: env.TRAINING_ROLE_ID,
  chef: env.CHEF_ROLE_ID,
};

declare type Role = keyof typeof roles;
export default async function hasKitchenRole(role: Role, userId: string) {
  return (
    (
      await bot.client.guilds.cache
        .get(env.KITCHEN_SERVER_ID)
        ?.members.fetch(userId)
    )?.roles.cache.has(roles[role]) ?? false
  );
}
