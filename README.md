# API Products

## Descripción
Este es un servicio de API para la gestión de productos alimenticios, utilizando `Express.js` y `MongoDB` como base de datos. La base de datos de alimentos utilizada es la de **Open Food Facts**, pero solo se han obtenido algunos atributos de los productos de esa base de datos.

## Instalación
Para instalar las dependencias y configurar el entorno, sigue los siguientes pasos:

### Crear un entorno virtual
Es recomendable crear un entorno virtual para aislar las dependencias del proyecto. Ejecuta el siguiente comando:

```sh
python -m venv venv
```

Activa el entorno virtual:
- En Windows:
```sh
venv\Scripts\activate
```
- En macOS y Linux:
```sh
source venv/bin/activate
```

### Instalar dependencias
```sh
npm install express mongoose dotenv cors node-cache compression

```

## Configuración del entorno
Crea un archivo `.env` en la raíz del proyecto y añade las siguientes variables de entorno:

```sh
MONGO_URI=mongodb://localhost:27017/foods_database
PORT=5000
```

También puedes usar el archivo de ejemplo `.env.example` como referencia.

## Uso
Para iniciar el servidor, ejecuta:

```sh
node server.js
```

El servidor se ejecutará en el puerto especificado en el archivo `.env` o en el puerto `5000` por defecto.

## Endpoints
### Obtener alimentos por nombre
**GET** `/foods`

**Parámetros de consulta:**
- `name` (string) - Nombre del producto alimenticio a buscar.

**Ejemplo de petición:**
```sh
curl "http://localhost:5000/foods?name=manzana"
```

**Ejemplo de respuesta:**
```json
[
  {
    "_id": "12345",
    "allergens_tags": ["gluten"],
    "product_name": "Jugo de Manzana",
    "nutriments": {
      "energy_100g": 50,
      "fat_100g": 0,
      "carbohydrates_100g": 12,
      "proteins_100g": 0.2,
      "sugars_100g": 10
    }
  }
]
```

## Estructura del Proyecto
```
api-products/
│── node_modules/
│── package.json
│── server.js
│── .env.example
│── README.md
```

## Dependencias
- `express` - Framework web para Node.js.
- `mongoose` - ODM para MongoDB.
- `dotenv` - Carga variables de entorno desde un archivo `.env`.
- `cors` - Middleware para habilitar CORS.

