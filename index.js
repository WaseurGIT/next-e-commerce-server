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
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"],
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

    const usersCollection = client.db("nextECommerce").collection("users");
    const cartsCollection = client.db("nextECommerce").collection("carts");
    const productsCollection = client
      .db("nextECommerce")
      .collection("products");

    const verifyAdmin = async (req, res, next) => {
      try {
        const email = req.user.email;
        const user = await usersCollection.findOne({ email });
        if (user.role !== "admin") {
          return res.status(403).send({ message: "Forbidden" });
        }
        next();
      } catch (error) {
        res.status(500).send({ message: "Internal Server Error" });
      }
    };

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

    app.get("/users", verifyToken, verifyAdmin, async (req, res) => {
      try {
        const users = await usersCollection
          .find({}, { projection: { password: 0 } })
          .toArray();
        res.send(users);
      } catch (error) {
        console.error("Error fetching users:", error);
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

        const token = jwt.sign(
          { userId: user._id, email: user.email },
          process.env.SECRET_KEY,
          {
            expiresIn: "7d",
          },
        );

        res.cookie("token", token, {
          httpOnly: true,
          secure: false,
          sameSite: "lax",
          path: "/",
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

    app.post("/google-login", async (req, res) => {
      try {
        const { name, email } = req.body;

        let user = await usersCollection.findOne({ email });
        if (!user) {
          const newUser = {
            name,
            email,
            role: "user",
            createdAt: new Date(),
          };

          const result = await usersCollection.insertOne(newUser);

          user = {
            _id: result.insertedId,
            ...newUser,
          };
        }
        const token = jwt.sign(
          { userId: user._id, email: user.email },
          process.env.SECRET_KEY,
          {
            expiresIn: "7d",
          },
        );

        res.cookie("token", token, {
          httpOnly: true,
          secure: false,
          sameSite: "lax",
          path: "/",
          maxAge: 7 * 24 * 60 * 60 * 1000,
        });

        res.send({
          success: true,
          user: {
            _id: user._id,
            name: user.name,
            email: user.email,
            role: user.role,
            createdAt: user.createdAt,
          },
        });
      } catch (error) {
        console.error("Google login error:", error);
        res.status(500).send("Internal Server Error");
      }
    });

    app.post("/carts", verifyToken, async (req, res) => {
      try {
        const userId = req.user.userId;
        const { productId, quantity = 1 } = req.body;

        const existingCart = await cartsCollection.findOne({
          userId,
          productId,
        });

        if (existingCart) {
          const updated = await cartsCollection.updateOne(
            { _id: existingCart._id },
            { $inc: { quantity } },
          );
          return res.send(updated);
        } else {
          const result = await cartsCollection.insertOne({
            userId,
            productId,
            quantity: quantity || 1,
            createdAt: new Date(),
          });
          return res.send(result);
        }
      } catch (error) {
        console.error("Error inserting cart:", error);
        res.status(500).send("Internal Server Error");
      }
    });

    app.get("/carts", verifyToken, async (req, res) => {
      try {
        const userId = req.user.userId;
        const carts = await cartsCollection.find({ userId }).toArray();
        const productIds = carts.map((cart) => new ObjectId(cart.productId));

        const products = await productsCollection
          .find({ _id: { $in: productIds } })
          .toArray();

        const results = carts
          .map((cart) => {
            const product = products.find(
              (p) => p._id.toString() === cart.productId,
            );

            if (!product) return null;

            return {
              _id: cart._id,
              productId: cart.productId,
              name: product.name,
              price: product.price,
              image: product.image,
              quantity: cart.quantity,
            };
          })
          .filter(Boolean);

        res.send(results);
      } catch (error) {
        res.status(500).send("Error fetching cart");
      }
    });

    app.delete("/carts/:id", verifyToken, async (req, res) => {
      const userId = req.user.userId;
      const id = req.params.id;

      const result = await cartsCollection.deleteOne({
        _id: new ObjectId(id),
        userId,
      });

      res.send(result);
    });

    app.patch("/carts/:id", verifyToken, async (req, res) => {
      const userId = req.user.userId;
      const id = req.params.id;
      const { quantity } = req.body;

      const result = await cartsCollection.updateOne(
        { _id: new ObjectId(id), userId },
        { $set: { quantity: quantity || 1 } },
      );

      res.send(result);
    });

    app.get("/products", async (req, res) => {
      try {
        const { category } = req.query;
        const filter = category ? { category } : {};
        const products = await productsCollection.find(filter).toArray();
        res.send(products);
      } catch (error) {
        console.error("Error fetching products:", error);
        res.status(500).send("Internal Server Error");
      }
    });

    app.post("/products", verifyToken, verifyAdmin, async (req, res) => {
      try {
        const { name, price, image, category } = req.body;
        if (!name || !price || !image || !category) {
          return res.status(400).send({ message: "All fields are required" });
        }

        const newProduct = {
          name,
          price,
          image,
          category,
          createdAt: new Date(),
        };

        const result = await productsCollection.insertOne(newProduct);
        res.send({
          success: true,
          product: {
            _id: result.insertedId,
            ...newProduct,
          },
        });
      } catch (error) {
        console.error("Error creating product:", error);
        res.status(500).send("Internal Server Error");
      }
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
