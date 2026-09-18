const express = require("express");
const cors = require("cors");

const app = express();

app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

// صفحه اصلی
app.get("/", (req, res) => {
  res.json({
    status: "online",
    message: "سرور پاداش CP در حال اجرا است"
  });
});

// تست سرور
app.get("/health", (req, res) => {
  res.json({
    status: "ok"
  });
});

// ارسال سفارش به تلگرام
async function sendTelegram(order) {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
    console.log("Telegram variables are not configured.");
    return;
  }

  const message =
`🛒 سفارش جدید CP

🆔 شماره سفارش:
${order.id}

👤 Player ID:
${order.playerID}

💰 مقدار CP:
${order.cp}

📦 بسته:
${order.packageName}

⏰ زمان:
${order.createdAt}`;

  const response = await fetch(
    `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        chat_id: TELEGRAM_CHAT_ID,
        text: message
      })
    }
  );

  const data = await response.json();

  if (!data.ok) {
    console.log("Telegram error:", data.description);
  }
}

// ثبت سفارش
app.post("/api/orders", async (req, res) => {
  try {
    const { playerID, cp, packageName } = req.body;

    if (!playerID || !cp) {
      return res.status(400).json({
        success: false,
        message: "Player ID و مقدار CP الزامی است."
      });
    }

    const order = {
      id: "CP-" + Date.now(),
      playerID: String(playerID),
      cp: String(cp),
      packageName: packageName || `${cp} CP`,
      status: "pending",
      createdAt: new Date().toISOString()
    };

    console.log("New order:", order);

    await sendTelegram(order);

    res.json({
      success: true,
      message: "سفارش ثبت شد.",
      order: order
    });

  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: "خطا در ثبت سفارش"
    });
  }
});

// دریافت سفارش‌ها
app.get("/api/orders", (req, res) => {
  res.json({
    success: true,
    message: "Orders endpoint is working"
  });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
