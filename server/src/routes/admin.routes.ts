import { Router } from "express";
import {
  createOfficer,
  listAudit,
  listCategories,
  listFlags,
  listUsers,
  overview,
  resolveFlags,
  updateCategory,
  updateUser,
} from "../controllers/admin.controller";
import { authenticate, requireRole } from "../middleware/auth";
import { validateBody } from "../middleware/validate";
import { categorySchema, moderationSchema, updateUserSchema } from "../validators/admin.schemas";
import { createOfficerSchema } from "../validators/auth.schemas";

export const adminRouter = Router();

adminRouter.use(authenticate, requireRole("admin"));

adminRouter.get("/overview", overview);
adminRouter.get("/users", listUsers);
adminRouter.post("/officers", validateBody(createOfficerSchema), createOfficer);
adminRouter.patch("/users/:id", validateBody(updateUserSchema), updateUser);
adminRouter.get("/flags", listFlags);
adminRouter.post("/flags/resolve", validateBody(moderationSchema), resolveFlags);
adminRouter.get("/categories", listCategories);
adminRouter.put("/categories/:category", validateBody(categorySchema), updateCategory);
adminRouter.get("/audit", listAudit);
