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

    // database collection
    const usersCollection = client
      .db("Lets-Talk-School-DB")
      .collection("users");
    const classesCollection = client
      .db("Lets-Talk-School-DB")
      .collection("classes");

    // user api
    app.post("/user", async (req, res) => {
      console.log(userInfo);
      const result = await usersCollection.insertOne(userInfo);
      res.send(result);
    });

    // class api
    app.get("/topSixClass", async (req, res) => {
      const result = await classesCollection
        .find()
        .sort({ enrolledStudentsId: -1 })
        .limit(4)
        .toArray();

      res.send(result);
    });

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
