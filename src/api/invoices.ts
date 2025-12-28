import express from "express";
import {
  getInvoicesForUser,
  getInvoiceById,
  getAllInvoices,
} from "../application/invoices";
import { authenticationMiddleware } from "./middlewares/authentication-middleware";
import { authorizationMiddleware } from "./middlewares/authorization-middleware";

const invoicesRouter = express.Router();

// User routes - get their own invoices
invoicesRouter.route("/").get(authenticationMiddleware, getInvoicesForUser);

invoicesRouter
  .route("/:id")
  .get(authenticationMiddleware, getInvoiceById);

// Admin routes - get all invoices
invoicesRouter
  .route("/admin/all")
  .get(authenticationMiddleware, authorizationMiddleware, getAllInvoices);

export default invoicesRouter;

