const express = require("express");

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;

// دیتای آزمایشی
const users = {};

app.get("/", (req, res) => {
  res.json({
    status: "online",
    message: "CP Rewards Server is running"
  });
});

// ساخت کاربر
app.post("/api/user", (req, res) => {
  const { userId } = req.body;

  if (!userId) {
    return res.status(400).json({
      error: "userId is required"
    });
  }

  if (!users[userId]) {
    users[userId] = {
      ads: 0,
      tickets: 0
    };
  }

  res.json(users[userId]);
});

// ثبت تبلیغ تکمیل‌شده
app.post("/api/ad-completed", (req, res) => {
  const { userId } = req.body;

  if (!userId) {
    return res.status(400).json({
      error: "userId is required"
    });
  }

  if (!users[userId]) {
    users[userId] = {
      ads: 0,
      tickets: 0
    };
  }

  users[userId].ads++;

  // هر 200 تبلیغ = یک بلیت قرعه‌کشی
  if (users[userId].ads % 200 === 0) {
    users[userId].tickets++;
  }

  res.json({
    success: true,
    ads: users[userId].ads,
    tickets: users[userId].tickets
  });
});

// دریافت وضعیت کاربر
app.get("/api/user/:userId", (req, res) => {
  const user = users[req.params.userId];

  if (!user) {
    return res.json({
      ads: 0,
      tickets: 0
    });
  }

  res.json(user);
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
