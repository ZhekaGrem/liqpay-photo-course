const express = require("express");
const crypto = require("crypto");
const cors = require("cors");
const bodyParser = require("body-parser");
require("dotenv").config();

const app = express();
app.use(cors());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

const publicKey = process.env.PUBLIC_KEY;
const privateKey = process.env.PRIVATE_KEY;

// Головна сторінка для тесту форми
app.get("/", (req, res) => {
  // Значення за замовчуванням для тестування
  const amount = "1";
  const description = "Test payment";
  const order_id = "order123";

  const params = {
    public_key: publicKey,
    version: "3",
    action: "pay",
    amount: amount.toString(),
    currency: "UAH",
    description: description,
    order_id: order_id,
    server_url: "http://yourdomain.com/callback", // URL для отримання callback від LiqPay
  };

  const data = Buffer.from(JSON.stringify(params)).toString("base64");
  const signature = crypto
    .createHash("sha1")
    .update(privateKey + data + privateKey)
    .digest("base64");

  res.send(`
    <form method="POST" action="https://www.liqpay.ua/api/3/checkout" accept-charset="utf-8">
      <input type="hidden" name="data" value="${data}" />
      <input type="hidden" name="signature" value="${signature}" />
      <input type="submit" value="Оплатити" />
    </form>
  `);
});

// Ендпоінт для обробки callback від LiqPay
app.post("/callback", (req, res) => {
  const data = req.body.data;
  const receivedSignature = req.body.signature;

  // Перевірка підпису для підтвердження цілісності даних
  const expectedSignature = crypto
    .createHash("sha1")
    .update(privateKey + data + privateKey)
    .digest("base64");

  if (receivedSignature === expectedSignature) {
    const parsedData = JSON.parse(Buffer.from(data, "base64").toString("utf8"));
    console.log("Callback data: ", parsedData);
    res.status(200).send("OK");
  } else {
    res.status(400).send("Invalid signature");
  }
});

// Запуск сервера
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Сервер запущено на порту ${PORT}`);
});
