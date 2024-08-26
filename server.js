const express = require("express");
const crypto = require("crypto");
const cors = require("cors");
const bodyParser = require("body-parser");



const app = express();
app.use(cors());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

const publicKey = process.env.PUBLIC_KEY;
const privateKey = process.env.PRIVATE_KEY;

app.get("/", (req, res) => {
  const params = {
    public_key: publicKey,
    version: "3",
    action: "pay",
    amount: "1",
    currency: "UAH",
    description: "Тестовий платіж",
    order_id: Date.now().toString(),
  };

  const data = Buffer.from(JSON.stringify(params)).toString("base64");
  const signature = crypto
    .createHmac("sha1", privateKey)
    .update(data)
    .digest("base64");

  res.send(`
    <form method="POST" action="https://www.liqpay.ua/api/3/checkout" accept-charset="utf-8">
      <input type="hidden" name="data" value="${data}" />
      <input type="hidden" name="signature" value="${signature}" />
      <input type="submit" value="Оплатити" />
    </form>
  `);
});

app.post("/", (req, res) => {
  const { amount, description, order_id } = req.body;

  const params = {
    public_key: publicKey,
    version: "3",
    action: "pay",
    amount: amount.toString(),
    currency: "UAH",
    description: description,
    order_id: order_id,
  };

  const data = Buffer.from(JSON.stringify(params)).toString("base64");
  const signature = crypto
    .createHmac("sha1", privateKey)
    .update(data)
    .digest("base64");

  res.json({ data, signature });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Сервер запущено на порту ${PORT}`);
});
