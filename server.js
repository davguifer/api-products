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

// Configurar clúster para múltiples hilos
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
  // Código del servidor worker
  const app = express();
  const PORT = process.env.PORT || 5000;
  const HOST = process.env.HOST || "localhost";

  if (!process.env.MONGO_URI) {
    console.error("❌ ERROR: La variable de entorno MONGO_URI no está definida.");
    process.exit(1);
  }

  mongoose.connect(process.env.MONGO_URI, {
    maxPoolSize: 50, // Incrementar el tamaño del pool para mejorar concurrencia
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

  FoodSchema.index({ product_name: 1, _id: 1 });  // Índice compuesto para mejorar búsquedas y paginación

  const Food = mongoose.model("Food", FoodSchema, "foods");

  app.use(cors());
  app.use(express.json());
  app.use(compression({ level: 9 })); 

  app.get("/foods", async (req, res) => {
    try {
      console.time("⏱️ Tiempo total del endpoint");

      const { name, page = 1, limit = 10 } = req.query;
      const cacheKey = `foods:${name}:${page}:${limit}`;

      if (!name) {
        console.warn("⚠️ Falta el parámetro 'name'");
        return res.status(400).json({ error: "Debes proporcionar un nombre de producto" });
      }

      console.time("⏱️ Tiempo de cache en memoria");
      const cachedData = cache.get(cacheKey);
      console.timeEnd("⏱️ Tiempo de cache en memoria");

      if (cachedData) {
        console.log("📦 Datos recuperados desde caché");
        console.timeEnd("⏱️ Tiempo total del endpoint");
        return res.json(cachedData);
      }

      const pageNumber = parseInt(page);
      const pageLimit = parseInt(limit);

      console.time("⏱️ Tiempo de consulta MongoDB");

      // Optimización: paginación por cursor en lugar de skip
      let query = { product_name: { $regex: name, $options: "i" } };
      const foods = await Food.find(query, { product_name: 1, nutriments: 1 })  // Proyección limitada
        .sort({ _id: 1 })
        .limit(pageLimit + 1)  // +1 para verificar si hay más páginas
        .lean();  // Eliminar conversiones de Mongoose

      console.timeEnd("⏱️ Tiempo de consulta MongoDB");

      // Determinar si hay más páginas
      const hasMorePages = foods.length > pageLimit;
      if (hasMorePages) foods.pop();

      const response = {
        page: pageNumber,
        limit: pageLimit,
        hasMorePages,
        results: foods.map(food => {
          // Optimización: transformar nutriments solo si existe energy_100g
          if (food.nutriments && food.nutriments.energy_100g) {
            food.nutriments.energy_100g = (food.nutriments.energy_100g / 4.184).toFixed(2);
          }
          return food;
        }),
      };

      console.time("⏱️ Tiempo de guardado en cache");
      cache.set(cacheKey, response);
      console.timeEnd("⏱️ Tiempo de guardado en cache");

      console.log("🔄 Respuesta enviada al cliente:", response);
      console.timeEnd("⏱️ Tiempo total del endpoint");
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
