import { Markup } from "telegraf";
import { MongoClient } from "mongodb";
import { code } from "telegraf/format";

import config from "config";

import { findUser } from "./helpers.js";

const client = new MongoClient(config.get("MONGO_DB_CLIENT"), {
  useUnifiedTopology: true,
});

export async function payHandler(ctx) {
  const adminChatId = "777168276";
  try {
    await ctx.reply(
      code(
        `Спасибо!\nВаш запрос на подписку отправлен.\nНаш специалист свяжется с Вами в ближайшее время!`
      )
    );
    const message = `Пользователь ${ctx.update.message.from.first_name} хочет оформить подписку. Пожалуйста, свяжитесь с @${ctx.update.message.from.username}.\n id: ${ctx.update.message.from.id}`;
    await ctx.telegram.sendMessage(adminChatId, message);
  } catch (error) {
    console.error("Ошибка при отправке сообщения:", error);
    await ctx.reply("Произошла ошибка при отправке сообщения.");
  }
}

export async function managerHandler(ctx) {
  const adminChatId = "777168276";
  try {
    await ctx.reply(code(`Спасибо!\nНаш специалист свяжется с Вами в ближайшее время!`));
    const message = `Пользователь ${ctx.update.message.from.first_name} хочет связаться со Специалистом. Пожалуйста, свяжитесь с @${ctx.update.message.from.username}.\n id: ${ctx.update.message.from.id}`;
    await ctx.telegram.sendMessage(adminChatId, message);
  } catch (error) {
    console.error("Ошибка при отправке сообщения:", error);
    await ctx.reply("Произошла ошибка при отправке сообщения.");
  }
}

export async function settingsHandler(ctx) {
  try {
    await ctx.reply(
      code("Настройки"),
      Markup.inlineKeyboard([
        [Markup.button.callback("Настроить тип вопроса Ассистенту", "entryMsg")],
        [Markup.button.callback("Настроить тип ответа Ассистента", "responseMsg")],
        [Markup.button.callback("Отменить", "cancel")],
      ])
    );
  } catch (error) {
    console.log(error.message);
  }
}

export async function helpHandler(ctx) {
  try {
    await ctx.reply(
      `/start - Перезапустить Бота\n/pay - Оформить подписку\n/manager - Связаться с менеджером\n/settings - Настройки\n/help - Помощь\n/admin - Панель администратора`
    );
  } catch (error) {
    console.log(error.message);
  }
}

export async function adminPanelHandler(ctx) {
  try {
    await ctx.reply(
      code("Ты находишся в панели администратора"),
      Markup.inlineKeyboard([
        [Markup.button.callback("Назначить Администратора", "add")],
        [Markup.button.callback("Удалить Администратора", "delete")],
        [Markup.button.callback("Показать Данные Пользователей", "descriptionUsers")],
        [Markup.button.callback("Активировать подписку", "activateSubscription")],
        [Markup.button.callback("Деактивировать подписку", "unActivateSubscription")],
        [Markup.button.callback("Отменить", "cancel")],
      ])
    );
  } catch (error) {
    console.log(error.message);
  }
}

export async function startHandler(ctx, bot) {
  ctx.session = ctx.initial_session;

  const chatId = -1001804595718;
  const userId = ctx.message.from.id;

  const dataUser = await findUser(userId);

  try {
    const chatMember = await bot.telegram.getChatMember(chatId, userId);
    if (chatMember.status !== "left" && chatMember.status !== "kicked") {
      await ctx.reply("Привет я ваш виртуальный Ассистент.");
      await ctx.reply("Я помогу вам и дам ответы на ваши вопросы.");
      await ctx.reply("В пробной версии вы можете задать мне 3 вопроса.");
      await ctx.reply(
        "Чтобы пользоваться виртуальным Ассистентом без ограничений используйте команду /pay"
      );
      await ctx.reply("Для связи со специалистом используйте команду /manager");
      await ctx.reply("Чтобы настроить работу бота используйте команду /settings");
      await ctx.reply("Для помощи используйте команду /help");
      bot.context.startGpt = true;
    } else {
      await ctx.reply(
        "Что бы начать пользоваться ботом подпишитесь на группу Телеграм",
        Markup.inlineKeyboard([
          Markup.button.url("Вступить в Группу", "https://t.me/LawsOfTheSage"),
        ])
      );
      if (dataUser === null) {
        try {
          const chatMember = await ctx.telegram.getChatMember(chatId, userId);
          const dataClient = {
            userID: chatMember.user.id,
            role: "user",
            first_name: chatMember.user.first_name,
            last_name: chatMember.user.last_name,
            username: chatMember.user.username,
            language_code: chatMember.user.language_code,
            messages: [],
            subscription: false,
            expirationTime: new Date(),
            counterSub: 3,
            ask: { text: true, audio: false },
            getResponseAudio: false,
          };
          await client.db("assistantGPT").collection("users").insertOne(dataClient);
        } catch (error) {
          console.error("error: добавления пользователя в базу данных", error.message);
        }
      } else {
        return;
      }
    }
  } catch (error) {
    console.log(error.message);
    await ctx.reply("Произошла ошибка перезапустите бота командой /start");
  }
}
