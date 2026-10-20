
const express = require("express");
const cors = require("cors");
const TelegramBot = require("node-telegram-bot-api");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 10000;

app.use(cors());
app.use(express.json({ limit: "10mb" }));

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const ADMIN_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

// فهرست کدهای آزاد را اینجا قرار بده.
// کدهای قبلاً تخصیص‌یافته یا استفاده‌شده را وارد نکن.
const discountCodes = [
  // "YOUR_UNUSED_CODE_1",
  // "YOUR_UNUSED_CODE_2"
];

const DATA_FILE =
  process.env.DATA_FILE || "/var/data/cp-hub-state.json";

let payments = new Map();
let unusedCodes = [];
let approvedCount = 0;
let rejectedCount = 0;
let bot = null;

function saveState() {
  const dir = path.dirname(DATA_FILE);
  fs.mkdirSync(dir, { recursive: true });

  const tempFile = DATA_FILE + ".tmp";

  const data = {
    payments: Array.from(payments.entries()),
    unusedCodes,
    approvedCount,
    rejectedCount
  };

  fs.writeFileSync(tempFile, JSON.stringify(data), "utf8");
  fs.renameSync(tempFile, DATA_FILE);
}

function loadState() {
  if (fs.existsSync(DATA_FILE)) {
    const data = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));

    payments = new Map(data.payments || []);
    unusedCodes = data.unusedCodes || [];
    approvedCount = data.approvedCount || 0;
    rejectedCount = data.rejectedCount || 0;

    console.log("Persistent state loaded.");
  } else {
    unusedCodes = [...new Set(discountCodes)];
    saveState();
    console.log("Initial state saved.");
  }
}

function getStats() {
  return [
    "📊 آمار CP HUB",
    `✅ پرداخت‌های تأییدشده: ${approvedCount}`,
    `❌ پرداخت‌های ردشده: ${rejectedCount}`,
    `🎟️ کدهای باقی‌مانده: ${unusedCodes.length}`,
    `📦 تعداد اولیه کدها: ${discountCodes.length}`
  ].join("\n");
}

function assignCode(payment) {
  if (payment.discountCode) return payment.discountCode;
  if (unusedCodes.length === 0) return null;

  // حذف از فهرست آزاد
  const code = unusedCodes.shift();

  payment.discountCode = code;
  payment.status = "approved";
  payment.reviewedAt = new Date().toISOString();
  approvedCount++;

  // ابتدا ذخیره دائمی، سپس ارسال کد به کاربر
  try {
    saveState();
  } catch (error) {
    // اگر ذخیره شکست خورد، کد را دوباره آزاد کن
    unusedCodes.unshift(code);
    payment.discountCode = null;
    payment.status = "pending";
    payment.reviewedAt = null;
    approvedCount--;
    throw error;
  }

  return code;
}

try {
  loadState();
} catch (error) {
  console.error("Cannot load/save persistent state:", error.message);
  process.exit(1);
}

if (BOT_TOKEN && ADMIN_CHAT_ID) {
  bot = new TelegramBot(BOT_TOKEN, { polling: true });

  bot.on("polling_error", error => {
    console.error("Telegram polling error:", error.message);
  });

  bot.on("callback_query", async query => {
    try {
      const parts = (query.data || "").split(":");
      if (parts.length !== 3 || parts[0] !== "payment") return;

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
          text: "درخواست پیدا نشد."
        });
        return;
      }

      if (payment.status !== "pending") {
        await bot.answerCallbackQuery(query.id, {
          text: "این درخواست قبلاً بررسی شده است."
        });
        return;
      }

      if (action === "approve") {
        if (unusedCodes.length === 0) {
          await bot.answerCallbackQuery(query.id, {
            text: "کد تخفیف باقی نمانده است."
          });
          await bot.sendMessage(
            ADMIN_CHAT_ID,
            "⚠️ کد تخفیف آزاد موجود نیست؛ پرداخت تأیید نشد."
          );
          return;
        }

        const code = assignCode(payment);

        await bot.answerCallbackQuery(query.id, {
          text: "پرداخت تأیید شد."
        });

        await bot.sendMessage(ADMIN_CHAT_ID, [
          "✅ پرداخت تأیید شد.",
          `🆔 درخواست: ${paymentId}`,
          `🎟️ کد اختصاص‌یافته: ${code}`,
          "",
          getStats()
        ].join("\n"));

      } else if (action === "reject") {
        payment.status = "rejected";
        payment.reviewedAt = new Date().toISOString();
        rejectedCount++;
        saveState();

        await bot.answerCallbackQuery(query.id, {
          text: "پرداخت رد شد."
        });

        await bot.sendMessage(
          ADMIN_CHAT_ID,
          `❌ پرداخت ${paymentId} رد شد.\n\n${getStats()}`
        );
      } else {
        return;
      }

      try {
        await bot.editMessageReplyMarkup(
          { inline_keyboard: [] },
          {
            chat_id: query.message.chat.id,
            message_id: query.message.message_id
          }
        );
      } catch (error) {
        console.error("Telegram markup update error:", error.message);
      }

    } catch (error) {
      console.error("Telegram callback error:", error.message);
    }
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
      createdAt: new Date().toISOString(),
      discountCode: null,
      reviewedAt: null
    };

    payments.set(paymentId, payment);

    try {
      saveState();
    } catch (error) {
      payments.delete(paymentId);
      throw error;
    }

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

    await bot.sendPhoto(ADMIN_CHAT_ID, imageBuffer, {
      caption,
      reply_markup: {
        inline_keyboard: [[
          {
            text: "✅ تأیید پرداخت",
            callback_data: `payment:approve:${paymentId}`
          },
          {
            text: "❌ رد پرداخت",
            callback_data: `payment:reject:${paymentId}`
          }
        ]]
      }
    });

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

  const response = {
    success: true,
    paymentId: payment.id,
    status: payment.status
  };

  if (payment.status === "approved" && payment.discountCode) {
    response.discountCode = payment.discountCode;
    response.instruction =
      "کد اختصاص‌یافته را در قسمت کد تخفیف پرداخت بازار وارد کن.";
  }

  res.json(response);
});

app.get("/api/admin/stats", (req, res) => {
  const suppliedKey = req.get("x-admin-key");

  if (
    !process.env.ADMIN_API_KEY ||
    suppliedKey !== process.env.ADMIN_API_KEY
  ) {
    return res.status(401).json({
      success: false,
      message: "دسترسی مجاز نیست."
    });
  }

  res.json({
    success: true,
    approvedCount,
    rejectedCount,
    remainingCodes: unusedCodes.length,
    totalCodes: discountCodes.length
  });
});

app.listen(PORT, () => {
  console.log(`CP HUB server running on port ${PORT}`);
});
        
