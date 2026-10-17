
const express = require("express");
const cors = require("cors");
const TelegramBot = require("node-telegram-bot-api");
const crypto = require("crypto");

const app = express();
const PORT = process.env.PORT || 10000;

app.use(cors());
app.use(express.json({ limit: "10mb" }));

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const ADMIN_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

let bot = null;
const payments = new Map();

if (BOT_TOKEN && ADMIN_CHAT_ID) {
  bot = new TelegramBot(BOT_TOKEN, { polling: true });

  bot.on("polling_error", (error) => {
    console.error("Telegram polling error:", error.message);
  });

  bot.on("callback_query", async (query) => {
    const data = query.data || "";
    const parts = data.split(":");

    if (parts.length !== 3 || parts[0] !== "payment") {
      return;
    }

    const [, action, paymentId] = parts;

    if (String(query.from.id) !== String(ADMIN_CHAT_ID)) {
      await bot.answerCallbackQuery(query.id, {
        text: "اجازه دسترسی ندارید."
      });
      return;
    }

    const payment = payments.get(paymentId);

    if (!payment) {
      await bot.answerCallbackQuery(query.id, {
        text: "درخواست پیدا نشد یا سرور دوباره راه‌اندازی شده است."
      });
      return;
    }

    if (payment.status !== "pending") {
      await bot.answerCallbackQuery(query.id, {
        text: "این درخواست قبلاً بررسی شده است."
      });
      return;
    }

    if (action !== "approve" && action !== "reject") {
      return;
    }

    payment.status = action === "approve" ? "approved" : "rejected";
    payment.reviewedAt = new Date().toISOString();

    try {
      await bot.editMessageReplyMarkup(
        { inline_keyboard: [] },
        {
          chat_id: ADMIN_CHAT_ID,
          message_id: query.message.message_id
        }
      );
    } catch (error) {
      console.error("Could not update Telegram message:", error.message);
    }

    await bot.answerCallbackQuery(query.id, {
      text: action === "approve" ? "پرداخت تأیید شد." : "پرداخت رد شد."
    });

    await bot.sendMessage(
      ADMIN_CHAT_ID,
      action === "approve"
        ? `✅ پرداخت ${paymentId} تأیید شد.`
        : `❌ پرداخت ${paymentId} رد شد.`
    );
  });
}

app.get("/", (req, res) => {
  res.json({
    status: "online",
    message: "سرور CP HUB فعال است"
  });
});

app.get("/health", (req, res) => {
  res.json({ status: "online" });
});

// ثبت درخواست پرداخت و ارسال رسید برای مدیر
app.post("/api/payments", async (req, res) => {
  try {
    if (!bot) {
      return res.status(503).json({
        success: false,
        message: "ربات تلگرام تنظیم نشده است."
      });
    }

    const { userId, amount, receiptBase64, note } = req.body || {};

    if (!userId || !amount || !receiptBase64) {
      return res.status(400).json({
        success: false,
        message: "شناسه کاربر، مبلغ و تصویر رسید الزامی هستند."
      });
    }

    const parsedAmount = Number(amount);

    if (!Number.isSafeInteger(parsedAmount) || parsedAmount <= 0) {
      return res.status(400).json({
        success: false,
        message: "مبلغ پرداخت معتبر نیست."
      });
    }

    if (
      typeof receiptBase64 !== "string" ||
      receiptBase64.length > 8 * 1024 * 1024
    ) {
      return res.status(400).json({
        success: false,
        message: "تصویر رسید معتبر نیست یا بیش از حد بزرگ است."
      });
    }

    const match = receiptBase64.match(
      /^data:image\/(jpeg|jpg|png|webp);base64,([A-Za-z0-9+/=\r\n]+)$/i
    );

    if (!match) {
      return res.status(400).json({
        success: false,
        message: "رسید باید تصویر JPG، PNG یا WEBP باشد."
      });
    }

    const imageBuffer = Buffer.from(match[2], "base64");

    if (!imageBuffer.length || imageBuffer.length > 5 * 1024 * 1024) {
      return res.status(400).json({
        success: false,
        message: "حجم تصویر باید حداکثر ۵ مگابایت باشد."
      });
    }

    const paymentId = crypto.randomUUID();

    const payment = {
      id: paymentId,
      userId: String(userId),
      amount: parsedAmount,
      status: "pending",
      createdAt: new Date().toISOString()
    };

    payments.set(paymentId, payment);

    const caption = [
      "💳 درخواست جدید پرداخت CP HUB",
      "",
      `🆔 شناسه درخواست: ${paymentId}`,
      `👤 شناسه کاربر: ${payment.userId}`,
      `💰 مبلغ: ${parsedAmount.toLocaleString("fa-IR")} تومان`,
      note ? `📝 توضیحات: ${String(note).slice(0, 300)}` : "",
      "",
      "لطفاً رسید را بررسی کن."
    ].filter(Boolean).join("\n");

    await bot.sendPhoto(
      ADMIN_CHAT_ID,
      imageBuffer,
      {
        caption,
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: "✅ تأیید پرداخت",
                callback_data: `payment:approve:${paymentId}`
              },
              {
                text: "❌ رد پرداخت",
                callback_data: `payment:reject:${paymentId}`
              }
            ]
          ]
        }
      }
    );

    res.json({
      success: true,
      paymentId,
      status: payment.status,
      message: "رسید برای مدیر ارسال شد."
    });
  } catch (error) {
    console.error("Payment request error:", error.message);

    res.status(500).json({
      success: false,
      message: "ارسال درخواست پرداخت ناموفق بود."
    });
  }
});

// بررسی وضعیت پرداخت توسط برنامه
app.get("/api/payments/:id/status", (req, res) => {
  const payment = payments.get(req.params.id);

  if (!payment) {
    return res.status(404).json({
      success: false,
      message: "درخواست پیدا نشد."
    });
  }

  if (String(req.query.userId || "") !== payment.userId) {
    return res.status(403).json({
      success: false,
      message: "دسترسی مجاز نیست."
    });
  }

  res.json({
    success: true,
    paymentId: payment.id,
    status: payment.status
  });
});

app.listen(PORT, () => {
  console.log(`CP HUB server running on port ${PORT}`);
});
                                    
