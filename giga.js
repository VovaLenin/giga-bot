const { gigaAuth, gigaScope } = require("./config");
const { v4: uuidv4 } = require("uuid");
const axios = require("axios");
const qs = require("qs");
const https = require("https");

const agent = new https.Agent({
  rejectUnauthorized: false,
});

const MAX_RETRIES = 5;
const RETRY_TIMEOUT = 3000;

async function getToken() {
  const config = {
    method: "post",
    maxBodyLength: Infinity,
    url: "https://ngw.devices.sberbank.ru:9443/api/v2/oauth",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
      RqUID: uuidv4(),
      Authorization: `Basic ${gigaAuth}`,
    },
    data: qs.stringify({
      scope: gigaScope,
    }),
    httpsAgent: agent,
  };
  try {
    const response = await axios(config);
    const { access_token: accessToken, expires_at: expiresAt } = response.data;
    console.log("token");
    return { accessToken, expiresAt };
  } catch (error) {
    console.log(error);
  }
}

async function giga(content = "", system = "", retries = MAX_RETRIES) {
  if (!content) return;

  let lastError;
  for (let i = 0; i < MAX_RETRIES; i++) {
    try {
      const token = await getToken();
      if (!token || !token.accessToken) {
        throw new Error("Не удалось получить токен доступа.");
      }

      const messages = [];
      if (system) {
        messages.push({ role: "system", content: system });
      }

      const data = JSON.stringify({
        model: "GigaChat",
        messages: messages.concat([
          {
            role: "user",
            content,
          },
        ]),
        temperature: 1,
        top_p: 0.1,
        n: 1,
        stream: false,
        max_tokens: 512,
        repetition_penalty: 1,
        update_interval: 0,
      });

      const config = {
        method: "post",
        maxBodyLength: Infinity,
        url: "https://gigachat.devices.sberbank.ru/api/v1/chat/completions",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          Authorization: `Bearer ${token.accessToken}`,
        },
        data,
        httpsAgent: agent,
      };
      //

      const response = await axios(config);
      if (response.data.choices && response.data.choices.length > 0) {
        const message = response.data.choices[0].message;
        return message.content;
      } else {
        throw new Error("Ответ от GigaChat не содержит ожидаемых данных.");
      }
    } catch (error) {
      console.error(`Ошибка при вызове giga: ${error}`);
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, RETRY_TIMEOUT)); // Задержка перед следующей попыткой
    }
  }

  // Если нет удачных попыток после всех повторов, выбрасываем последнюю ошибку
  console.error("Ошибка на стороне генерации ответа");
  throw lastError;
}

module.exports = { giga };
