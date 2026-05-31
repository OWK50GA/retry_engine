import express from "express";

const app = express();

app.use(express.json());

app.get("/health", (req, res) => {
    return res.json({
        status: "healthy",
    })
})

app.listen(3001, () => {
    console.log("Server is running on port 3001");
})