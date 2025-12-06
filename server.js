// server.js (修改後的後端程式碼)
require("dotenv").config();
const express = require("express");
const cors = require("cors");
const axios = require("axios");

const app = express();
const PORT = process.env.PORT || 3000;

// CWA API 設定
const CWA_API_BASE_URL = "https://opendata.cwa.gov.tw/api";
const CWA_API_KEY = process.env.CWA_API_KEY;

// Middleware
app.use(cors( ));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 地區名稱到 CWA API 代碼的映射
const locationMap = {
  "taipei": "臺北市",
  "new-taipei": "新北市",
  "tainan": "臺南市",
};

/**
 * 取得指定地區的未來一週天氣預報
 * CWA 氣象資料開放平臺 API
 * 使用「鄉鎮天氣預報-未來2天(逐3小時)及未來1週(逐12小時)」
 */
const getWeatherForecast = async (req, res) => {
  try {
    if (!CWA_API_KEY) {
      return res.status(500).json({ error: "伺服器設定錯誤", message: "未設定 CWA_API_KEY" });
    }

    const locationKey = req.params.location;
    const locationName = locationMap[locationKey];

    if (!locationName) {
      return res.status(400).json({ error: "無效的地區", message: "請提供 taipei, new-taipei, 或 tainan" });
    }

    // 呼叫 CWA API - 未來一週天氣預報
    // API 文件: https://opendata.cwa.gov.tw/dist/opendata-swagger.html
    const response = await axios.get(
      `${CWA_API_BASE_URL}/v1/rest/datastore/F-D0047-091`,
      {
        params: {
          Authorization: CWA_API_KEY,
          locationName: locationName,
          elementName: "Wx,PoP12h,T", // 天氣現象, 12小時降雨機率, 溫度
        },
      }
     );

    const locationData = response.data.records.locations[0].location[0];

    if (!locationData) {
      return res.status(404).json({ error: "查無資料", message: `無法取得 ${locationName} 天氣資料` });
    }

    // 整理天氣資料
    const weatherData = {
      city: locationData.locationName,
      forecasts: [],
    };

    const weatherElement = locationData.weatherElement;
    const tempElement = weatherElement.find(e => e.elementName === "T");
    const wxElement = weatherElement.find(e => e.elementName === "Wx");
    const popElement = weatherElement.find(e => e.elementName === "PoP12h");

    // CWA API 提供未來一週的資料，每 12 小時一筆。我們取 6 筆，即為 3 天。
    for (let i = 0; i < 6; i++) {
      // 只處理白天 (06:00) 和晚上 (18:00) 的資料
      const startTime = tempElement.time[i * 2].startTime;
      const endTime = tempElement.time[i * 2 + 1].endTime;
      
      // 由於溫度是每 3 小時，天氣現象是 12 小時，我們要對應好時間
      // 這裡我們簡化處理，取 12 小時內的平均、最高、最低
      const tempsInPeriod = tempElement.time.slice(i*4, (i+1)*4).map(t => parseInt(t.elementValue[0].value));
      
      const forecast = {
        startTime: startTime,
        endTime: endTime,
        weather: wxElement.time[i].elementValue[0].value,
        rain: popElement.time[i].elementValue[0].value,
        minTemp: Math.min(...tempsInPeriod),
        maxTemp: Math.max(...tempsInPeriod),
      };
      weatherData.forecasts.push(forecast);
    }

    res.json({
      success: true,
      data: weatherData,
    });

  } catch (error) {
    console.error("取得天氣資料失敗:", error.message);
    if (error.response) {
      return res.status(error.response.status).json({
        error: "CWA API 錯誤",
        message: error.response.data.message || "無法取得天氣資料",
      });
    }
    res.status(500).json({ error: "伺服器錯誤", message: "無法取得天氣資料" });
  }
};

// Routes
app.get("/", (req, res) => {
  res.json({ message: "歡迎使用天龍人天氣檢測器 API" });
});

app.get("/api/health", (req, res) => {
  res.json({ status: "OK", timestamp: new Date().toISOString() });
});

// 動態取得指定地區天氣預報
app.get("/api/weather/:location", getWeatherForecast);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: "找不到此路徑" });
});

app.listen(PORT, () => {
  console.log(`🚀 伺服器已啟動於 http://localhost:${PORT}` );
});
