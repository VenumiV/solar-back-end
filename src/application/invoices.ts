import { Request, Response, NextFunction } from "express";
import { Invoice } from "../infrastructure/entities/Invoice";
import { NotFoundError, ValidationError, UnauthorizedError } from "../domain/errors/error";
import { getAuth } from "@clerk/express";
import { User } from "../infrastructure/entities/User";

/**
 * Get all invoices for the authenticated user
 */
export const getInvoicesForUser = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const auth = getAuth(req);
    const clerkUserId = auth.userId;

    if (!clerkUserId) {
      throw new UnauthorizedError("Unauthorized");
    }

    const user = await User.findOne({ clerkUserId });
    if (!user) {
      throw new NotFoundError("User not found");
    }

    const { status } = req.query;

    const query: any = { userId: user._id };
    if (status && (status === "PENDING" || status === "PAID" || status === "FAILED")) {
      query.paymentStatus = status;
    }

    const invoices = await Invoice.find(query)
      .populate("solarUnitId", "serialNumber capacity")
      .sort({ billingPeriodStart: -1 });

    res.status(200).json(invoices);
  } catch (error) {
    next(error);
  }
};

/**
 * Get a single invoice by ID (user must own it)
 */
export const getInvoiceById = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const auth = getAuth(req);
    const clerkUserId = auth.userId;

    if (!clerkUserId) {
      throw new UnauthorizedError("Unauthorized");
    }

    const user = await User.findOne({ clerkUserId });
    if (!user) {
      throw new NotFoundError("User not found");
    }

    const invoice = await Invoice.findById(id)
      .populate("solarUnitId", "serialNumber capacity")
      .populate("userId", "firstName lastName email");

    if (!invoice) {
      throw new NotFoundError("Invoice not found");
    }

    // Verify user owns this invoice
    if (invoice.userId.toString() !== user._id.toString()) {
      throw new UnauthorizedError("You don't have access to this invoice");
    }

    res.status(200).json(invoice);
  } catch (error) {
    next(error);
  }
};

/**
 * Get all invoices (admin only)
 */
export const getAllInvoices = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { status, userId, solarUnitId } = req.query;

    const query: any = {};
    if (status && (status === "PENDING" || status === "PAID" || status === "FAILED")) {
      query.paymentStatus = status;
    }
    if (userId) {
      query.userId = userId;
    }
    if (solarUnitId) {
      query.solarUnitId = solarUnitId;
    }

    const invoices = await Invoice.find(query)
      .populate("solarUnitId", "serialNumber capacity")
      .populate("userId", "firstName lastName email")
      .sort({ billingPeriodStart: -1 });

    res.status(200).json(invoices);
  } catch (error) {
    next(error);
  }
};

