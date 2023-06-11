const express = require("express");
const app = express();
const cors = require("cors");
require("dotenv").config();
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const jwt = require("jsonwebtoken");
const stripe = require("stripe")(process.env.STRIPE_PAYMENT_SECRET_KEY);
//constrain
const PORT = process.env.PORT || 5000;
const uri = process.env.MONGODB_URI;

// middleware
app.use(cors());
app.use(express.json());

const verifyJWT = (req, res, next) => {
  const authorization = req.headers.authorization;

  if (!authorization) {
    return res
      .status(401)
      .send({ message: "Invalid authorization", error: true });
  }
  const token = authorization.split(" ")[1];
  jwt.verify(token, process.env.JWT_SECRET_KEY, (err, decoded) => {
    if (err) {
      return res.status(403).send({ message: "Forbidden access" });
    }
    req.decoded = decoded;
    next();
  });
};

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
    const cartCollection = client.db("Lets-Talk-School-DB").collection("carts");
    const paymentCollection = client
      .db("Lets-Talk-School-DB")
      .collection("payment");

    // verify middleware
    const verifyInstructor = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email };
      const user = await usersCollection.findOne(query);
      if (user?.role !== "instructor") {
        return res
          .status(403)
          .send({ error: true, message: "forbidden message" });
      }
      next();
    };
    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email };
      const user = await usersCollection.findOne(query);
      if (user?.role !== "admin") {
        return res
          .status(403)
          .send({ error: true, message: "forbidden message" });
      }
      next();
    };

    // jwt api
    app.post("/userJwtToken", (req, res) => {
      const userEmail = req.body;
      const token = jwt.sign(userEmail, process.env.JWT_SECRET_KEY, {
        expiresIn: "1h",
      });
      res.send({ token });
    });

    // user api
    app.get("/users/instructor/:email", verifyJWT, async (req, res) => {
      const email = req.params.email;
      if (req.decoded.email !== email) {
        res.send({ admin: false });
      }

      const query = { email: email };
      const user = await usersCollection.findOne(query);
      const result = { isInstructor: user?.role === "instructor" };
      res.send(result);
    });
    app.get("/users/admin/:email", verifyJWT, async (req, res) => {
      const email = req.params.email;
      if (req.decoded.email !== email) {
        res.send({ admin: false });
      }
      const query = { email: email };
      const user = await usersCollection.findOne(query);
      const result = { isAdmin: user?.role === "admin" };
      res.send(result);
    });

    app.get("/admin/allUsers", verifyJWT, verifyAdmin, async (req, res) => {
      const result = await usersCollection.find().toArray();
      res.send(result);
    });

    app.post("/user", async (req, res) => {
      const userInfo = req.body;
      const result = await usersCollection.insertOne(userInfo);
      res.send(result);
    });

    app.patch("/admin/updateUser", verifyJWT, verifyAdmin, async (req, res) => {
      const { role, email } = req.body;

      const filter = { email: email };
      const options = { upsert: true };
      const updateDoc = {
        $set: {
          role: role,
        },
      };
      const result = await usersCollection.updateOne(
        filter,
        updateDoc,
        options
      );

      res.send(result);
    });

    // class api
    app.get("/topSixClass", async (req, res) => {
      const pipeline = [
        {
          $match: {
            approved_status: "approved",
            enrolledStudentsId: { $exists: true },
          },
        },
        {
          $addFields: {
            enrolledStudentsCount: { $size: "$enrolledStudentsId" },
          },
        },
        { $sort: { enrolledStudentsCount: -1 } },
        { $limit: 6 },
      ];

      const result = await classesCollection.aggregate(pipeline).toArray();
      res.send(result);
    });

    app.get(
      "/instructor/myClass/:email",
      verifyJWT,
      verifyInstructor,
      async (req, res) => {
        const params = req.params.email;
        const query = {
          instructor_email: params,
        };
        const result = await classesCollection.find(query).toArray();
        res.send(result);
      }
    );

    app.get("/admin/allClasses", verifyJWT, verifyAdmin, async (req, res) => {
      const result = await classesCollection.find().toArray();
      res.send(result);
    });

    app.post("/addClass", verifyJWT, verifyInstructor, async (req, res) => {
      const classInfo = req.body;
      const result = await classesCollection.insertOne(classInfo);
      res.send(result);
    });

    app.post("/classes/enroll", verifyJWT, async (req, res) => {
      const { classIds, studentEmail } = req.body;
      const result = await classesCollection.updateMany(
        { _id: { $in: classIds.map((id) => new ObjectId(id)) } },
        { $push: { enrolledStudentsId: studentEmail } }
      );
      res.send(result);
    });

    app.patch(
      "/admin/updateClass",
      verifyJWT,
      verifyAdmin,
      async (req, res) => {
        const updateClassInfo = req.body;
        const filter = { _id: new ObjectId(updateClassInfo.id) };
        const options = { upsert: true };
        const updateDoc = {
          $set: {
            approved_status: updateClassInfo.status,
            feedback: updateClassInfo.feedback,
          },
        };
        const result = await classesCollection.updateOne(
          filter,
          updateDoc,
          options
        );
        res.send(result);
      }
    );
    app.patch(
      "/admin/updateClassFeedback",
      verifyJWT,
      verifyAdmin,
      async (req, res) => {
        const feedbackData = req.body;
        const filter = { _id: new ObjectId(feedbackData.feedbackClassId) };
        const options = { upsert: true };
        const updateDoc = {
          $set: {
            feedback: feedbackData.feedbackValue,
          },
        };
        const result = await classesCollection.updateOne(
          filter,
          updateDoc,
          options
        );
        res.send(result);
      }
    );

    // cart api

    app.get("/carts", verifyJWT, async (req, res) => {
      const email = req.query.email;
      if (!email) {
        return res.send([]);
      }

      const decodedEmail = req.decoded.email;
      if (email !== decodedEmail) {
        return res.status(403).send({ message: "Invalid email", error: true });
      }
      const query = { cart_owner: email };
      const result = await cartCollection.find(query).toArray();
      res.send(result);
    });

    app.post("/cart", async (req, res) => {
      const cartInfo = req.body;
      const result = await cartCollection.insertOne(cartInfo);
      res.send(result);
    });

    app.delete("/cart/:id", async (req, res) => {
      const cartId = req.params.id;
      const filter = { _id: new ObjectId(cartId) };
      const result = await cartCollection.deleteOne(filter);
      res.send(result);
    });

    // stripe payment api

    app.get("/payment-history", verifyJWT, async (req, res) => {
      const email = req.query.email;
      if (!email) {
        return res.send([]);
      }

      const decodedEmail = req.decoded.email;
      if (email !== decodedEmail) {
        return res.status(403).send({ message: "Invalid email", error: true });
      }
      const query = { email: email };
      const options = {
        sort: {
          date: -1,
        },
      };
      const result = await paymentCollection.find(query, options).toArray();
      res.send(result);
    });

    app.post("/create-stripe-payment-intent", verifyJWT, async (req, res) => {
      const { parsableTotalPrice } = req.body;

      const amount = parsableTotalPrice * 100;
      const paymentIntent = await stripe.paymentIntents.create({
        amount: parseInt(amount),
        currency: "usd",
        payment_method_types: ["card"],
      });

      res.send({
        clientSecret: paymentIntent.client_secret,
      });
    });

    app.post("/payments", verifyJWT, async (req, res) => {
      const payment = req.body;
      const insertResult = await paymentCollection.insertOne(payment);

      const query = {
        _id: { $in: payment.cartItems.map((id) => new ObjectId(id)) },
      };
      const deleteResult = await cartCollection.deleteMany(query);
      res.send({ insertResult, deleteResult });
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
