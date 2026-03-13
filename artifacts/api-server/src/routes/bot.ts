import { Router, type IRouter, type Request, type Response } from "express";
import { getBotStatus } from "../bot/whatsapp";

const router: IRouter = Router();

const ADMIN_TOKEN = "altogen-admin-secret-token-2024";

function requireAdmin(req: Request, res: Response, next: () => void) {
  const auth = req.headers.authorization;
  if (!auth || auth !== `Bearer ${ADMIN_TOKEN}`) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  next();
}

router.get("/admin/bot/status", requireAdmin, (_req: Request, res: Response) => {
  const status = getBotStatus();
  res.json(status);
});

export default router;
