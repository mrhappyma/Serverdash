import {
  ButtonStyle,
  ComponentType,
  GuildTextBasedChannel,
  TextBasedChannel,
  ThreadAutoArchiveDuration,
  ThreadChannel,
} from "discord.js";
import bot, { messagesClient, prisma } from "..";
import env from "../utils/env";
import {
  applicationStatus,
  order,
  orderStatus,
  trainingSession,
} from "@prisma/client";
import { createOrder } from "../orders/cache";
import updateOrderStatus from "../orders/updateStatus";
import agenda from "./jobs";
import { Job, JobAttributesData } from "agenda";

//training starts when someone is given the training role
messagesClient.client.on("guildMemberUpdate", async (oldMember, newMember) => {
  console.log("a");
  if (
    !(
      !oldMember.roles.cache.has(env.TRAINING_ROLE_ID) &&
      newMember.roles.cache.has(env.TRAINING_ROLE_ID)
    )
  )
    return;
  const channel = (await messagesClient.client.channels.fetch(
    env.TRAINING_CHANNEL_ID
  )) as TextBasedChannel;
  const m = await channel.send({
    content: `<@${newMember.id}>`,
    embeds: [
      {
        title: "Welcome to the kitchen!",
        description:
          "Thanks for wanting help out in the kitchen, so glad to have you here!\nBefore you start cooking up real orders, I'll guide you through a quick training session to get you acquainted with everything! Say hi in the thread and we'll get started 👇",
      },
    ],
  });
  const thread = await m.startThread({
    name: "Training",
    autoArchiveDuration: ThreadAutoArchiveDuration.ThreeDays,
    reason: "Training new chef",
  });
  await thread.members.add(newMember.id);
  await thread.members.add(messagesClient.client.user!.id);

  await prisma.application.updateMany({
    where: {
      user: newMember.id,
      status: applicationStatus.APPROVED,
    },
    data: {
      status: applicationStatus.TRAINING,
    },
  });
  await prisma.trainingSession.create({
    data: {
      user: newMember.id,
      threadId: thread.id,
    },
  });
});

//the initial "hi"
messagesClient.client.on("messageCreate", async (message) => {
  if (
    !(
      message.channel.isThread() &&
      message.channel.name == "Training" &&
      message.content.toLowerCase().includes("hi") &&
      !message.author.bot
    )
  )
    return;
  const session = await prisma.trainingSession.findUnique({
    where: {
      threadId: message.channelId,
      state: "welcome",
      user: message.author.id,
    },
  });
  if (!session) return;

  await message.reply("hii!");
  await message.channel.send({
    content: `Today's training session shouldn't take very long, I'll just guide you through filling and delivering your first order, and go over a couple details of what you can expect here in the kitchen.\n-# I'm just a stupid little robot who doesn't know much, so if you need any actual help please ping <@&${env.TRAINERS_ROLE_ID}> and a lovely human will come help you out!`,
    allowedMentions: {},
  });
  await message.channel.sendTyping();

  const trainingGuild = await bot.client.guilds.fetch(env.TRAINING_SERVER_ID);
  const channel = (await trainingGuild.channels.fetch(
    env.TRAINING_SERVER_ORDERS_CHANNEL_ID
  )) as TextBasedChannel;
  const orderMessage = await channel.send({
    embeds: [
      {
        title: "Incoming training order!",
      },
    ],
  });

  const items = ["lasagna", "pizza", "burger", "sushi", "taco"];
  const item = items[Math.floor(Math.random() * items.length)];

  const order = await createOrder(
    item,
    trainingGuild.id,
    trainingGuild.name,
    messagesClient.client.user!.id,
    messagesClient.client.user!.username,
    orderMessage.channelId,
    orderMessage.id,
    { training: session }
  );

  await message.channel.send({
    content: `I just created a training order for you, #${order.id}. To fill it, head to <#${env.TRAINING_NEW_ORDERS_CHANNEL_ID}> and claim it! A thread will appear under it, just use Google images or whatever you like to find a picture of what I ordered, and send it in that thread.`,
  });

  await prisma.trainingSession.update({
    where: {
      threadId: message.channelId,
    },
    data: {
      state: "fill",
      orderId: order.id,
    },
  });
});

//order is filled (packing job was not scheduled!)
export const trainingOrderFilled = async (training: trainingSession) => {
  const thread = (await messagesClient.client.channels.fetch(
    training.threadId
  )) as TextBasedChannel;
  await thread.send({
    content: `Cool! Yay! Hooray! Great job <@${training.user}>! That's how you fill an order!`,
  });
  await thread.send({
    content:
      "Once you fill an order, there's a 5 minute delay before it's ready to be delivered. While we wait, let's go over the order rules and some other stuff!",
    components: [
      //TODO i should do more components like this, why do i need builders
      {
        type: ComponentType.ActionRow,
        components: [
          {
            type: ComponentType.Button,
            label: "yay",
            style: ButtonStyle.Primary,
            customId: "training-rules-1",
          },
        ],
      },
    ],
  });

  await prisma.trainingSession.update({
    where: {
      threadId: training.threadId,
    },
    data: {
      state: "rules-1",
    },
  });
};

//'yay' button was pressed
messagesClient.registerButton("training-rules-1", async (interaction) => {
  await interaction.deferUpdate();
  //TODO: sync these with customer-facing stuff
  await interaction.channel!.send({
    content: "so, the rules!",
    embeds: [
      {
        title: "we ABSOLUTELY DO NOT ALLOW",
        description:
          "1. slurs, hate speech, general overly mean stuff\n" +
          "2. anything potentially disturbing, including (but not limited to) any blood, active violence, or death, or any overly graphic dishes including any eyes or bugs\n" +
          "3. anything sexually suggestive\n" +
          "4. specific races, skin colors, or ethnicities\n" +
          "5. medicines or drugs, except alcohol\n" +
          "6. anything political. this is not the space for that.\n" +
          "\n" +
          "If you see any of this, reject the order!",
      },
      {
        title: "we generally are unable to fill",
        description:
          "7. very specific or extreme quantities\n" +
          "8. unrealistic, nonexistent, or overly-complicated things\n" +
          "9. the same thing or small variations of the same thing over and over\n" +
          "10. anything deemed ‘seriously not cool’ - this is a catch-all for anything that doesn't fit the above rules but still feels wrong to you.\n" +
          "\n" +
          "Pretty much, if you can't find it, or its like really bad stuff, you can't fill it :(\n" +
          "If you're unsure, ask around!",
      },
    ],
  });
  await interaction.channel!.send({
    content:
      "If you need to reject an order, just click the big red reject button below it! You'll have to type in a reason, which can just be the rule number. Pretty self-explanatory. These rules are pinned in the chefs chat too, if you need to look back at them.",
    components: [
      {
        type: ComponentType.ActionRow,
        components: [
          {
            type: ComponentType.Button,
            label: "i read all that, sounds good!",
            style: ButtonStyle.Primary,
            customId: "training-rules-2",
          },
        ],
      },
    ],
  });
  await interaction.message.edit({
    components: [],
  });
  await prisma.trainingSession.update({
    where: {
      threadId: interaction.channelId,
    },
    data: {
      state: "rules-2",
    },
  });
});

//'i read all that sounds good!' button was pressed
messagesClient.registerButton("training-rules-2", async (interaction) => {
  await interaction.deferUpdate();
  const training = await prisma.trainingSession.findUnique({
    where: {
      threadId: interaction.channelId,
    },
    include: {
      order: true,
    },
  });
  if (!training) return;
  if (Date.now() - training.updatedAt.getTime() < 35 * 1000) {
    await interaction.followUp({
      content: "hey, you need to actually read that first!",
      ephemeral: true,
    });
    return;
  }

  await interaction.channel!.send({
    content:
      "Cool! Rejecting is also used for if you can't get in to deliver an order, or if there's other weird stuff, btw.",
  });
  await interaction.channel!.send({
    content: `One more thing before we deliver that ${training.order?.order}- let's set your delivery message! That's that thing you send to customers to actually deliver the order, and it gets automatically filled in with information about the order, so all you have to do is copy-paste it!`,
  });
  await interaction.channel!.send({
    content:
      "You can put the following variables in your message:\n" +
      "`$mention` - mention the customer\n" +
      "`$item` - the image url\n" +
      "`$chef` - the username of the chef who filled the order\n" +
      "`$number` - the order number\n" +
      "`$order` - the order itself\n" +
      "`$server` - the name of the customer's server\n" +
      "\n" +
      "You can put whatever you want (mostly)! Just make sure you include `$mention`, `$item`, and `$chef` somewhere in there.\n" +
      "You'll see a preview of what it'll look after you submit any changes. When you're done click continue and we'll deliver the order!\n" +
      "-# you'll be able to modify this whenever you want later, btw. don't worry about getting it perfect right now!",
    components: [
      {
        type: ComponentType.ActionRow,
        components: [
          {
            type: ComponentType.Button,
            label: "edit message",
            style: ButtonStyle.Primary,
            customId: "message-set",
          },
          {
            type: ComponentType.Button,
            label: "continue",
            style: ButtonStyle.Success,
            customId: "training-message-set-continue",
          },
        ],
      },
    ],
  });
  await interaction.message.edit({
    components: [],
  });
  await prisma.trainingSession.update({
    where: {
      threadId: interaction.channelId,
    },
    data: {
      state: "message-set",
    },
  });
});

//message was edited and then they clicked continue
messagesClient.registerButton(
  "training-message-set-continue",
  async (interaction) => {
    await interaction.deferUpdate();
    const training = await prisma.trainingSession.findUnique({
      where: {
        threadId: interaction.channelId,
      },
      include: {
        order: true,
      },
    });
    if (!training) return;

    if (training.state !== "message-set-done") {
      await interaction.followUp({
        content: "You need to set your message first!",
        ephemeral: true,
      });
      return;
    }

    await interaction.channel!.send({
      content: `Great! Now that your message is set, it's finally delivery time! I'm **ABSOLUTELY STARVING** where IS my ${training.order?.order}???`,
    });
    await interaction.channel!.send({
      content:
        "Here's how it'll work:\n" +
        `1. A message will appear in <#${env.TRAINING_READY_ORDERS_CHANNEL_ID}> for the order! You can click the big button under it to start delivering it.\n` +
        '2. THEN 2 "only visible to you" messages will show up. the first with an invite, and the second with your delivery message!\n' +
        '3. Copy the delivery message to your clipboard- on mobile, hold down on it and tap copy. on desktop, click "toggle codeblock", then click the little 📋 in the top right of the message.\n' +
        "4/5. Join the customer's server with the invite, then paste and send the delivery message!\n" +
        "6. Leave their server, unless you were already there or have permission from someone there\n" +
        "7. Come back here and click complete to finish the order!",
    });
    await interaction.channel!.send({
      content: "make sense?",
      components: [
        {
          type: ComponentType.ActionRow,
          components: [
            {
              type: ComponentType.Button,
              label: "heck yeah",
              style: ButtonStyle.Success,
              customId: "training-delivery-go",
            },
          ],
        },
      ],
    });

    await interaction.message.edit({
      components: [],
    });
    await prisma.trainingSession.update({
      where: {
        threadId: interaction.channelId,
      },
      data: {
        state: "delivery-process-review",
      },
    });
  }
);

//'heck yeah' button was pressed
messagesClient.registerButton("training-delivery-go", async (interaction) => {
  await interaction.deferUpdate();
  const training = await prisma.trainingSession.findUnique({
    where: {
      threadId: interaction.channelId,
    },
    include: {
      order: true,
    },
  });
  if (!training) return;

  if (Date.now() - training.updatedAt.getTime() < 20 * 1000) {
    await interaction.followUp({
      content: "hey, you need to actually read that first!",
      ephemeral: true,
    });
    return;
  }

  await interaction.channel!.sendTyping();
  const order = training.order!;
  await updateOrderStatus({
    id: order.id,
    status: orderStatus.PACKED,
    chef: messagesClient.client.user!.id,
    chefUsername: messagesClient.client.user!.username,
  });

  await prisma.trainingSession.update({
    where: {
      threadId: interaction.channelId,
    },
    data: {
      state: "delivery",
    },
  });

  await interaction.channel!.send({
    content: `<#${env.TRAINING_READY_ORDERS_CHANNEL_ID}>! go get 'em!`,
  });
  await interaction.message.edit({
    components: [],
  });
});

//order was delivered
export const trainingOrderDelivered = async (training: trainingSession) => {
  //TODO: check that they actually delivered it
  const thread = (await messagesClient.client.channels.fetch(
    training.threadId
  )) as ThreadChannel;
  await thread.send({
    content: `<@!${training.user}> YAYY MY FOOD!`,
  });
  await thread.send({
    content:
      "Great job! You've successfully delivered your first order! 🎉\n" +
      "That makes you... drumroll please... 🥁",
  });
  await thread.sendTyping();

  await new Promise((resolve) => setTimeout(resolve, 5000));
  const member = await thread.guild.members.fetch(training.user);
  await member.roles.add(env.CHEF_ROLE_ID);
  await thread.send({
    content:
      "a chef! 🎉\n" +
      "so glad to have you here. you're ready to start filling orders!",
  });
  //TODO: new chefs chat, specifically for questions!
  await thread.send({
    content: `It's been great training you! If you have any questions, feel free to ask in <#${env.CHEF_CHAT_CHANNEL_ID}> and ping the <@&${env.TRAINERS_ROLE_ID}>, they'd love to help! Have fun cooking!`,
  });
  await thread.setArchived(true, "Training complete!");

  await prisma.trainingSession.update({
    where: {
      threadId: training.threadId,
    },
    data: {
      state: "complete",
    },
  });
  await agenda.schedule<RemoveTraineeJob>("in 5 minutes", "remove trainee", {
    memberId: training.user,
  });
};

export interface RemoveTraineeJob extends JobAttributesData {
  memberId: string;
}
agenda.define<RemoveTraineeJob>(
  "remove trainee",
  async (job: Job<RemoveTraineeJob>) => {
    const member = await messagesClient.client.guilds
      .fetch(env.TRAINING_SERVER_ID)
      .then((g) => g.members.fetch(job.attrs.data.memberId));
    await member.roles.remove(env.TRAINING_ROLE_ID);
  }
);
