const express = require("express");
const crypto = require("crypto");
const cors = require("cors");
require("dotenv").config();

const { CORS_ORIGIN, PUBLIC_KEY, PRIVATE_KEY, PORT = 3001 } = process.env;
if (!CORS_ORIGIN || !PUBLIC_KEY || !PRIVATE_KEY) {
  console.error("Missing required environment variables.");
  process.exit(1);
}
const app = express();



const corsOptions = {
  origin: CORS_ORIGIN,
  optionsSuccessStatus: 200,
};

app.use(cors(corsOptions));
app.use(express.urlencoded({ extended: true }));
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
    server_url: "https://www.screenphotoschool.com.ua/callback",
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
    server_url: "https://www.screenphotoschool.com.ua/callback",
  };

  const { data, signature } = generateLiqPayParams(params);

  res.json({ data, signature });
});

app.post("/callback", (req, res) => {
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

  // Тут ви можете додати логіку обробки успішного платежу

  res.status(200).send("OK");
});

// Запуск сервера
app.listen(PORT, () => {
  console.log(`Сервер запущено на порту ${PORT}`);
});
