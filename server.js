const express = require("express");

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const PORT = process.env.PORT || 10000;

// ===============================
// Telegram
// ===============================

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

// ===============================
// اطلاعات قرعه‌کشی
// ===============================

const draws = [
  {
    id: "draw-70000",
    type: "cash",
    title: "قرعه‌کشی ۷۰ هزار تومانی",
    prize: "۷۰٬۰۰۰ تومان",
    capacity: 10,
    entry: "رایگان",
    start: "پس از تکمیل ظرفیت"
  }
];

// ===============================
// ثبت‌نام‌های موقت
// ===============================

const registrations = [];

// ===============================
// صفحه اصلی سرور
// ===============================

app.get("/", (req, res) => {
  res.json({
    status: "online",
    message: "سرور پاداش CP در حال اجرا است",
    time: new Date().toISOString()
  });
});

// ===============================
// دریافت اطلاعات قرعه‌کشی
// ===============================

app.get("/draws", (req, res) => {
  res.json({
    success: true,
    draws: draws
  });
});

// ===============================
// تعداد ثبت‌نام‌ها
// ===============================

app.get("/registrations/count", (req, res) => {
  res.json({
    success: true,
    count: registrations.length
  });
});

// ===============================
// ثبت‌نام
// ===============================

app.post("/register", async (req, res) => {
  try {
    const {
      name,
      username,
      phone,
      userId,
      drawId
    } = req.body;

    // بررسی اطلاعات ضروری
    if (!name || !username || !drawId) {
      return res.status(400).json({
        success: false,
        message: "نام، نام کاربری و شناسه قرعه‌کشی الزامی است."
      });
    }

    // پیدا کردن قرعه‌کشی
    const draw = draws.find(item => item.id === drawId);

    if (!draw) {
      return res.status(404).json({
        success: false,
        message: "قرعه‌کشی موردنظر پیدا نشد."
      });
    }

    // بررسی ظرفیت
    const drawRegistrations = registrations.filter(
      item => item.drawId === drawId
    );

    if (drawRegistrations.length >= draw.capacity) {
      return res.status(400).json({
        success: false,
        message: "ظرفیت این قرعه‌کشی تکمیل شده است."
      });
    }

    // جلوگیری از ثبت‌نام تکراری
    const duplicate = registrations.find(
      item =>
        item.drawId === drawId &&
        item.username.toLowerCase() === username.toLowerCase()
    );

    if (duplicate) {
      return res.status(400).json({
        success: false,
        message: "شما قبلاً در این قرعه‌کشی ثبت‌نام کرده‌اید."
      });
    }

    // ساخت اطلاعات ثبت‌نام
    const registration = {
      id: Date.now().toString(),
      name,
      username,
      phone: phone || "",
      userId: userId || "",
      drawId,
      drawTitle: draw.title,
      createdAt: new Date().toISOString()
    };

    registrations.push(registration);

    // ارسال پیام به تلگرام
    await sendTelegramMessage(registration);

    return res.json({
      success: true,
      message: "ثبت‌نام با موفقیت انجام شد.",
      registrationId: registration.id
    });

  } catch (error) {
    console.error("REGISTER ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "خطا در ثبت‌نام.",
      error: error.message
    });
  }
});

// ===============================
// ارسال پیام به تلگرام
// ===============================

async function sendTelegramMessage(registration) {

  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
    console.log("Telegram variables are not configured.");
    return;
  }

  const text = `
🎟 ثبت‌نام جدید قرعه‌کشی

🎁 قرعه‌کشی:
${registration.drawTitle}

👤 نام:
${registration.name}

📱 نام کاربری:
${registration.username}

☎️ شماره:
${registration.phone || "ثبت نشده"}

🆔 User ID:
${registration.userId || "ثبت نشده"}

🕐 زمان:
${new Date(registration.createdAt).toLocaleString("fa-IR")}

🆔 کد ثبت‌نام:
${registration.id}
`;

  const url =
    `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      chat_id: TELEGRAM_CHAT_ID,
      text: text
    })
  });

  const data = await response.json();

  if (!data.ok) {
    console.error("Telegram Error:", data);
  }
}

// ===============================
// تست تلگرام
// ===============================

app.get("/telegram-test", async (req, res) => {

  try {

    if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
      return res.status(500).json({
        success: false,
        message: "متغیرهای تلگرام در Render تنظیم نشده‌اند."
      });
    }

    const url =
      `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        chat_id: TELEGRAM_CHAT_ID,
        text: "✅ اتصال سرور به ربات تلگرام برقرار است."
      })
    });

    const data = await response.json();

    res.json({
      success: data.ok,
      telegram: data
    });

  } catch (error) {

    res.status(500).json({
      success: false,
      message: error.message
    });

  }

});

// ===============================
// شروع سرور
// ===============================

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
