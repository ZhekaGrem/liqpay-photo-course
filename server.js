const express = require("express");
const crypto = require("crypto");
const bodyParser = require("body-parser");

const app = express();
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

app.post("/callback", (req, res) => {
  const { data, signature } = req.body;

  const sign = crypto
    .createHmac("sha1", privateKey)
    .update(data)
    .digest("base64");

  if (sign === signature) {
    const decodedData = JSON.parse(
      Buffer.from(data, "base64").toString("utf-8")
    );
    console.log("Платіж успішний:", decodedData);
    // Тут ви можете обробити успішний платіж
    res.status(200).send("OK");
  } else {
    console.log("Невірний підпис");
    res.status(400).send("Bad Request");
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Сервер запущено на порту ${PORT}`);
});
