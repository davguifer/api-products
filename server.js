require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const compression = require("compression");
const NodeCache = require("node-cache");
const cluster = require("cluster");
const os = require("os");

// Inicializar caché en memoria con TTL
const cache = new NodeCache({ stdTTL: 3600, checkperiod: 120 });

// Número de núcleos del procesador
const numCPUs = os.cpus().length;

if (cluster.isMaster) {
  console.log(`🔧 Servidor principal ejecutándose en PID: ${process.pid}`);
  for (let i = 0; i < numCPUs; i++) {
    cluster.fork();
  }

  cluster.on("exit", (worker) => {
    console.warn(`⚠️ Hilo ${worker.process.pid} terminado. Reiniciando...`);
    cluster.fork();
  });
} else {
  const app = express();
  const PORT = process.env.PORT || 5000;
  const HOST = process.env.HOST || "localhost";

  if (!process.env.MONGO_URI) {
    console.error("❌ ERROR: La variable de entorno MONGO_URI no está definida.");
    process.exit(1);
  }

  mongoose.connect(process.env.MONGO_URI, {
    maxPoolSize: 50,
  })
    .then(() => console.log("✅ Conectado a MongoDB"))
    .catch(err => {
      console.error("❌ Error al conectar a MongoDB:", err);
      process.exit(1);
    });

  const FoodSchema = new mongoose.Schema({
    _id: String,
    allergens_tags: [String],
    product_name: String,
    nutriments: {
      energy_100g: Number,
      fat_100g: Number,
      carbohydrates_100g: Number,
      proteins_100g: Number,
      sugars_100g: Number,
    },
  });

  FoodSchema.index({ product_name: 1 });

  const Food = mongoose.model("Food", FoodSchema, "foods");

  app.use(cors());
  app.use(express.json());
  app.use(compression({ level: 9 }));

  app.get("/foods", async (req, res) => {
    const requestId = `${process.pid}-${Date.now()}`;
    try {
      console.time(`⏱️ Tiempo total del endpoint-${requestId}`);

      const { name, page = 1, limit = 10 } = req.query;

      if (!name || !name.trim()) {
        console.warn("⚠️ Falta el parámetro 'name'");
        return res.status(400).json({ error: "Debes proporcionar un nombre de producto válido." });
      }

      const cacheKey = `foods:${name.toLowerCase().trim()}:${page}:${limit}`;

      console.time(`⏱️ Tiempo de cache en memoria-${requestId}`);
      const cachedData = cache.get(cacheKey);
      console.timeEnd(`⏱️ Tiempo de cache en memoria-${requestId}`);

      if (cachedData) {
        console.log("📦 Datos recuperados desde caché");
        console.timeEnd(`⏱️ Tiempo total del endpoint-${requestId}`);
        return res.json(cachedData);
      }

      const pageNumber = parseInt(page);
      const pageLimit = parseInt(limit);

      console.time(`⏱️ Tiempo de consulta MongoDB-${requestId}`);

      // Consulta utilizando agregación para ordenar los resultados
      const foods = await Food.aggregate([
        {
          $match: {
            product_name: { $regex: name, $options: "i" }
          }
        },
        {
          $addFields: {
            priority: {
              $cond: {
                if: { $regexMatch: { input: "$product_name", regex: `^${name}`, options: "i" } },
                then: 0,  // Prioridad alta si empieza con el término
                else: 1   // Prioridad baja si solo contiene el término
              }
            }
          }
        },
        {
          $sort: { priority: 1, product_name: 1 }  // Ordena primero por prioridad, luego alfabéticamente
        },
        {
          $project: { priority: 0 }  // Excluye el campo de prioridad del resultado final
        },
        {
          $skip: (pageNumber - 1) * pageLimit
        },
        {
          $limit: pageLimit
        }
      ]);

      console.timeEnd(`⏱️ Tiempo de consulta MongoDB-${requestId}`);

      const hasMorePages = foods.length === pageLimit;

      const response = {
        page: pageNumber,
        limit: pageLimit,
        hasMorePages,
        results: foods.map(food => {
          if (food.nutriments && food.nutriments.energy_100g) {
            food.nutriments.energy_100g = (food.nutriments.energy_100g / 4.184).toFixed(2);
          }
          return food;
        }),
      };

      console.time(`⏱️ Tiempo de guardado en cache-${requestId}`);
      cache.set(cacheKey, response);
      console.timeEnd(`⏱️ Tiempo de guardado en cache-${requestId}`);

      console.log("🔄 Respuesta enviada al cliente:", response);
      console.timeEnd(`⏱️ Tiempo total del endpoint-${requestId}`);
      res.json(response);
    } catch (error) {
      console.error("❌ Error al buscar alimentos:", error);
      res.status(500).json({ error: "Error interno del servidor" });
    }
  });

  app.listen(PORT, HOST, () => {
    console.log(`🚀 Servidor worker corriendo en http://${HOST}:${PORT} (PID: ${process.pid})`);
  });
}
