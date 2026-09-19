const express = require("express");

const app = express();

const PORT =
  process.env.PORT || 3000;

app.use(express.json());


/* =========================
   CORS
========================= */

app.use((req,res,next)=>{

  res.header(
    "Access-Control-Allow-Origin",
    "*"
  );

  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept"
  );

  res.header(
    "Access-Control-Allow-Methods",
    "GET, POST, OPTIONS"
  );

  if(req.method === "OPTIONS"){
    return res.sendStatus(204);
  }

  next();

});


/* =========================
   TELEGRAM
========================= */

const TELEGRAM_BOT_TOKEN =
  process.env.TELEGRAM_BOT_TOKEN;

const TELEGRAM_CHAT_ID =
  process.env.TELEGRAM_CHAT_ID;


/* =========================
   DRAW DATA
========================= */

const draws = [

  {
    id: "draw-70000",

    title:
      "قرعه‌کشی ۷۰ هزار تومانی",

    prize:
      "۷۰٬۰۰۰ تومان",

    capacity: 10,

    players: 0,

    map: "Shipment",

    startTime:
      "پس از تکمیل ظرفیت",

    description:
      "قرعه‌کشی آزمایشی با ورود رایگان"
  },

  {
    id: "draw-150000",

    title:
      "قرعه‌کشی ۱۵۰ هزار تومانی",

    prize:
      "۱۵۰٬۰۰۰ تومان",

    capacity: 10,

    players: 0,

    map: "Nuketown",

    startTime:
      "پس از تکمیل ظرفیت",

    description:
      "قرعه‌کشی آزمایشی با ورود رایگان"
  },

  {
    id: "draw-300000",

    title:
      "قرعه‌کشی ۳۰۰ هزار تومانی",

    prize:
      "۳۰۰٬۰۰۰ تومان",

    capacity: 10,

    players: 0,

    map: "Firing Range",

    startTime:
      "پس از تکمیل ظرفیت",

    description:
      "قرعه‌کشی آزمایشی با ورود رایگان"
  }

];


/* ثبت‌نام‌ها */

const registrations = [];


/* =========================
   HOME
========================= */

app.get("/",(req,res)=>{

  res.json({

    status:"online",

    message:
      "CP HUB server is running"

  });

});


/* =========================
   HEALTH
========================= */

app.get("/health",(req,res)=>{

  res.json({
    status:"ok"
  });

});


/* =========================
   GET DRAWS
========================= */

app.get("/api/draws",(req,res)=>{

  res.json({

    success:true,

    draws:draws.map(draw=>({

      ...draw,

      players:
        registrations.filter(
          x =>
            x.drawId === draw.id
        ).length

    }))

  });

});


/* =========================
   TELEGRAM
========================= */

async function sendTelegram(
  registration
){

  if(
    !TELEGRAM_BOT_TOKEN ||
    !TELEGRAM_CHAT_ID
  ){

    console.log(
      "Telegram variables missing"
    );

    return;

  }


  const message =

`🎯 ثبت‌نام جدید قرعه‌کشی

🏆 قرعه‌کشی:
${registration.drawTitle}

🎁 جایزه:
${registration.prize}

🎮 Player ID:
${registration.playerID}

👥 ظرفیت:
${registration.playerNumber}/10

🎟️ ورودی:
رایگان

🧾 شماره ثبت‌نام:
${registration.id}

⏰ زمان:
${registration.createdAt}`;


  try{

    const response =
      await fetch(
        `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
        {

          method:"POST",

          headers:{
            "Content-Type":
              "application/json"
          },

          body:JSON.stringify({

            chat_id:
              TELEGRAM_CHAT_ID,

            text:
              message

          })

        }
      );


    const data =
      await response.json();


    if(!data.ok){

      console.log(
        "Telegram error:",
        data.description
      );

    }

  }catch(error){

    console.log(
      "Telegram request error:",
      error
    );

  }

}


/* =========================
   JOIN DRAW
========================= */

app.post(
  "/api/draws/:id/join",
  async(req,res)=>{

    try{

      const drawId =
        req.params.id;

      const playerID =
        String(
          req.body.playerID || ""
        ).trim();


      if(!playerID){

        return res.status(400).json({

          success:false,

          message:
            "Player ID الزامی است."

        });

      }


      const draw =
        draws.find(
          x =>
            x.id === drawId
        );


      if(!draw){

        return res.status(404).json({

          success:false,

          message:
            "قرعه‌کشی پیدا نشد."

        });

      }


      const currentPlayers =
        registrations.filter(
          x =>
            x.drawId === drawId
        );


      if(
        currentPlayers.length >=
        draw.capacity
      ){

        return res.status(400).json({

          success:false,

          message:
            "ظرفیت این قرعه‌کشی تکمیل شده."

        });

      }


      const alreadyJoined =
        currentPlayers.some(
          x =>
            x.playerID === playerID
        );


      if(alreadyJoined){

        return res.status(400).json({

          success:false,

          message:
            "این Player ID قبلاً ثبت‌نام کرده است."

        });

      }


      const registration = {

        id:
          "REG-" +
          Date.now(),

        drawId:
          draw.id,

        drawTitle:
          draw.title,

        prize:
          draw.prize,

        playerID:
          playerID,

        playerNumber:
          currentPlayers.length + 1,

        createdAt:
          new Date().toLocaleString(
            "fa-IR"
          )

      };


      registrations.push(
        registration
      );


      console.log(
        "NEW REGISTRATION:",
        registration
      );


      await sendTelegram(
        registration
      );


      return res.json({

        success:true,

        message:
          "ثبت‌نام با موفقیت انجام شد.",

        registration:
          registration

      });


    }catch(error){

      console.error(error);

      return res.status(500).json({

        success:false,

        message:
          "خطای سرور"

      });

    }

  }
);


/* =========================
   START
========================= */

app.listen(
  PORT,
  ()=>{
    console.log(
      `Server running on port ${PORT}`
    );
  }
);
