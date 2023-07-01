import { Telegraf, session, Markup } from "telegraf";
import { message } from "telegraf/filters";
import { code } from "telegraf/format";

import config from "config";

import { ogg } from "./ogg.js";
import { openai } from "./openai.js";
import { textConverter } from "./text.js";

import { MongoClient } from "mongodb";

import {
  payHandler,
  managerHandler,
  settingsHandler,
  startHandler,
  adminPanelHandler,
  helpHandler,
} from "./component/commands.js";

import {
  startMiddleware,
  handleSubscriptionMiddleware,
  administrationMiddleware,
  maxMessageLengthMiddleware,
  handleAskQuestionMiddleware,
  responseMessageAssistantMiddleware,
} from "./component/middleware.js";

import { findUser, checkSubscriptions } from "./component/helpers.js";

import {
  actionCancelHandler,
  actionEntryMessageHandler,
  actionResponseMessageHandler,
  actionResponseAssistantTextHandler,
  actionResponseAssistantAudioHandler,
  actionAddHandler,
  actionDeleteHandler,
  actionDescriptionUserHandler,
  actionActivateSubscriptionHandler,
  actionUnActivateSubscriptionHandler,
  actionAskTextHandler,
  actionAskAllHandler,
} from "./component/action.js";

const bot = new Telegraf(config.get("TELEGRAM_TOKEN"));

const INITIAL_SESSION = {
  messages: [],
};

bot.context.initial_session = INITIAL_SESSION;
bot.context.startGpt = false;

const client = new MongoClient(config.get("MONGO_DB_CLIENT"), {
  useUnifiedTopology: true,
});

bot.use(session());

bot.command("start", async (ctx) => startHandler(ctx, bot));

bot.command("pay", async (ctx) => payHandler(ctx));

bot.command("manager", async (ctx) => managerHandler(ctx));

bot.command("settings", async (ctx) => settingsHandler(ctx));

bot.command("help", async (ctx) => helpHandler(ctx));

bot.command("admin", administrationMiddleware, (ctx) => adminPanelHandler(ctx));

bot.action("cancel", async (ctx) => actionCancelHandler(ctx));

bot.action("entryMsg", async (ctx) => actionEntryMessageHandler(ctx));

bot.action("responseMsg", responseMessageAssistantMiddleware, async (ctx) =>
  actionResponseMessageHandler(ctx)
);

bot.action("responseAssistantText", async (ctx) => actionResponseAssistantTextHandler(ctx, client));

bot.action("responseAssistantAudio", async (ctx) =>
  actionResponseAssistantAudioHandler(ctx, client)
);

bot.action("add", async (ctx) => actionAddHandler(ctx, bot));

bot.action("delete", async (ctx) => actionDeleteHandler(ctx, bot));

bot.action("descriptionUsers", async (ctx) => actionDescriptionUserHandler(ctx, bot));

bot.action("activateSubscription", async (ctx) =>
  actionActivateSubscriptionHandler(ctx, bot)
);

bot.action("unActivateSubscription", async (ctx) =>
  actionUnActivateSubscriptionHandler(ctx, bot)
);

bot.action("askText", async (ctx) => actionAskTextHandler(ctx, client));

bot.action("askAll", async (ctx) => actionAskAllHandler(ctx, client));

bot.on(
  message("voice"),
  startMiddleware,
  handleSubscriptionMiddleware,
  handleAskQuestionMiddleware,
  async (ctx) => {
    ctx.session ??= ctx.initial_session;
    const user = await findUser(ctx.message.from.id);
    try {
      await ctx.reply(code("Жду ответ..."));
      const userId = ctx.message.from.id;
      const link = await ctx.telegram.getFileLink(ctx.message.voice.file_id);
      const oggPath = await ogg.create(link.href, userId);
      const mp3Path = await ogg.toMp3(oggPath, userId);

      const text = await openai.transcription(mp3Path);
      await ctx.reply(code(`На Ваше сообщение: ${text}`));
      await ctx.reply(code("Если ответ не пришел в течении 5 минут повторите запрос"));

      ctx.session.messages.push({ role: openai.roles.USER, content: text });
      const response = await openai.chat(ctx.session.messages);

      ctx.session.messages.push({ role: openai.roles.ASSISTANT, content: response.content });

      if (user.getResponseAudio) {
        const audioMP3 = await textConverter.textToSpeech(response.content);
        await ctx.sendAudio({ source: audioMP3 }, { title: "Ответ", performer: "@assistantSage" });
      } else {
        await ctx.reply(response.content);
      }
    } catch (e) {
      console.log("error: voiceGPT", e.message);
      await ctx.reply(code(`Произошла ошибка: ${e.message} \nперезапустите бота /start`));
    }
  }
);

bot.on(
  message("text"),
  startMiddleware,
  handleSubscriptionMiddleware,
  maxMessageLengthMiddleware,
  async (ctx) => {
    ctx.session ??= ctx.initial_session;
    const dataUser = await findUser(ctx.message.from.id);
    const messagesArray = dataUser.messages;

    try {
      await ctx.reply(code("Жду ответ..."));
      await ctx.reply(code(`На Ваше сообщение: ${ctx.message.text}`));
      await ctx.reply(code("Если ответ не пришел в течении 5 минут повторите запрос"));
      ctx.session.messages.push({ role: openai.roles.USER, content: ctx.message.text });
      messagesArray.push(ctx.message.text);
      const response = await openai.chat(ctx.session.messages);
      ctx.session.messages.push({ role: openai.roles.ASSISTANT, content: response.content });

      if (dataUser.getResponseAudio) {
        const audioMP3 = await textConverter.textToSpeech(response.content);
        await ctx.sendAudio({ source: audioMP3 }, { title: "Ответ", performer: "@assistantSage" });
      } else {
        await ctx.reply(response.content);
      }

      await client
        .db("assistantGPT")
        .collection("users")
        .updateOne({ userID: ctx.message.from.id }, { $set: { messages: messagesArray } });

      if (dataUser.counterSub > 0) {
        await client
          .db("assistantGPT")
          .collection("users")
          .updateOne(
            { userID: ctx.message.from.id },
            { $set: { counterSub: dataUser.counterSub - 1 } }
          );
        await ctx.reply(
          code(
            `Вы можете задать еще ${dataUser.counterSub - 1} ${
              dataUser.counterSub - 1 === 1 ? "вопрос" : "вопроса"
            }`
          )
        );
      } else if (dataUser.counterSub === 1) {
        await ctx.reply(code("Оформите подписку"));
      }
    } catch (e) {
      console.log("error: textGPT", e.message);
      ctx.reply(code(`Произошла ошибка: ${e.message} \nперезапустите бота /start`));
    }
  }
);

setInterval(checkSubscriptions, 1 * 60 * 1000);

bot.launch();

process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
