import { Router } from "express";
import { createOfficer, listUsers } from "../controllers/admin.controller";
import { authenticate, requireRole } from "../middleware/auth";
import { validateBody } from "../middleware/validate";
import { createOfficerSchema } from "../validators/auth.schemas";

export const adminRouter = Router();

adminRouter.use(authenticate, requireRole("admin"));

adminRouter.get("/users", listUsers);
adminRouter.post("/officers", validateBody(createOfficerSchema), createOfficer);
