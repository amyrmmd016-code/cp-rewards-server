const express = require("express");

const app = express();
const PORT = process.env.PORT || 10000;

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }

  next();
});

app.use(express.json());


// ==============================
// مسابقات
// ==============================

const customs = [
  {
    id: "paid-custom",
    type: "paid",
    title: "کاستوم جایزه‌دار پولی",
    prize: "۵۰۰٬۰۰۰ تومان",
    capacity: 100,
    map: "Nuketown",
    day: "پنجشنبه",
    entry: "فعلاً رایگان"
  },
  {
    id: "free-custom",
    type: "free",
    title: "کاستوم جایزه‌دار رایگان",
    prize: "۲۰۰٬۰۰۰ تومان",
    capacity: 100,
    map: "Shipment",
    day: "پنجشنبه",
    entry: "رایگان"
  }
];

const registrations = [];


// ==============================
// وضعیت
// ==============================

app.get("/", (req, res) => {
  res.json({
    status: "online",
    message: "CP HUB SERVER"
  });
});

app.get("/health", (req, res) => {
  res.json({
    status: "ok"
  });
});


// ==============================
// لیست کاستوم‌ها
// ==============================

app.get("/api/customs", (req, res) => {

  const result = customs.map(custom => {

    const players = registrations.filter(
      x => x.customId === custom.id
    );

    return {
      ...custom,
      registered: players.length,
      remaining: custom.capacity - players.length
    };

  });

  res.json(result);
});


// ==============================
// بازیکنان کاستوم
// ==============================

app.get("/api/customs/:id/players", (req, res) => {

  const custom = customs.find(
    x => x.id === req.params.id
  );

  if (!custom) {
    return res.status(404).json({
      success: false,
      message: "کاستوم پیدا نشد."
    });
  }

  const players = registrations
    .filter(x => x.customId === custom.id)
    .sort((a, b) => a.number - b.number);

  const slots = [];

  for (let i = 1; i <= 100; i++) {

    const player = players.find(
      x => x.number === i
    );

    slots.push({
      number: i,
      playerId: player ? player.playerId : null,
      avatar: player ? player.avatar : null
    });
  }

  res.json({
    success: true,
    players: slots
  });
});


// ==============================
// ثبت نام
// ==============================

app.post("/api/customs/:id/join", async (req, res) => {

  try {

    const custom = customs.find(
      x => x.id === req.params.id
    );

    if (!custom) {
      return res.status(404).json({
        success: false,
        message: "کاستوم پیدا نشد."
      });
    }

    const playerId = String(
      req.body.playerId || ""
    ).trim();

    const avatar = String(
      req.body.avatar || "🎮"
    );

    if (!playerId) {
      return res.status(400).json({
        success: false,
        message: "Player ID وارد نشده."
      });
    }

    const alreadyRegistered = registrations.some(
      x =>
        x.customId === custom.id &&
        x.playerId === playerId
    );

    if (alreadyRegistered) {
      return res.status(400).json({
        success: false,
        message: "این Player ID قبلاً ثبت شده."
      });
    }

    const currentPlayers = registrations.filter(
      x => x.customId === custom.id
    );

    if (currentPlayers.length >= custom.capacity) {
      return res.status(400).json({
        success: false,
        message: "ظرفیت تکمیل شده."
      });
    }

    const registration = {

      id: "REG-" + Date.now(),

      customId: custom.id,

      playerId: playerId,

      avatar: avatar,

      number: currentPlayers.length + 1,

      time: new Date().toISOString()
    };

    registrations.push(registration);


    // ==============================
    // تلگرام
    // ==============================

    if (
      TELEGRAM_BOT_TOKEN &&
      TELEGRAM_CHAT_ID
    ) {

      const message = `
🎮 ثبت نام جدید CP HUB

🏆 مسابقه:
${custom.title}

💰 جایزه:
${custom.prize}

🗺 مپ:
${custom.map}

👤 شماره:
${registration.number}/100

🆔 Player ID:
${playerId}

🎭 پروفایل:
${avatar}

💵 ورودی:
${custom.entry}

⏰ زمان:
${new Date().toLocaleString(
  "fa-IR",
  {
    timeZone: "Asia/Tehran"
  }
)}
`;

      try {

        await fetch(
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

      } catch (telegramError) {

        console.log(
          "Telegram error:",
          telegramError.message
        );

      }
    }


    res.json({

      success: true,

      message: "ثبت نام موفق بود.",

      registration: registration

    });

  } catch (error) {

    console.log(error);

    res.status(500).json({
      success: false,
      message: "خطای سرور."
    });

  }

});


// ==============================
// 404
// ==============================

app.use((req, res) => {

  res.status(404).json({
    success: false,
    message: "مسیر پیدا نشد."
  });

});


app.listen(PORT, () => {

  console.log(
    `CP HUB SERVER running on ${PORT}`
  );

});
