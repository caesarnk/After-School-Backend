const path = require("path");

const express = require("express"); //creates server and routes
const cors = require("cors"); //allows requests from another domain
const { MongoClient} = require("mongodb");

const app = express();
app.use(cors()); //lets the vue site on another domain call this API
app.use(express.json()) // lets the server read JSON sent

app.use((req, res, next) => {
    console.log(new Date().toISOString() + " - " + req.method + " " + req.url);
    next(); //passes the requests to the next route
});

//looks for a matching file and sends it
app.use("/images", express.static(path.join(__dirname, "images")));

//if the files weren't found above, send error message
app.use("/images", (req, res) => {
    res.status(404).send("Image not found");
})

const client = new MongoClient(process.env.MONGO_URI);
let db;

//returns every lesson as JSON
app.get("/lessons", async(req, res) => {
    const lessons = await db.collection("lessons").find({}).toArray();
    res.json(lessons);
}); 

const PORT = process.env.PORT || 3000;

client.connect().then(() => {
    db = client.db("afterschool");
    app.listen(PORT, () => console.log("Server running on port " + PORT));
});