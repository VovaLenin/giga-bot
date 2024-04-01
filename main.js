const { TelegramClient } = require("telegram");
const { Telegraf } = require("telegraf");
const { NewMessage } = require("telegram/events");
const { session, apiId, apiHash, botToken } = require("./config");
const { giga } = require("./giga");

const bot = new Telegraf(botToken);

bot.command("watch", (ctx) => {
  const channelId = ctx.message.text.split(" ")[1];
  ctx.reply(`Channel ID: ${channelId}`);
});

const client = new TelegramClient(session, apiId, apiHash, {});

function watchNewMessages(channelId) {
  client.addEventHandler((event) => {
    console.log("new message", event.message.message);
  }, new NewMessage({ fromUsers: [channelId] }));
}
const MAX_RETRIES = 5;
const RETRY_TIMEOUT = 3000;

async function getUnreadMessages(channelId, limit = 10, retries = MAX_RETRIES) {
  try {
    const entity = await client.getEntity(channelId);
    const messages = await client.getMessages(entity, { limit: 10 });
    return messages.map((m) => m.message).join(" ");
  } catch (error) {
    console.error(error);
    if (retries > 0) {
      console.log(
        `Попытка ${
          MAX_RETRIES - retries + 1
        }: повторное подключение через ${RETRY_TIMEOUT} мс...`
      );
      await new Promise((resolve) => setTimeout(resolve, RETRY_TIMEOUT));
      return getUnreadMessages(channelId, limit, retries - 1);
    } else {
      throw new Error("Превышено максимальное количество попыток подключения");
    }
  }
}

(async function run() {
  // const channel = 'whale_alert_io' // for_demo_api

  // watchNewMessages(channel);

  await client.connect();

  bot.command("sum", async (ctx) => {
    const [, channelId, ...task] = ctx.message.text.split(" ");
    if (!channelId) {
      return ctx.reply(`Вы не указали канал`);
    }

    const messagesString = await getUnreadMessages(channelId, 10);
    const gigaResponse = await giga(messagesString, task.join(" "));
    await ctx.reply(gigaResponse);
  });

  bot.catch((error, ctx) => {
    console.error(
      `Произошла ошибка для обновления типа ${ctx.updateType}:`,
      error
    );

    if (ctx && ctx.chat) {
      ctx
        .reply(
          "Извините, произошла ошибка. Пожалуйста, попробуйте еще раз позже."
        )
        .catch((errorMessage) => {
          console.error(
            "Произошла ошибка при отправке сообщения об ошибке пользователю:",
            errorMessage
          );
        });
    }
  });

  bot.launch();
})();
