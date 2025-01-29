require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 5000;

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

const Food = mongoose.model("Food", FoodSchema, "foods");

// Middlewares
app.use(cors());
app.use(express.json());

// Find foods by product name
app.get("/foods", async (req, res) => {
  try {
    const { name } = req.query;
    if (!name) {
      return res.status(400).json({ error: "Debes proporcionar un nombre de producto" });
    }

    const foods = await Food.find({ 
      product_name: { $regex: name, $options: "i" } 
    }); 

    if (foods.length === 0) {
      return res.status(404).json({ message: "No se encontraron alimentos con ese nombre" });
    }

    res.json(foods);
  } catch (error) {
    console.error("❌ Error al buscar alimentos:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo en el puerto ${PORT}`);
});
