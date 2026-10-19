
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

// کدهای ساخته‌شده توسط پشتیبانی بازار
const discountCodes = [
  "J1F5Q6CCZ2", "AI67VXFB8M", "YGVC3RFIA3",
  "XQRFJD84RB", "WQ10YS0WKV", "GOGX2VRDGC",
  "Z5NO12WYXB", "CLSTZ4X8OE", "2PCZ0799YR",
  "LZWFNN8U8D", "25UD9QTOUD", "XVA1M4TYYY",
  "YMUN0X0T1Q", "9E11976BDC", "T5ZAZAB721",
  "65UBH8K0N0", "08NGIIG6O2", "W3P5SDK936",
  "E3NGG457AG", "2ZEVBZS2HF", "8UXWKIRWJV",
  "3H4GNJBGDN", "0CVRSM3RAN", "WAH2JK0V21",
  "E1CPLYFZWS", "UTFFLNUWU6", "PRG7E9Z5IP",
  "I779NXO1FM", "STV43YYY5X", "497CU2B76P",
  "5PW8NP0PU1", "615YGUZ110", "OJCPBEB4ST",
  "E0AZ2LJT13", "2J3Y2PKQ50", "CLPBUFRMUA",
  "SLTEE2FC1H", "FT0EPZMKZQ", "ABQ4TPHUM3",
  "SUVQCB9UC9", "BU68UUWF7J", "SGIQVIJ7N4",
  "JOUPIOJJB1", "27HIFIACJB", "BE3G2UUW4A",
  "U8VPVG141N", "S9NKVG9PNT", "702CFT6A79",
  "O4SA0K4FGN", "F5473GRNGK", "DQ3U49SPTG",
  "R52QIC9NLC", "CGWV3I10MH", "NFQ2KAHGGV",
  "ZRTTLL3IR9", "22CW4WG0M5", "BYHAWPW6F4",
  "ZAO6904AQW", "2ODCS5UIJI", "THPQVDDXCU",
  "O610EBN0VQ", "8EQ7A2PJ0N", "Z4G4WT9ZKU",
  "WJRU89W5H5", "6KJ3D5K7BF", "G6D4Z520FK",
  "YG04DI0FKB", "LBTKUIF3XY", "BINJJQCKZH",
  "WVNIYKVEM0", "1B0JOH0PWZ", "KRQEUX8QPT",
  "KEXXJY0F57", "VBRFEXGMLM", "0MYZBQ5V0N",
  "XKFSYWUUJH", "TCSXIADGFY", "I7WL3IRZ2D",
  "MS43M4BS67", "EAMVCMJN16", "448XAQ08HH",
  "PD01F5RJZY", "RWD4OWANDD", "4LR46OH645",
  "QQKLTVCCWQ", "9TKLYKY2CN", "9L6UZT157I",
  "FNSXIS55K6", "SZBTARZOTT", "0AB6ND0BQK",
  "SEXFHSHXDK", "CK8O765LMD", "ZYUKTC5E9A",
  "DY5PSZOT75", "7ROLXPTJ9U", "GYVVDUYOF8",
  "H0B8E0091C", "BGNCA8RKML", "EKTY2PY5DM",
  "LJCZYNBWQI"
];

const unusedCodes = new Set(discountCodes);
const payments = new Map();
const assignedCodes = new Set();

let approvedCount = 0;
let rejectedCount = 0;
let bot = null;

function getStats() {
  return [
    "📊 آمار CP HUB",
    `✅ پرداخت‌های تأییدشده: ${approvedCount}`,
    `❌ پرداخت‌های ردشده: ${rejectedCount}`,
    `🎟️ کدهای باقی‌مانده: ${unusedCodes.size}`,
    `📦 تعداد اولیه کدها: ${discountCodes.length}`
  ].join("\n");
}

async function sendStats() {
  if (!bot) return;
  await bot.sendMessage(ADMIN_CHAT_ID, getStats());
}

function assignCode(payment) {
  if (payment.discountCode) {
    return payment.discountCode;
  }

  const code = unusedCodes.values().next().value;
  if (!code) return null;

  unusedCodes.delete(code);
  assignedCodes.add(code);
  payment.discountCode = code;

  return code;
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
          text: "درخواست پیدا نشد؛ ممکن است سرور دوباره راه‌اندازی شده باشد."
        });
        return;
      }

      if (payment.status !== "pending") {
        await bot.answerCallbackQuery(query.id, {
          text: "این درخواست قبلاً بررسی شده است."
        });
        return;
      }

      if (action !== "approve" && action !== "reject") return;

      if (action === "approve") {
        const code = assignCode(payment);

        if (!code) {
          await bot.answerCallbackQuery(query.id, {
            text: "کد تخفیف باقی نمانده است."
          });
          await bot.sendMessage(
            ADMIN_CHAT_ID,
            "⚠️ پرداخت تأیید نشد؛ کد تخفیفی برای اختصاص باقی نمانده است."
          );
          return;
        }

        payment.status = "approved";
        payment.reviewedAt = new Date().toISOString();
        approvedCount++;
      } else {
        payment.status = "rejected";
        payment.reviewedAt = new Date().toISOString();
        rejectedCount++;
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

      await bot.answerCallbackQuery(query.id, {
        text: action === "approve" ? "پرداخت تأیید شد." : "پرداخت رد شد."
      });

      if (action === "approve") {
        await bot.sendMessage(
          ADMIN_CHAT_ID,
          [
            "✅ پرداخت تأیید شد.",
            `🆔 درخواست: ${paymentId}`,
            `🎟️ کد اختصاص‌یافته: ${payment.discountCode}`,
            "",
            getStats()
          ].join("\n")
        );
      } else {
        await bot.sendMessage(
          ADMIN_CHAT_ID,
          `❌ پرداخت ${paymentId} رد شد.\n\n${getStats()}`
        );
      }
    } catch (error) {
      console.error("Telegram callback error:", error.message);
    }
  });
}

app.get("/", (req, res) => {
  res.json({ status: "online", message: "سرور CP HUB فعال است" });
});

app.get("/health", (req, res) => {
  res.json({ status: "online" });
});

// ثبت درخواست پرداخت
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
      discountCode: null
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

// بررسی وضعیت و دریافت کد پس از تأیید
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
      "این کد تخفیف ۱۰۰٪ به تو می‌دهد. کد را در قسمت «کد تخفیف» پرداخت آنلاین بازار وارد کن. این کد اختصاصی است و فقط یک بار قابل استفاده خواهد بود.";
  }

  res.json(response);
});

// دریافت آمار توسط مدیر
app.get("/api/admin/stats", (req, res) => {
  const suppliedKey = req.get("x-admin-key");

  if (!process.env.ADMIN_API_KEY ||
      suppliedKey !== process.env.ADMIN_API_KEY) {
    return res.status(401).json({
      success: false,
      message: "دسترسی مجاز نیست."
    });
  }

  res.json({
    success: true,
    approvedCount,
    rejectedCount,
    remainingCodes: unusedCodes.size,
    totalCodes: discountCodes.length
  });
});

app.listen(PORT, () => {
  console.log(`CP HUB server running on port ${PORT}`);
});
        
