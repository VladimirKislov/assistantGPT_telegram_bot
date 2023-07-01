import { Markup } from "telegraf";
import { MongoClient } from "mongodb";
import { code } from "telegraf/format";
import config from "config";

const client = new MongoClient(config.get("MONGO_DB_CLIENT"), {
  useUnifiedTopology: true,
});

export async function findUser(id) {
  const user = await client.db("assistantGPT").collection("users").findOne({ userID: id });
  return user;
}

export async function generateAdminsButtons(role) {
  const documents = await client.db("assistantGPT").collection("users").find().toArray();
  const buttonsMarkup = Markup.inlineKeyboard(
    documents
      .map((button) => [
        Markup.button.callback(
          `${button.first_name} ${button.last_name ? button.last_name : ""} ${
            button.username ? "[" + "@" + button.username + "]" : ""
          }`,
          `${button.userID}${role}`
        ),
      ])
      .concat([[Markup.button.callback("Отмена", "cancel")]])
  );
  return buttonsMarkup;
}

export async function checkSubscriptions() {
  try {
    const currentTime = new Date();

    const expiredSubscriptions = await client
      .db("assistantGPT")
      .collection("users")
      .find({ subscription: true, expirationTime: { $lte: currentTime } })
      .toArray();

    if (expiredSubscriptions.length > 0) {
      for (const subscription of expiredSubscriptions) {
        await client
          .db("assistantGPT")
          .collection("users")
          .updateOne({ userID: subscription.userID }, { $set: { subscription: false } });
      }
    }
  } catch (error) {
    console.error("error: поиска истекших подписок", error.message);
  }
}

export async function updateRoleAdmin(role, bot) {
  const documents = await client.db("assistantGPT").collection("users").find().toArray();

  if (role === "data") {
    documents.map((button) => {
      bot.action(String(button.userID + role), async (ctx) => {
        try {
          const user = await client
            .db("assistantGPT")
            .collection("users")
            .findOne({ userID: button.userID });
          await ctx.reply(
            `
        id: ${user.userID}\nИмя: ${user.first_name}\nФамилия: ${
              user.last_name || ""
            }\nПубличное имя: ${"@" + user.username || ""}\nRole: ${user.role}\nЯзык: ${
              user.language_code || ""
            }\nПодписка: ${user.subscription ? " активна" : " неактивна"}\n${
              user.subscription ? `Активна до: ${user.expirationTime.toLocaleString("ru-RU")}` : ""
            }\nЗапросы к боту:\n ${user.messages.map((message) => ` - ${message}`).join("\n")}
        `
          );
          await ctx.deleteMessage();
        } catch (error) {
          console.log("error: вывода данных пользователя", error.message);
        }
      });
    });
  } else {
    documents.map((button) => {
      bot.action(String(button.userID + role), async (ctx) => {
        try {
          await ctx.answerCbQuery();
          await client
            .db("assistantGPT")
            .collection("users")
            .updateOne({ userID: button.userID }, { $set: { role: role } });
          role === "admin"
            ? ctx.reply(code(`Вы Назначили администратора: ${button.first_name}`))
            : ctx.reply(code(`Вы Удалили администратора: ${button.first_name}`));
          await ctx.deleteMessage();
        } catch (error) {
          console.log("error: добавления/удаления администратора", error.message);
        }
      });
    });
  }
}

export async function updateSubscription(id, durationInMinutes, ctx, day) {
  const user = await findUser(id);
  try {
    const expirationTime = new Date(Date.now() + durationInMinutes * 60000);
    await client
      .db("assistantGPT")
      .collection("users")
      .updateOne(
        { userID: id },
        {
          $set: {
            subscription: true,
            expirationTime: expirationTime,
            counterSub: 0,
          },
        }
      );
    await ctx.reply(code(`Подписка добавлена на ${day} для пользователя: ${user.first_name}`));
  } catch (error) {
    console.error("error: добавления подписки пользователю", error);
  }
}

export async function activateSubscription(role, bot) {
  const documents = await client.db("assistantGPT").collection("users").find().toArray();

  documents.map((btn) => {
    bot.action(String(btn.userID + role), async (ctx) => {
      try {
        await ctx.answerCbQuery();
        await ctx.reply(
          "На какой срок активировать подписку?",
          Markup.inlineKeyboard([
            [Markup.button.callback("30 Минут", "30min")],
            [Markup.button.callback("30 Дней", "30days")],
            [Markup.button.callback("90 Дней", "90days")],
            [Markup.button.callback("Отмена", "cancel")],
          ])
        );

        await bot.action("30min", (ctx) => {
          updateSubscription(btn.userID, 30, ctx, "30 минут");
          ctx.deleteMessage();
        });
        await bot.action("30days", (ctx) => {
          updateSubscription(btn.userID, 43200, ctx, "30 дней");
          ctx.deleteMessage();
        });
        await bot.action("90days", (ctx) => {
          updateSubscription(btn.userID, 129600, ctx, "90 дней");
          ctx.deleteMessage();
        });
        await ctx.deleteMessage();
      } catch (error) {
        console.log("error: активации подписки", error.message);
      }
    });
  });
}

export async function deleteSubscription(role, bot) {
  const documents = await client.db("assistantGPT").collection("users").find().toArray();

  documents.map((btn) => {
    bot.action(String(btn.userID + role), async (ctx) => {
      try {
        await client
          .db("assistantGPT")
          .collection("users")
          .updateOne(
            { userID: btn.userID },
            { $set: { subscription: false, expirationTime: new Date(), counterSub: 0 } }
          );
        await ctx.reply(code(`Подписка удалена у пользователя: ${btn.first_name}`));
        await ctx.deleteMessage();
      } catch (error) {
        console.log("error: удаления подписки пользовател", error.message);
      }
    });
  });
}
