const express = require("express");
const app = express();
const cors = require("cors");
const dotenv = require("dotenv");
dotenv.config();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

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

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    const watchCollection = client.db("nextECommerce").collection("watches");
    const clockCollection = client.db("nextECommerce").collection("clocks");
    const fansCollection = client.db("nextECommerce").collection("fans");
    const usersCollection = client.db("nextECommerce").collection("users");
    const cartsCollection = client.db("nextECommerce").collection("carts");

    app.post("/watches", async (req, res) => {
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

    app.post("/clocks", async (req, res) => {
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

    app.post("/fans", async (req, res) => {
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

    app.post("/carts", async (req, res) => {
      try {
        const { productId, userId, quantity } = req.body;

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

    app.get("/carts/:userId", async (req, res) => {
      const userId = req.params.userId;
      const result = await cartsCollection.find({ userId }).toArray();
      res.send(result);
    });

    app.delete("/carts/:id", async (req, res) => {
      const id = req.params.id;
      const result = await cartsCollection.deleteOne({
        _id: new ObjectId(id),
      });
      res.send(result);
    });

    app.patch("/carts/:id", async (req, res) => {
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
