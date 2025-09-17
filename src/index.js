import express from "express";
import solarUnitRouter from "./api/solar-units.js";

const server = express();
server.use(express.json());//json payloads are converted to js objects

server.use("/api/solar-units", solarUnitRouter);

const PORT = 8000;
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

/* Identify the resources
Solar Unit
Energy Generation Record
User
House
*/