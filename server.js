const express = require("express");

const app = express();

const PORT = process.env.PORT || 10000;

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

// =====================================
// تنظیمات
// =====================================

// فعلاً برای تست روشن است.
// وقتی برنامه آماده شد false کن تا کاستوم فقط پنجشنبه فعال باشد.
const TEST_MODE = true;


// =====================================
// CORS
// =====================================

app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header(
    "Access-Control-Allow-Methods",
    "GET,POST,OPTIONS"
  );
  res.header(
    "Access-Control-Allow-Headers",
    "Content-Type"
  );

  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }

  next();
});

app.use(express.json());


// =====================================
// قرعه‌کشی‌ها
// =====================================

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


// =====================================
// کاستوم‌ها
// =====================================

const customs = [
  {
    id: "paid-custom-1",
    type: "paid",
    title: "کاستوم جایزه‌دار پولی",
    prize: "۵۰۰٬۰۰۰ تومان",
    capacity: 100,
    day: "پنجشنبه",
    map: "Nuketown",
    entry: "فعلاً رایگان",
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


// =====================================
// ثبت‌نام‌ها
// =====================================

const drawRegistrations = [];
const customRegistrations = [];


// =====================================
// وضعیت گردونه‌ها
// =====================================

const dailyWheelSpins = new Map();
const specialWheelSpins = new Map();


// =====================================
// گردونه روزانه
// =====================================

const dailyWheel = [
  { id: 1, reward: 0, label: "پوچ", weight: 20 },
  { id: 2, reward: 0, label: "پوچ", weight: 20 },
  { id: 3, reward: 0, label: "پوچ", weight: 20 },
  { id: 4, reward: 0, label: "پوچ", weight: 20 },
  { id: 5, reward: 0, label: "پوچ", weight: 20 },

  { id: 6, reward: 10, label: "۱۰ سکه", weight: 15 },
  { id: 7, reward: 15, label: "۱۵ سکه", weight: 12 },
  { id: 8, reward: 20, label: "۲۰ سکه", weight: 10 },
  { id: 9, reward: 30, label: "۳۰ سکه", weight: 7 },

  // احتمال کمتر
  { id: 10, reward: 50, label: "۵۰ سکه", weight: 3 }
];


// =====================================
// گردونه‌های ویژه
// =====================================

const specialWheels = [
  {
    id: "wheel-80",
    title: "گردونه ۸۰ سکه‌ای",
    maxReward: 80,
    items: [
      { reward: 0, label: "پوچ", weight: 20 },
      { reward: 0, label: "پوچ", weight: 20 },
      { reward: 0, label: "پوچ", weight: 20 },
      { reward: 0, label: "پوچ", weight: 20 },
      { reward: 0, label: "پوچ", weight: 20 },
      { reward: 10, label: "۱۰ سکه", weight: 15 },
      { reward: 20, label: "۲۰ سکه", weight: 12 },
      { reward: 40, label: "۴۰ سکه", weight: 9 },
      { reward: 60, label: "۶۰ سکه", weight: 5 },
      { reward: 80, label: "۸۰ سکه", weight: 2 }
    ]
  },

  {
    id: "wheel-100",
    title: "گردونه ۱۰۰ سکه‌ای",
    maxReward: 100,
    items: [
      { reward: 0, label: "پوچ", weight: 20 },
      { reward: 0, label: "پوچ", weight: 20 },
      { reward: 0, label: "پوچ", weight: 20 },
      { reward: 0, label: "پوچ", weight: 20 },
      { reward: 0, label: "پوچ", weight: 20 },
      { reward: 10, label: "۱۰ سکه", weight: 15 },
      { reward: 25, label: "۲۵ سکه", weight: 12 },
      { reward: 50, label: "۵۰ سکه", weight: 9 },
      { reward: 75, label: "۷۵ سکه", weight: 5 },
      { reward: 100, label: "۱۰۰ سکه", weight: 2 }
    ]
  },

  {
    id: "wheel-150",
    title: "گردونه ۱۵۰ سکه‌ای",
    maxReward: 150,
    items: [
      { reward: 0, label: "پوچ", weight: 20 },
      { reward: 0, label: "پوچ", weight: 20 },
      { reward: 0, label: "پوچ", weight: 20 },
      { reward: 0, label: "پوچ", weight: 20 },
      { reward: 0, label: "پوچ", weight: 20 },
      { reward: 10, label: "۱۰ سکه", weight: 15 },
      { reward: 30, label: "۳۰ سکه", weight: 12 },
      { reward: 70, label: "۷۰ سکه", weight: 9 },
      { reward: 100, label: "۱۰۰ سکه", weight: 5 },
      { reward: 150, label: "۱۵۰ سکه", weight: 2 }
    ]
  },

  {
    id: "wheel-200",
    title: "گردونه ۲۰۰ سکه‌ای",
    maxReward: 200,
    items: [
      { reward: 0, label: "پوچ", weight: 20 },
      { reward: 0, label: "پوچ", weight: 20 },
      { reward: 0, label: "پوچ", weight: 20 },
      { reward: 0, label: "پوچ", weight: 20 },
      { reward: 0, label: "پوچ", weight: 20 },
      { reward: 10, label: "۱۰ سکه", weight: 15 },
      { reward: 40, label: "۴۰ سکه", weight: 12 },
      { reward: 80, label: "۸۰ سکه", weight: 9 },
      { reward: 120, label: "۱۲۰ سکه", weight: 5 },
      { reward: 200, label: "۲۰۰ سکه", weight: 2 }
    ]
  },

  {
    id: "wheel-250",
    title: "گردونه ۲۵۰ سکه‌ای",
    maxReward: 250,
    items: [
      { reward: 0, label: "پوچ", weight: 20 },
      { reward: 0, label: "پوچ", weight: 20 },
      { reward: 0, label: "پوچ", weight: 20 },
      { reward: 0, label: "پوچ", weight: 20 },
      { reward: 0, label: "پوچ", weight: 20 },
      { reward: 10, label: "۱۰ سکه", weight: 15 },
      { reward: 50, label: "۵۰ سکه", weight: 12 },
      { reward: 100, label: "۱۰۰ سکه", weight: 9 },
      { reward: 150, label: "۱۵۰ سکه", weight: 5 },
      { reward: 250, label: "۲۵۰ سکه", weight: 2 }
    ]
  },

  {
    id: "wheel-500",
    title: "گردونه ۵۰۰ سکه‌ای",
    maxReward: 500,
    items: [
      { reward: 0, label: "پوچ", weight: 20 },
      { reward: 0, label: "پوچ", weight: 20 },
      { reward: 0, label: "پوچ", weight: 20 },
      { reward: 0, label: "پوچ", weight: 20 },
      { reward: 0, label: "پوچ", weight: 20 },
      { reward: 10, label: "۱۰ سکه", weight: 15 },
      { reward: 50, label: "۵۰ سکه", weight: 12 },
      { reward: 100, label: "۱۰۰ سکه", weight: 9 },
      { reward: 250, label: "۲۵۰ سکه", weight: 5 },
      { reward: 500, label: "۵۰۰ سکه", weight: 1 }
    ]
  }
];


// =====================================
// تاریخ روز
// =====================================

function todayKey() {
  const now = new Date();

  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tehran",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(now);
}


// =====================================
// پنجشنبه
// =====================================

function isThursdayInTehran() {
  const day = new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    timeZone: "Asia/Tehran"
  }).format(new Date());

  return day === "Thursday";
}


// =====================================
// انتخاب جایزه
// =====================================

function chooseWeighted(items) {
  const total = items.reduce(
    (sum, item) => sum + item.weight,
    0
  );

  let random = Math.random() * total;

  for (const item of items) {
    random -= item.weight;

    if (random <= 0) {
      return item;
    }
  }

  return items[items.length - 1];
}


// =====================================
// تلگرام
// =====================================

async function sendTelegram(message) {

  if (
    !TELEGRAM_BOT_TOKEN ||
    !TELEGRAM_CHAT_ID
  ) {
    console.log(
      "Telegram variables are missing."
    );

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
      console.log(
        "Telegram error:",
        data
      );
    }

  } catch (error) {

    console.log(
      "Telegram error:",
      error.message
    );
  }
}


// =====================================
// HOME
// =====================================

app.get("/", (req, res) => {

  res.json({
    status: "online",
    message: "CP Hub server is running"
  });

});


// =====================================
// HEALTH
// =====================================

app.get("/health", (req, res) => {

  res.json({
    status: "ok"
  });

});


// =====================================
// DRAWS
// =====================================

app.get("/api/draws", (req, res) => {

  const result = draws.map(draw => {

    const count =
      drawRegistrations.filter(
        r => r.drawId === draw.id
      ).length;

    return {
      ...draw,
      registered: count,
      remaining:
        Math.max(
          draw.capacity - count,
          0
        )
    };

  });

  res.json(result);

});


// =====================================
// JOIN DRAW
// =====================================

app.post(
  "/api/draws/:id/join",
  async (req, res) => {

    try {

      const drawId = req.params.id;

      const playerId =
        String(
          req.body.playerId || ""
        ).trim();

      if (!playerId) {

        return res.status(400).json({
          success: false,
          message: "Player ID را وارد کنید."
        });

      }

      const draw =
        draws.find(
          d => d.id === drawId
        );

      if (!draw) {

        return res.status(404).json({
          success: false,
          message: "مسابقه پیدا نشد."
        });

      }

      const duplicate =
        drawRegistrations.some(
          r =>
            r.drawId === drawId &&
            r.playerId === playerId
        );

      if (duplicate) {

        return res.status(400).json({
          success: false,
          message:
            "این Player ID قبلاً ثبت‌نام کرده است."
        });

      }

      const count =
        drawRegistrations.filter(
          r => r.drawId === drawId
        ).length;

      if (count >= draw.capacity) {

        return res.status(400).json({
          success: false,
          message:
            "ظرفیت مسابقه تکمیل شده است."
        });

      }

      const registration = {
        id:
          "REG-" +
          Date.now(),

        drawId,

        playerId,

        number:
          count + 1,

        createdAt:
          new Date().toISOString()
      };

      drawRegistrations.push(
        registration
      );

      await sendTelegram(`
🎁 ثبت‌نام جدید CP Hub

🏆 مسابقه:
${draw.title}

💰 جایزه:
${draw.prize}

🆔 Player ID:
${playerId}

👤 شماره:
${registration.number}/${draw.capacity}

💵 ورودی:
رایگان

🔖 کد:
${registration.id}

⏰ زمان:
${new Date().toLocaleString(
        "fa-IR",
        {
          timeZone:
            "Asia/Tehran"
        }
      )}
`);

      res.json({
        success: true,
        message:
          "ثبت‌نام با موفقیت انجام شد.",
        registration
      });

    } catch (error) {

      console.log(error);

      res.status(500).json({
        success: false,
        message:
          "خطای داخلی سرور."
      });

    }

  }
);


// =====================================
// CUSTOMS
// =====================================

app.get("/api/customs", (req, res) => {

  const result =
    customs.map(custom => {

      const count =
        customRegistrations.filter(
          r =>
            r.customId === custom.id
        ).length;

      return {
        ...custom,

        registered: count,

        remaining:
          Math.max(
            custom.capacity - count,
            0
          ),

        testMode:
          TEST_MODE
      };

    });

  res.json(result);

});


// =====================================
// CUSTOM SLOTS
// =====================================

app.get(
  "/api/customs/:id/slots",
  (req, res) => {

    const custom =
      customs.find(
        c => c.id === req.params.id
      );

    if (!custom) {

      return res.status(404).json({
        success: false,
        message:
          "کاستوم پیدا نشد."
      });

    }

    const players =
      customRegistrations
        .filter(
          r =>
            r.customId === custom.id
        )
        .sort(
          (a, b) =>
            a.number - b.number
        );

    const slots =
      Array.from(
        { length: 100 },
        (_, index) => {

          const number =
            index + 1;

          const player =
            players.find(
              p =>
                p.number === number
            );

          return {
            slot: number,

            playerId:
              player
                ? player.playerId
                : null,

            avatar:
              player
                ? player.avatar
                : null
          };

        }
      );

    res.json({
      success: true,
      slots
    });

  }
);


// =====================================
// JOIN CUSTOM
// =====================================

app.post(
  "/api/customs/:id/join",
  async (req, res) => {

    try {

      const customId =
        req.params.id;

      const playerId =
        String(
          req.body.playerId || ""
        ).trim();

      const avatar =
        String(
          req.body.avatar || "🎮"
        );

      if (!playerId) {

        return res.status(400).json({
          success: false,
          message:
            "Player ID را وارد کنید."
        });

      }

      const custom =
        customs.find(
          c =>
            c.id === customId
        );

      if (!custom) {

        return res.status(404).json({
          success: false,
          message:
            "کاستوم پیدا نشد."
        });

      }

      if (
        !TEST_MODE &&
        !isThursdayInTehran()
      ) {

        return res.status(400).json({
          success: false,
          message:
            "این کاستوم فقط پنجشنبه‌ها فعال است."
        });

      }

      const duplicate =
        customRegistrations.some(
          r =>
            r.customId === customId &&
            r.playerId === playerId
        );

      if (duplicate) {

        return res.status(400).json({
          success: false,
          message:
            "این Player ID قبلاً در این کاستوم ثبت شده است."
        });

      }

      const count =
        customRegistrations.filter(
          r =>
            r.customId === customId
        ).length;

      if (
        count >= custom.capacity
      ) {

        return res.status(400).json({
          success: false,
          message:
            "ظرفیت کاستوم تکمیل شده است."
        });

      }

      const registration = {

        id:
          "CUS-" +
          Date.now(),

        customId,

        playerId,

        avatar,

        number:
          count + 1,

        createdAt:
          new Date().toISOString()
      };

      customRegistrations.push(
        registration
      );

      await sendTelegram(`
🎮 ثبت‌نام جدید CP Hub

🏆 مسابقه:
${custom.title}

💰 جایزه:
${custom.prize}

🗺 مپ:
${custom.map}

📅 روز:
پنجشنبه

🆔 Player ID:
${playerId}

🎭 پروفایل:
${avatar}

👤 جایگاه:
${registration.number}/${custom.capacity}

💵 ورودی:
${custom.entry}

🔖 کد:
${registration.id}

⏰ زمان:
${new Date().toLocaleString(
        "fa-IR",
        {
          timeZone:
            "Asia/Tehran"
        }
      )}
`);

      res.json({
        success: true,

        message:
          "ثبت‌نام با موفقیت انجام شد.",

        registration
      });

    } catch (error) {

      console.log(error);

      res.status(500).json({
        success: false,
        message:
          "خطای داخلی سرور."
      });

    }

  }
);


// =====================================
// DAILY WHEEL INFO
// =====================================

app.get(
  "/api/wheels/daily",
  (req, res) => {

    res.json({
      success: true,

      title:
        "گردونه روزانه",

      items:
        dailyWheel.map(
          item => ({
            label:
              item.label,

            reward:
              item.reward
          })
        )
    });

  }
);


// =====================================
// DAILY WHEEL SPIN
// =====================================

app.post(
  "/api/wheels/daily/spin",
  async (req, res) => {

    try {

      const playerId =
        String(
          req.body.playerId || ""
        ).trim();

      if (!playerId) {

        return res.status(400).json({
          success: false,
          message:
            "Player ID لازم است."
        });

      }

      const key =
        playerId +
        "_" +
        todayKey();

      if (
        dailyWheelSpins.has(key)
      ) {

        return res.status(400).json({
          success: false,
          message:
            "امروز قبلاً گردونه را چرخانده‌ای."
        });

      }

      const result =
        chooseWeighted(
          dailyWheel
        );

      dailyWheelSpins.set(
        key,
        true
      );

      res.json({
        success: true,

        reward:
          result.reward,

        label:
          result.label
      });

    } catch (error) {

      res.status(500).json({
        success: false,
        message:
          "خطای گردونه."
      });

    }

  }
);


// =====================================
// SPECIAL WHEELS
// =====================================

app.get(
  "/api/wheels/special",
  (req, res) => {

    res.json(
      specialWheels.map(
        wheel => ({
          id:
            wheel.id,

          title:
            wheel.title,

          maxReward:
            wheel.maxReward,

          items:
            wheel.items.map(
              item => ({
                label:
                  item.label,

                reward:
                  item.reward
              })
            )
        })
      )
    );

  }
);


// =====================================
// SPECIAL WHEEL SPIN
// =====================================

app.post(
  "/api/wheels/special/:id/spin",
  async (req, res) => {

    try {

      const playerId =
        String(
          req.body.playerId || ""
        ).trim();

      if (!playerId) {

        return res.status(400).json({
          success: false,
          message:
            "Player ID لازم است."
        });

      }

      const wheel =
        specialWheels.find(
          w =>
            w.id === req.params.id
        );

      if (!wheel) {

        return res.status(404).json({
          success: false,
          message:
            "گردونه پیدا نشد."
        });

      }

      const key =
        playerId +
        "_" +
        wheel.id +
        "_" +
        todayKey();

      if (
        specialWheelSpins.has(key)
      ) {

        return res.status(400).json({
          success: false,
          message:
            "امروز قبلاً این گردونه را چرخانده‌ای."
        });

      }

      const result =
        chooseWeighted(
          wheel.items
        );

      specialWheelSpins.set(
        key,
        true
      );

      res.json({
        success: true,

        reward:
          result.reward,

        label:
          result.label
      });

    } catch (error) {

      res.status(500).json({
        success: false,
        message:
          "خطای گردونه."
      });

    }

  }
);


// =====================================
// 404
// =====================================

app.use(
  (req, res) => {

    res.status(404).json({
      success: false,
      message:
        "مسیر پیدا نشد."
    });

  }
);


// =====================================
// START
// =====================================

app.listen(
  PORT,
  () => {

    console.log(
      `CP Hub server running on port ${PORT}`
    );

  }
);
