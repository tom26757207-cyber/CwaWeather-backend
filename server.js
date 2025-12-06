// server.js (36小時預報搞笑版)
require("dotenv").config();
const express = require("express");
const cors = require("cors");
const axios = require("axios");

const app = express();
const PORT = process.env.PORT || 3000;

const CWA_API_BASE_URL = "https://opendata.cwa.gov.tw/api";
const CWA_API_KEY = process.env.CWA_API_KEY; // 請務必在 Zeabur 設定此環境變數

app.use(cors( ));
app.use(express.json());

// 地區名稱的對應
const locationMap = {
  "taipei": "臺北市",
  "new-taipei": "新北市",
  "tainan": "臺南市",
};

const getWeatherForecast = async (req, res) => {
  try {
    if (!CWA_API_KEY) {
      return res.status(500).json({ success: false, error: "吼～！伺服器的主人忘記放 API 鑰匙了啦！" });
    }

    const locationKey = req.params.location;
    const locationName = locationMap[locationKey];

    if (!locationName) {
      return res.status(400).json({ success: false, error: "這是哪？我沒聽過這個地方！" });
    }

    // 使用「一般天氣預報-今明36小時天氣預報」
    const response = await axios.get(
      `${CWA_API_BASE_URL}/v1/rest/datastore/F-C0032-001`,
      {
        params: {
          Authorization: CWA_API_KEY,
          locationName: locationName,
        },
      }
    );

    // --- 核心翻譯邏輯開始 ---
    const locationData = response.data.records.location[0];
    if (!locationData) {
      return res.status(404).json({ success: false, error: `找不到 ${locationName} 的資料` });
    }

    const weatherElements = locationData.weatherElement;
    const forecasts = [];
    const timePeriods = weatherElements[0].time.length; // 通常是 3 個時間段

    for (let i = 0; i < timePeriods; i++) {
      const forecast = {
        startTime: weatherElements[0].time[i].startTime,
        endTime: weatherElements[0].time[i].endTime,
      };

      weatherElements.forEach((element) => {
        const param = element.time[i].parameter;
        switch (element.elementName) {
          case "Wx":
            forecast.weather = param.parameterName;
            break;
          case "PoP":
            forecast.rain = param.parameterName; // 單位是 %
            break;
          case "MinT":
            forecast.minTemp = param.parameterName; // 單位是 C
            break;
          case "MaxT":
            forecast.maxTemp = param.parameterName; // 單位是 C
            break;
          case "CI":
            forecast.comfort = param.parameterName;
            break;
        }
      });
      forecasts.push(forecast);
    }
    // --- 核心翻譯邏輯結束 ---

    res.json({
      success: true,
      data: {
        city: locationData.locationName,
        forecasts: forecasts,
      },
    });

  } catch (error) {
    console.error("取得天氣資料失敗:", error.message);
    res.status(500).json({ success: false, error: "糟糕！氣象衛星好像被外星人劫走了！" });
  }
};

app.get("/api/weather/:location", getWeatherForecast);

app.listen(PORT, () => {
  console.log(`🚀 搞笑天氣預報伺服器已在 http://localhost:${PORT} 待命！` );
});
