import { Markup } from "telegraf";
import { code } from "telegraf/format";

import {
  generateAdminsButtons,
  updateRoleAdmin,
  activateSubscription,
  deleteSubscription,
} from "./helpers.js";

export async function actionCancelHandler(ctx) {
  const questionMessageId = ctx.update.callback_query.message.message_id;
  ctx.deleteMessage(questionMessageId);
}

export async function actionEntryMessageHandler(ctx) {
  await ctx.answerCbQuery();
  await ctx.deleteMessage();
  await ctx.reply(
    code("Как вы хотите задать вопрос виртуальному Ассистенту?"),
    Markup.inlineKeyboard([
      [
        Markup.button.callback("Текст", "askText"),
        Markup.button.callback("Текст и Аудио", "askAll"),
      ],
      [Markup.button.callback("Отменить", "cancel")],
    ])
  );
}

export async function actionResponseMessageHandler(ctx) {
  await ctx.answerCbQuery();
  await ctx.deleteMessage();
  await ctx.reply(
    code(
      "Как вы хотите получить ответ от виртуального Ассистента?\nТолько для оформленной подписки"
    ),
    Markup.inlineKeyboard([
      [
        Markup.button.callback("Текст", "responseAssistantText"),
        Markup.button.callback("Аудио", "responseAssistantAudio"),
      ],
      [Markup.button.callback("Отменить", "cancel")],
    ])
  );
}

export async function actionResponseAssistantTextHandler(ctx, client) {
  try {
    await ctx.answerCbQuery();
    await ctx.deleteMessage();
    await client
      .db("assistantGPT")
      .collection("users")
      .updateOne(
        { userID: ctx.update.callback_query.from.id },
        { $set: { getResponseAudio: false } }
      );
    await ctx.reply(code("Виртуальный Ассистент будет овечать вам текстом"));
  } catch (error) {
    console.log(error.message);
  }
}

export async function actionResponseAssistantAudioHandler(ctx, client) {
  try {
    await ctx.answerCbQuery();
    await ctx.deleteMessage();
    await client
      .db("assistantGPT")
      .collection("users")
      .updateOne(
        { userID: ctx.update.callback_query.from.id },
        { $set: { getResponseAudio: true } }
      );
    await ctx.reply(code("Виртуальный Ассистент будет овечать вам аудио"));
  } catch (error) {
    console.log(error.message);
  }
}

export async function actionAddHandler(ctx, bot) {
  await ctx.answerCbQuery();
  await ctx.deleteMessage();
  const buttons = await generateAdminsButtons("admin");
  await ctx.reply("Добавить Администратора:", buttons);
  await updateRoleAdmin("admin", bot);
}

export async function actionDeleteHandler(ctx, bot) {
  await ctx.answerCbQuery();
  await ctx.deleteMessage();
  const buttons = await generateAdminsButtons("user");
  await ctx.reply("Удалить Администратора:", buttons);
  await updateRoleAdmin("user", bot);
}

export async function actionDescriptionUserHandler(ctx, bot) {
  await ctx.answerCbQuery();
  const buttons = await generateAdminsButtons("data");
  await ctx.reply("Данные пользователей:", buttons);
  await updateRoleAdmin("data", bot);
  await ctx.deleteMessage();
}

export async function actionActivateSubscriptionHandler(ctx, bot) {
  await ctx.answerCbQuery();
  const buttons = await generateAdminsButtons("active");
  await ctx.reply("Активировать подписку пользователя:", buttons);
  await activateSubscription("active", bot);
  await ctx.deleteMessage();
}

export async function actionUnActivateSubscriptionHandler(ctx, bot) {
  await ctx.answerCbQuery();
  const buttons = await generateAdminsButtons("delSubscription");
  await ctx.reply("Деактивировать подписку пользователя:", buttons);
  await deleteSubscription("delSubscription", bot);
  await ctx.deleteMessage();
}

export async function actionAskTextHandler(ctx, client) {
  try {
    await ctx.answerCbQuery();
    await ctx.deleteMessage();
    await client
      .db("assistantGPT")
      .collection("users")
      .updateOne(
        { userID: ctx.update.callback_query.from.id },
        { $set: { ask: { text: true, audio: false } } }
      );
    await ctx.reply("Вы можете задавать вопросы только Текстом");
  } catch (error) {
    console.log("error: добавления вопроса только текстом", error.message);
  }
}

export async function actionAskAllHandler(ctx, client) {
  try {
    await ctx.answerCbQuery();
    await ctx.deleteMessage();
    await client
      .db("assistantGPT")
      .collection("users")
      .updateOne(
        { userID: ctx.update.callback_query.from.id },
        { $set: { ask: { text: true, audio: true } } }
      );
    await ctx.reply("Вы можете задавать вопросы Текстом и Аудио");
  } catch (error) {
    console.log("error: добавления вопроса текстом и аудои", error.message);
  }
}
