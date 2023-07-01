import { findUser } from "./helpers.js";
import { code } from "telegraf/format";

export async function startMiddleware(ctx, next) {
  if (ctx.startGpt) {
    return next();
  } else {
    return;
  }
}

export async function handleSubscriptionMiddleware(ctx, next) {
  const dataUser = await findUser(ctx.message.from.id);
  if (dataUser.subscription || dataUser.counterSub > 0) {
    return next();
  } else {
    await ctx.reply(code("Чтобы продолжить пользоваться сервисом, оформите подписку"));
  }
}

export async function administrationMiddleware(ctx, next) {
  const dataUser = await findUser(ctx.message.from.id);
  if (dataUser.role === "admin") {
    return next();
  } else {
    await ctx.reply(code("Что бы использовать эту команду нужно иметь права администратора"));
  }
}

export async function maxMessageLengthMiddleware(ctx, next) {
  if (ctx.message && ctx.message.text) {
    const maxLength = 100;
    const messageLength = ctx.message.text.length;

    if (messageLength > maxLength) {
      await ctx.reply(
        "Превышена максимальная длина запроса (100 символов). Пожалуйста, введите короткое сообщение."
      );
      return;
    }
  }
  return next();
}

export async function handleAskQuestionMiddleware(ctx, next) {
  const dataUser = await findUser(ctx.message.from.id);
  if (dataUser.ask.audio) {
    return next();
  } else {
    await ctx.reply(
      "Что бы задать вопросос голосом, включите:\nЗадать вопрос Текст и Аудио в настройках /settings "
    );
  }
}

export async function responseMessageAssistantMiddleware(ctx, next) {
  const dataUser = await findUser(ctx.update.callback_query.from.id);
  if (dataUser.subscription) {
    return next();
  } else {
    await ctx.reply("Что бы получать аудио ответ. Подключите подписку /pay ");
  }
}
