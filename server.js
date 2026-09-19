const express = require("express");

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 10000;

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

// برای تست، ثبت‌نام کاستوم‌ها در هر روز مجاز است.
// وقتی آماده برگزاری واقعی شد: false
const TEST_MODE = true;

// ===============================
// اطلاعات مسابقات
// ===============================

const draws = [
  {
    id: "draw-70000",
    type: "cash",
    title: "قرعه‌کشی ۷۰ هزار تومانی",
    prize: "۷۰٬۰۰۰ تومان",
    capacity: 10,
    map: "Shipment",
    entry: "رایگان",
    start: "پس از تکمیل ظرفیت"
  }
];

const customs = [
  {
    id: "paid-custom-1",
    type: "paid",
    title: "کاستوم جایزه‌دار پولی",
    prize: "۵۰۰٬۰۰۰ تومان",
    capacity: 100,
    day: "پنجشنبه",
    map: "Nuketown",
    entry: "تستی: رایگان",
    start: "پنجشنبه"
  },
  {
    id: "free-custom-1",
    type: "free",
    title: "کاستوم جایزه‌دار رایگان",
    prize: "۲۰۰٬۰۰۰ تومان",
    capacity: 100,
    day: "پنجشنبه",
    map: "Firing Range",
    entry: "رایگان",
    start: "پنجشنبه"
  }
];

// ثبت‌نام‌ها
const registrations = [];
const customRegistrations = [];

// ===============================
// ارسال پیام تلگرام
// ===============================

async function sendTelegram(message) {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
    console.log("Telegram environment variables are missing.");
    return;
  }

  try {
    const url =
      `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        chat_id: TELEGRAM_CHAT_ID,
        text: message
      })
    });

    const data = await response.json();

    if (!data.ok) {
      console.log("Telegram error:", data);
    }
  } catch (error) {
    console.log("Telegram send error:", error);
  }
}

// ===============================
// بررسی پنجشنبه
// ===============================

function isThursdayInTehran() {
  const weekday = new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    timeZone: "Asia/Tehran"
  }).format(new Date());

  return weekday === "Thursday";
}

// ===============================
// صفحه اصلی سرور
// ===============================

app.get("/", (req, res) => {
  res.json({
    status: "online",
    message: "CP Hub server is running"
  });
});

// ===============================
// Health
// ===============================

app.get("/health", (req, res) => {
  res.json({
    status: "ok"
  });
});

// ===============================
// دریافت قرعه‌کشی‌ها
// ===============================

app.get("/api/draws", (req, res) => {
  const result = draws.map(draw => {
    const count = registrations.filter(
      r => r.drawId === draw.id
    ).length;

    return {
      ...draw,
      registered: count,
      remaining: Math.max(draw.capacity - count, 0)
    };
  });

  res.json(result);
});

// ===============================
// ثبت‌نام قرعه‌کشی
// ===============================

app.post("/api/draws/:id/join", async (req, res) => {
  const drawId = req.params.id;
  const playerId = String(req.body.playerId || "").trim();

  if (!playerId) {
    return res.status(400).json({
      success: false,
      message: "Player ID را وارد کنید."
    });
  }

  const draw = draws.find(d => d.id === drawId);

  if (!draw) {
    return res.status(404).json({
      success: false,
      message: "مسابقه پیدا نشد."
    });
  }

  const alreadyJoined = registrations.some(
    r =>
      r.drawId === drawId &&
      r.playerId === playerId
  );

  if (alreadyJoined) {
    return res.status(400).json({
      success: false,
      message: "این Player ID قبلاً ثبت‌نام کرده است."
    });
  }

  const count = registrations.filter(
    r => r.drawId === drawId
  ).length;

  if (count >= draw.capacity) {
    return res.status(400).json({
      success: false,
      message: "ظرفیت مسابقه تکمیل شده است."
    });
  }

  const registration = {
    id: "REG-" + Date.now(),
    drawId,
    playerId,
    number: count + 1,
    createdAt: new Date().toISOString()
  };

  registrations.push(registration);

  const message = `
🎁 ثبت‌نام جدید CP Hub

🏆 مسابقه: ${draw.title}
💰 جایزه: ${draw.prize}
🗺 مپ: ${draw.map}

🆔 Player ID:
${playerId}

👤 شماره ثبت‌نام:
${registration.number}

💵 ورودی: رایگان

📊 ظرفیت:
${count + 1} / ${draw.capacity}

🔖 کد ثبت‌نام:
${registration.id}

⏰ زمان:
${new Date().toLocaleString("fa-IR", {
    timeZone: "Asia/Tehran"
  })}
`;

  await sendTelegram(message);

  res.json({
    success: true,
    message: "ثبت‌نام با موفقیت انجام شد.",
    registration
  });
});

// ===============================
// دریافت کاستوم‌ها
// ===============================

app.get("/api/customs", (req, res) => {
  const result = customs.map(custom => {
    const count = customRegistrations.filter(
      r => r.customId === custom.id
    ).length;

    return {
      ...custom,
      registered: count,
      remaining: Math.max(custom.capacity - count, 0),
      testMode: TEST_MODE
    };
  });

  res.json(result);
});

// ===============================
// ثبت‌نام کاستوم
// ===============================

app.post("/api/customs/:id/join", async (req, res) => {
  const customId = req.params.id;
  const playerId = String(req.body.playerId || "").trim();

  if (!playerId) {
    return res.status(400).json({
      success: false,
      message: "Player ID را وارد کنید."
    });
  }

  const custom = customs.find(
    c => c.id === customId
  );

  if (!custom) {
    return res.status(404).json({
      success: false,
      message: "کاستوم پیدا نشد."
    });
  }

  // در حالت واقعی فقط پنجشنبه
  if (!TEST_MODE && !isThursdayInTehran()) {
    return res.status(400).json({
      success: false,
      message: "این کاستوم فقط پنجشنبه‌ها برگزار می‌شود."
    });
  }

  const alreadyJoined = customRegistrations.some(
    r =>
      r.customId === customId &&
      r.playerId === playerId
  );

  if (alreadyJoined) {
    return res.status(400).json({
      success: false,
      message: "این Player ID قبلاً ثبت‌نام کرده است."
    });
  }

  const count = customRegistrations.filter(
    r => r.customId === customId
  ).length;

  if (count >= custom.capacity) {
    return res.status(400).json({
      success: false,
      message: "ظرفیت کاستوم تکمیل شده است."
    });
  }

  const registration = {
    id: "CUS-" + Date.now(),
    customId,
    playerId,
    number: count + 1,
    createdAt: new Date().toISOString()
  };

  customRegistrations.push(registration);

  const typeText =
    custom.type === "paid"
      ? "کاستوم جایزه‌دار پولی - حالت تست رایگان"
      : "کاستوم جایزه‌دار رایگان";

  const message = `
🎮 ثبت‌نام جدید CP Hub

🔥 نوع:
${typeText}

🏆 مسابقه:
${custom.title}

💰 جایزه:
${custom.prize}

🗺 مپ:
${custom.map}

📅 روز برگزاری:
پنجشنبه

🆔 Player ID:
${playerId}

👤 شماره ثبت‌نام:
${registration.number}

💵 ورودی:
${custom.entry}

📊 ظرفیت:
${count + 1} / ${custom.capacity}

🔖 کد ثبت‌نام:
${registration.id}

⏰ زمان:
${new Date().toLocaleString("fa-IR", {
    timeZone: "Asia/Tehran"
  })}
`;

  await sendTelegram(message);

  res.json({
    success: true,
    message: "ثبت‌نام کاستوم با موفقیت انجام شد.",
    registration
  });
});

// ===============================
// خطای عمومی
// ===============================

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "مسیر پیدا نشد."
  });
});

// ===============================
// اجرای سرور
// ===============================

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
