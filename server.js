const path = require("path");

const express = require("express"); //creates server and routes
const cors = require("cors"); //allows requests from another domain
const { MongoClient, ObjectId} = require("mongodb");

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
    try {
        const lessons = await db.collection("lessons").find({}).toArray();
    res.json(lessons);
    } catch (error) {
        console.log(error);
        res.status(500).json({error: "Could not retrieve lessons"});
    }
}); 

//takes the order data
app.post("/orders", async(req,res) => {
    try {
        const {name, phone, items} = req.body; //validates name, phone and items 
        //returns error is name data does not meet requirements
        if (typeof name !== "string" || !/^[A-Za-z\s]+$/.test(name.trim())) { //makes sure there arent extra spaces in the name
            return res.status(400).json({error: "Name must contain letters only"});        
        }
        //returns error is phone data does not meet requirements
        if (typeof phone !== "string" || !/^[0-9]+$/.test(phone)) {
            return res.status(400).json({error: "Phone must contain numbers only"});
        }
        if (!Array.isArray(items) || items.length ===0) {
            return res.status(400).json({error:"Order must contain at least one lesson"});
        }
        for (const item of items) {
            if (typeof item.lessonId !== "string" || !Number.isInteger(item.spaces) ||item.spaces < 1) {
                return res.status(400).json({error: "Each item needs a lessonID and spaces of 1 or more"});
            }
        }
        //saves it to the database with the users info
        const result = await db.collection("order").insertOne({name: name.trim(), phone, items}); 

        //sends a respond when the order goes through
        res.status(201).json({message: "Order received", id:result.insertedId});
    } catch (error) {
        console.log(error);
        res.status(500).json({error: "Could not save order"}); //returns error if anything unexpected happens
    }
});

app.put("/lessons/:id", async(req, res) => {
    try {
        if (!ObjectId.isValid(req.params.id)) {
            return res.status(400).json({error:"Invalid lesson id"}); 
        }
        const id = new ObjectId(req.params.id);

        const update = req.body;
        if (!update || Object.keys(update).length ===0) {
            return res.status(400).json({error: "No update data provided"});
        }

        delete update._id;

        //changes only the fields sent
        const result = await db.collection("lessons").updateOne(
            {_id: id},
            {$set: update}
        );

        if (result.matchedCount === 0) {
            return res.status(404).json({error: "Lesson not found"});
        }

        res.json({message: "Lesson updated successfully"});
    } catch (error) {
        console.log(error);
        res.status(500).json({error: "Could not update lesson"});
    }
});

app.get("/enrolment/:lessonid", async(req, res) => {
    try {
        const lessonId = req.params.lessonid;

        const orders = await db.collection("order")
        .find({"items.lessonId": lessonId})
        .toArray();

        let total = 0;
        
        for (const order of orders) {
            for (const item of order.items) {
                if (item.lessonId === lessonId) {
                    total += item.spaces;  //adds the items spaces to the total space
                }

            }
        }

        res.json({lessonId, enrolment: total});        
    } catch (error) {
        console.log(error);
        res.status(500).json({error: "Could not get enrolment"});
    }
});

// GET /search?q=... - searches subject, location, price and spaces on the server
app.get("/search", async (req, res) => {
    try {
        // read the search text, lowercase it and trim spaces
        const q = (req.query.q || "").toLowerCase().trim();

        // load all lessons from the database
        const lessons = await db.collection("lessons").find({}).toArray();

        // no search text: return every lesson
        if (q === "") {
            return res.json(lessons);
        }

        // keep a lesson if the text appears in any of the four fields
        const results = lessons.filter(lesson =>
            String(lesson.subject).toLowerCase().includes(q) ||
            String(lesson.location).toLowerCase().includes(q) ||
            String(lesson.price).includes(q) ||
            String(lesson.spaces).includes(q)
        );

        res.json(results);
    } catch (error) {
        console.log(error);
        res.status(500).json({ error: "Could not search lessons" });
    }
});

const PORT = process.env.PORT || 3000;

client.connect().then(() => {
    db = client.db("afterschool");
    app.listen(PORT, () => console.log("Server running on port " + PORT));
});