const express = require("express");
const crypto = require("crypto");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
const helmet = require("helmet");
const morgan = require("morgan");

require("dotenv").config();

const {
  CORS_ORIGIN,
  PUBLIC_KEY,
  PRIVATE_KEY,
  TELEGRAM_BOT_TOKEN,
  TELEGRAM_CHAT_ID,
  PORT = 3001,
} = process.env;
if (
  !CORS_ORIGIN ||
  !PUBLIC_KEY ||
  !PRIVATE_KEY ||
  !TELEGRAM_BOT_TOKEN ||
  !TELEGRAM_CHAT_ID
) {
  console.error("Missing required environment variables.");
  process.exit(1);
}
const app = express();

app.use(helmet());
app.use(morgan('combined')); // Logging

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, 
  max: 100, 
});
app.use(limiter);

const corsOptions = {
  origin: CORS_ORIGIN,
  optionsSuccessStatus: 200,
  methods: ["GET", "POST"],
  allowedHeaders: ["Content-Type", "Authorization"],
};

app.use(cors(corsOptions));
app.use(express.urlencoded({ extended: true, limit: "10kb" }));
app.use(express.json());

function generateLiqPayParams(params) {
  const data = Buffer.from(JSON.stringify(params)).toString("base64");
  const signature = crypto
    .createHash("sha1")
    .update(PRIVATE_KEY + data + PRIVATE_KEY)
    .digest("base64");
  return { data, signature };
}

// Головна сторінка для тесту форми
app.get("/", (req, res) => {
  const params = {
    public_key: PUBLIC_KEY,
    version: "3",
    action: "pay",
    amount: "1",
    currency: "UAH",
    description: "Test payment",
    order_id: `order_${Date.now()}`, // Унікальний order_id
    // server_url: "https://www.screenphotoschool.com.ua/callback",
  };

  const { data, signature } = generateLiqPayParams(params);
  res.send(`
    <form method="POST" action="https://www.liqpay.ua/api/3/checkout" accept-charset="utf-8">
      <input type="hidden" name="data" value="${data}" />
      <input type="hidden" name="signature" value="${signature}" />
      <input type="submit" value="Оплатити" />
    </form>
  `);
});

// Ендпоінт для обробки callback від LiqPay
app.post("/pay", (req, res) => {
  const { amount, description, order_id } = req.body;

  if (!amount || !description || !order_id) {
    return res.status(400).json({ error: "Missing required parameters" });
  }

  const params = {
    public_key: PUBLIC_KEY,
    version: "3",
    action: "pay",
    amount: amount.toString(),
    currency: "UAH",
    description,
    order_id,
    server_url: "https://www.screenphotoschool.com.ua/",
  };

  const { data, signature } = generateLiqPayParams(params);

  res.json({ data, signature });
});

app.post("/callback", async (req, res) => {
  const { data, signature } = req.body;

  // Перевірка підпису
  const expectedSignature = crypto
    .createHash("sha1")
    .update(PRIVATE_KEY + data + PRIVATE_KEY)
    .digest("base64");

  if (signature !== expectedSignature) {
    return res.status(400).send("Invalid signature");
  }

  const decodedData = JSON.parse(Buffer.from(data, "base64").toString());

  // Обробка даних платежу
  console.log("Payment data:", decodedData);

  if (decodedData.status === "success") {
    console.log("Preparing to send Telegram message");
    const text = `Підтверджено оплату на суму ${decodedData.amount} UAH для замовлення ${decodedData.order_id}.`;
    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage?chat_id=${TELEGRAM_CHAT_ID}&text=${encodeURIComponent(
      text
    )}`;

    try {
      console.log("Sending request to Telegram API");
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-type": "application/json" },
      });
      const data = await response.json();

      if (!data.ok) {
        console.error("Error sending to Telegram:", data);
      } else {
        console.log("Message sent to Telegram successfully");
      }
    } catch (error) {
      console.error("Error:", error);
    }
  } else {
    console.log("Payment status is not success:", decodedData.status);
  }

  res.status(200).send("OK");
});

// Запуск сервера
app.listen(PORT, () => {
  console.log(`Сервер запущено на порту ${PORT}`);
});

