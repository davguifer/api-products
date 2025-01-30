require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 5000;
const HOST = process.env.HOST || "localhost";

if (!process.env.MONGO_URI) {
  console.error("❌ ERROR: La variable de entorno MONGO_URI no está definida.");
  process.exit(1);
}

mongoose.connect(process.env.MONGO_URI)
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

FoodSchema.index({ product_name: "text" });

const Food = mongoose.model("Food", FoodSchema, "foods");

// Middlewares
app.use(cors());
app.use(express.json());

app.get("/foods", async (req, res) => {
  try {
    const { name, page = 1, limit = 10 } = req.query;

    console.log("📥 Parámetros recibidos:");
    console.log(`Nombre: ${name}, Página: ${page}, Límite: ${limit}`);

    if (!name) {
      console.warn("⚠️ Falta el parámetro 'name'");
      return res.status(400).json({ error: "Debes proporcionar un nombre de producto" });
    }

    const pageNumber = parseInt(page);
    const pageLimit = parseInt(limit);

    const totalResults = await Food.countDocuments({
      product_name: { $regex: name, $options: "i" },
    });
    console.log(`📊 Total de resultados encontrados: ${totalResults}`);

    const totalPages = Math.ceil(totalResults / pageLimit);
    console.log(`📄 Total de páginas: ${totalPages}`);

    if (pageNumber > totalPages) {
      console.warn(`⚠️ Página solicitada (${pageNumber}) fuera de rango. Total de páginas: ${totalPages}`);
      return res.status(404).json({ message: "No hay más resultados disponibles" });
    }

    const foods = await Food.find(
      { product_name: { $regex: name, $options: "i" } },
      { product_name: 1, nutriments: 1 }
    )
      .skip((pageNumber - 1) * pageLimit)
      .limit(pageLimit)
      .sort({ product_name: 1 });

    console.log("📦 Resultados devueltos:", foods.length);

    const response = {
      page: pageNumber,
      limit: pageLimit,
      totalResults,
      totalPages,
      results: foods,
    };

    console.log("🔄 Respuesta enviada al cliente:", response);

    res.json(response);
  } catch (error) {
    console.error("❌ Error al buscar alimentos:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});

app.listen(PORT, HOST, () => {
  console.log(`🚀 Servidor corriendo en http://${HOST}:${PORT}`);
});
