const express = require("express");
const app = express();
const cors = require("cors");
const dotenv = require("dotenv");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
dotenv.config();
const PORT = process.env.PORT || 5000;

app.use(
  cors({
    origin: "http://localhost:3000",
    credentials: true,
  }),
);
app.use(express.json());
app.use(cookieParser());

const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.febqytm.mongodb.net/?appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

const verifyToken = (req, res, next) => {
  try {
    const token = req.cookies.token;
    if (!token) {
      return res.status(401).send({ message: "Unauthorized" });
    }

    const decoded = jwt.verify(token, process.env.SECRET_KEY);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(403).send({ message: "Invalid or expired token" });
  }
};

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    const watchCollection = client.db("nextECommerce").collection("watches");
    const clockCollection = client.db("nextECommerce").collection("clocks");
    const fansCollection = client.db("nextECommerce").collection("fans");
    const usersCollection = client.db("nextECommerce").collection("users");
    const cartsCollection = client.db("nextECommerce").collection("carts");
    const trendingsCollection = client
      .db("nextECommerce")
      .collection("trendings");

    app.post("/users", async (req, res) => {
      try {
        const user = req.body;

        if (!user.email || !user.name || !user.password) {
          return res.status(400).send({
            message: "Email, name, and password are required",
          });
        }

        const existingUser = await usersCollection.findOne({
          email: user.email,
        });

        if (existingUser) {
          return res.status(400).send({ message: "User already exists" });
        }

        const hashedPassword = await bcrypt.hash(user.password, 12);
        const newUser = {
          name: user.name,
          email: user.email,
          password: hashedPassword,
          role: "user",
          createdAt: new Date(),
        };

        const result = await usersCollection.insertOne(newUser);
        res.send({
          success: true,
          user: {
            _id: result.insertedId,
            name: newUser.name,
            email: newUser.email,
            role: newUser.role,
            createdAt: newUser.createdAt,
          },
        });
      } catch (error) {
        console.error("Error creating new user:", error);
        res.status(500).send("Internal Server Error");
      }
    });

    app.post("/login", async (req, res) => {
      try {
        const { email, password } = req.body;
        const user = await usersCollection.findOne({ email });
        if (!user) {
          return res.status(400).send({ message: "Invalid email or password" });
        }
        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
          return res.status(400).send({ message: "Invalid email or password" });
        }

        const token = jwt.sign({ userId: user._id }, process.env.SECRET_KEY, {
          expiresIn: "7d",
        });

        res.cookie("token", token, {
          httpOnly: true,
          secure: false, // keep false for localhost (HTTP)
          sameSite: "lax",
          path: "/", // 🔥 VERY IMPORTANT
          maxAge: 7 * 24 * 60 * 60 * 1000,
        });

        res.send({
          success: true,
          message: "Login successful",
        });
      } catch (error) {
        console.error("Error during login:", error);
        res.status(500).send("Internal Server Error");
      }
    });

    app.get("/me", verifyToken, async (req, res) => {
      try {
        const user = await usersCollection.findOne(
          { _id: new ObjectId(req.user.userId) },
          { projection: { password: 0 } },
        );
        if (!user) {
          return res.status(404).send({ message: "User not found" });
        }
        res.send(user);
      } catch (error) {
        console.error("Error fetching user details:", error);
        res.status(500).send("Internal Server Error");
      }
    });

    app.post("/logout", (req, res) => {
      res.clearCookie("token", {
        httpOnly: true,
        secure: false,
        sameSite: "lax",
      });
      res.send({
        success: true,
        message: "Logout successful",
      });
    });

    app.post("/watches", verifyToken, async (req, res) => {
      try {
        const watch = req.body;

        const result = await watchCollection.insertOne(watch);
        res.send(result);
      } catch (error) {
        console.error("Error inserting watch:", error);
        res.status(500).send("Internal Server Error");
      }
    });
    app.get("/watches", async (req, res) => {
      try {
        const watches = await watchCollection.find().toArray();
        res.send(watches);
      } catch (error) {
        console.error("Error fetching watches:", error);
        res.status(500).send("Internal Server Error");
      }
    });

    app.post("/clocks", verifyToken, async (req, res) => {
      try {
        const clock = req.body;
        const result = await clockCollection.insertOne(clock);
        res.send(result);
      } catch (error) {
        console.error("Error inserting clock:", error);
        res.status(500).send("Internal Server Error");
      }
    });
    app.get("/clocks", async (req, res) => {
      try {
        const clocks = await clockCollection.find().toArray();
        res.send(clocks);
      } catch (error) {
        console.error("Error fetching clocks:", error);
        res.status(500).send("Internal Server Error");
      }
    });

    app.post("/fans", verifyToken, async (req, res) => {
      try {
        const fan = req.body;
        const result = await fansCollection.insertOne(fan);
        res.send(result);
      } catch (error) {
        console.error("Error inserting fan:", error);
        res.status(500).send("Internal Server Error");
      }
    });
    app.get("/fans", async (req, res) => {
      try {
        const fans = await fansCollection.find().toArray();
        res.send(fans);
      } catch (error) {
        console.error("Error fetching fans:", error);
        res.status(500).send("Internal Server Error");
      }
    });

    app.post("/trendings", verifyToken, async (req, res) => {
      try {
        const trending = req.body;
        const result = await trendingsCollection.insertOne(trending);
        res.send(result);
      } catch (error) {
        console.error("Error inserting trending item:", error);
        res.status(500).send("Internal Server Error");
      }
    });
    app.get("/trendings", async (req, res) => {
      try {
        const trendings = await trendingsCollection.find().toArray();
        res.send(trendings);
      } catch (error) {
        console.error("Error fetching trending items:", error);
        res.status(500).send("Internal Server Error");
      }
    });

    app.post("/carts", verifyToken, async (req, res) => {
      try {
        const userId = req.user.userId;
        const { productId, quantity } = req.body;

        const existingCart = await cartsCollection.findOne({
          productId,
          userId,
        });

        if (existingCart) {
          const updated = await cartsCollection.updateOne(
            { _id: existingCart._id },
            { $inc: { quantity: quantity } },
          );
          return res.send(updated);
        } else {
          const result = await cartsCollection.insertOne(req.body);
          return res.send(result);
        }
      } catch (error) {
        console.error("Error inserting cart:", error);
        res.status(500).send("Internal Server Error");
      }
    });

    app.get("/carts/:userId", verifyToken, async (req, res) => {
      const userId = req.user.userId;
      const result = await cartsCollection.find({ userId }).toArray();
      res.send(result);
    });

    app.delete("/carts/:id", verifyToken, async (req, res) => {
      const id = req.params.id;
      const result = await cartsCollection.deleteOne({
        _id: new ObjectId(id),
      });
      res.send(result);
    });

    app.patch("/carts/:id", verifyToken, async (req, res) => {
      const id = req.params.id;
      const { quantity } = req.body;

      const result = await cartsCollection.updateOne(
        { _id: new ObjectId(id) },
        { $set: { quantity } },
      );

      res.send(result);
    });

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!",
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Next E commerce server is running!");
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
