const express = require("express");
const app = express();
const cors = require("cors");
const PORT = process.env.PORT || 5000;

// middleware
app.use(cors());
app.use(express.json());

// routes
app.get("/", (req, res) => {
  res.status(200).json({ message: "server is running", error: false });
});

app.listen(PORT, () => {
  console.log(`server is running on port: http://localhost:${PORT}`);
});
