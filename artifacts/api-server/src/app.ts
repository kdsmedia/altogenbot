import express, { type Express } from "express";
import cors from "cors";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import router from "./routes";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app: Express = express();

app.use(cors());
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// Serve proof images uploaded via WhatsApp
// __dirname here is artifacts/api-server/src → go up 1 to artifacts/api-server
const PROOFS_PUBLIC = path.join(__dirname, "../public/proofs");
if (!fs.existsSync(PROOFS_PUBLIC)) fs.mkdirSync(PROOFS_PUBLIC, { recursive: true });
app.use("/api/proofs", express.static(PROOFS_PUBLIC));

app.use("/api", router);

export default app;
