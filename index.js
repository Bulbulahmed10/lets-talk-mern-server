const express = require("express");
const app = express();
const cors = require("cors");
require("dotenv").config();
const { MongoClient, ServerApiVersion } = require("mongodb");

//constrain
const PORT = process.env.PORT || 5000;
const uri = process.env.MONGODB_URI;

// middleware
app.use(cors());
app.use(express.json());

// mongodb connection and api
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // await client.connect();

    await client.db("admin").command({ ping: 1 });
    console.log("Lets Talk server successfully connected to MongoDB!");
  } finally {
  }
}
run().catch(console.dir);

// home routes
app.get("/", (req, res) => {
  res.status(200).json({ message: "server is running", error: false });
});

app.listen(PORT, () => {
  console.log(`server is running on port: http://localhost:${PORT}`);
});
