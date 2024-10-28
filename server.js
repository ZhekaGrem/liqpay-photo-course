const express = require("express");
const crypto = require("crypto");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const morgan = require("morgan");
require("dotenv").config();

// Environment variables validation
const requiredEnvVars = {
  CORS_ORIGIN: process.env.CORS_ORIGIN,
  PUBLIC_KEY: process.env.PUBLIC_KEY,
  PRIVATE_KEY: process.env.PRIVATE_KEY,
  TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN,
  TELEGRAM_CHAT_ID: process.env.TELEGRAM_CHAT_ID,
  PORT: process.env.PORT || 3001,
  NODE_ENV: process.env.NODE_ENV || "development",
};

Object.entries(requiredEnvVars).forEach(([key, value]) => {
  if (!value) {
    console.error(`Missing required environment variable: ${key}`);
    process.exit(1);
  }
});

const app = express();

// Security middlewares
app.use(helmet());
app.use(morgan("combined")); // Logging

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
});
app.use(limiter);

// CORS configuration
const corsOptions = {
  origin: requiredEnvVars.CORS_ORIGIN,
  optionsSuccessStatus: 200,
  methods: ["GET", "POST"],
  allowedHeaders: ["Content-Type", "Authorization"],
};
app.use(cors(corsOptions));

// Body parsers with size limits
app.use(express.json({ limit: "10kb" }));
app.use(express.urlencoded({ extended: true, limit: "10kb" }));

// Utility functions
function generateLiqPayParams(params) {
  try {
    const data = Buffer.from(JSON.stringify(params)).toString("base64");
    const signature = crypto
      .createHash("sha1")
      .update(requiredEnvVars.PRIVATE_KEY + data + requiredEnvVars.PRIVATE_KEY)
      .digest("base64");
    return { data, signature };
  } catch (error) {
    console.error("Error generating LiqPay params:", error);
    throw new Error("Failed to generate payment parameters");
  }
}

async function sendTelegramNotification(text) {
  const url = `https://api.telegram.org/bot${requiredEnvVars.TELEGRAM_BOT_TOKEN}/sendMessage`;
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: requiredEnvVars.TELEGRAM_CHAT_ID,
        text: text,
      }),
    });

    const data = await response.json();
    if (!data.ok) {
      throw new Error(
        data.description || "Failed to send Telegram notification"
      );
    }
    return true;
  } catch (error) {
    console.error("Telegram notification error:", error);
    return false;
  }
}

// Routes
app.get("/", (req, res) => {
  try {
    const params = {
      public_key: requiredEnvVars.PUBLIC_KEY,
      version: "3",
      action: "pay",
      amount: "1",
      currency: "UAH",
      description: "Test payment",
      order_id: `order_${Date.now()}`,
    };

    const { data, signature } = generateLiqPayParams(params);
    res.send(`
      <form method="POST" action="https://www.liqpay.ua/api/3/checkout" accept-charset="utf-8">
        <input type="hidden" name="data" value="${data}" />
        <input type="hidden" name="signature" value="${signature}" />
        <input type="submit" value="Оплатити" />
      </form>
    `);
  } catch (error) {
    console.error("Error generating payment form:", error);
    res.status(500).send("Internal Server Error");
  }
});

app.post("/pay", (req, res) => {
  try {
    const { amount, description, order_id } = req.body;

    if (!amount || !description || !order_id) {
      return res.status(400).json({ error: "Missing required parameters" });
    }

    const params = {
      public_key: requiredEnvVars.PUBLIC_KEY,
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
  } catch (error) {
    console.error("Error processing payment:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.post("/callback", async (req, res) => {
  try {
    const { data, signature } = req.body;

    if (!data || !signature) {
      return res.status(400).json({ error: "Missing data or signature" });
    }

    // Signature verification
    const expectedSignature = crypto
      .createHash("sha1")
      .update(requiredEnvVars.PRIVATE_KEY + data + requiredEnvVars.PRIVATE_KEY)
      .digest("base64");

    if (signature !== expectedSignature) {
      console.error("Invalid signature received");
      return res.status(400).json({ error: "Invalid signature" });
    }

    const decodedData = JSON.parse(Buffer.from(data, "base64").toString());
    console.log("Payment callback data:", decodedData);

    if (decodedData.status === "success") {
      const text = `✅ Підтверджено оплату!\n💰 Сума: ${
        decodedData.amount
      } UAH\n🔖 Замовлення: ${
        decodedData.order_id
      }\n📅 Дата: ${new Date().toLocaleString("uk-UA")}`;

      const notificationSent = await sendTelegramNotification(text);
      if (!notificationSent) {
        console.warn("Failed to send Telegram notification");
      }
    }

    res.status(200).send("OK");
  } catch (error) {
    console.error("Callback processing error:", error);
    res.status(500).send("Internal Server Error");
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: "Something broke!" });
});

// Start server
const server = app.listen(requiredEnvVars.PORT, () => {
  console.log(
    `Server running on port ${requiredEnvVars.PORT} in ${requiredEnvVars.NODE_ENV} mode`
  );
});

// Graceful shutdown
process.on("SIGTERM", () => {
  console.log("SIGTERM signal received: closing HTTP server");
  server.close(() => {
    console.log("HTTP server closed");
    process.exit(0);
  });
});
