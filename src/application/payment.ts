import Stripe from "stripe";
import { Request, Response, NextFunction } from "express";
import { Invoice } from "../infrastructure/entities/Invoice";
import { NotFoundError, ValidationError } from "../domain/errors/error";
import { getAuth } from "@clerk/express";
import { User } from "../infrastructure/entities/User";

// Initialize Stripe SDK
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2025-12-15.clover",
});

/**
 * Create a Stripe checkout session for an invoice
 */
export const createCheckoutSession = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { invoiceId } = req.body;

    if (!invoiceId) {
      throw new ValidationError("Invoice ID is required");
    }

    // Get invoice
    const invoice = await Invoice.findById(invoiceId);

    if (!invoice) {
      throw new NotFoundError("Invoice not found");
    }

    // Verify user owns this invoice
    const auth = getAuth(req);
    const clerkUserId = auth.userId;
    if (!clerkUserId) {
      throw new ValidationError("Unauthorized");
    }

    const user = await User.findOne({ clerkUserId });
    if (!user) {
      throw new NotFoundError("User not found");
    }

    if (invoice.userId.toString() !== user._id.toString()) {
      throw new ValidationError("You don't have access to this invoice");
    }

    // Check if invoice is already paid
    if (invoice.paymentStatus === "PAID") {
      throw new ValidationError("Invoice already paid");
    }

    // Create Stripe Checkout Session
    const session = await stripe.checkout.sessions.create({
      ui_mode: "embedded",
      line_items: [
        {
          price: process.env.STRIPE_PRICE_ID!, // Your Price ID from Dashboard
          quantity: Math.round(invoice.totalEnergyGenerated), // kWh as quantity
        },
      ],
      mode: "payment",
      return_url: `${process.env.FRONTEND_URL}/dashboard/invoices/complete?session_id={CHECKOUT_SESSION_ID}`,
      metadata: {
        invoiceId: invoice._id.toString(), // Critical: links session to your invoice
      },
    });

    // Return client secret to frontend
    res.json({ clientSecret: session.client_secret });
  } catch (error) {
    next(error);
  }
};

/**
 * Get session status for payment confirmation
 */
export const getSessionStatus = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { session_id } = req.query;

    if (!session_id || typeof session_id !== "string") {
      throw new ValidationError("Session ID is required");
    }

    const session = await stripe.checkout.sessions.retrieve(session_id);

    res.json({
      status: session.status,
      paymentStatus: session.payment_status,
      amountTotal: session.amount_total, // Amount in cents
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Handle Stripe webhook events
 * MUST be registered before express.json() middleware
 */
export const handleStripeWebhook = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const sig = req.headers["stripe-signature"] as string;
    let event: Stripe.Event;

    // Verify webhook signature (SECURITY: proves request is from Stripe)
    try {
      event = stripe.webhooks.constructEvent(
        req.body, // Must be raw body, not parsed JSON
        sig,
        process.env.STRIPE_WEBHOOK_SECRET!
      );
    } catch (err: any) {
      console.error("Webhook signature verification failed:", err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // Handle payment completion
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const invoiceId = session.metadata?.invoiceId;

      if (invoiceId && session.payment_status === "paid") {
        await Invoice.findByIdAndUpdate(invoiceId, {
          paymentStatus: "PAID",
          paidAt: new Date(),
        });
        console.log("Invoice marked as PAID:", invoiceId);
      }
    }

    // Handle async payment success (for delayed payment methods)
    if (event.type === "checkout.session.async_payment_succeeded") {
      const session = event.data.object as Stripe.Checkout.Session;
      const invoiceId = session.metadata?.invoiceId;

      if (invoiceId) {
        await Invoice.findByIdAndUpdate(invoiceId, {
          paymentStatus: "PAID",
          paidAt: new Date(),
        });
        console.log("Invoice marked as PAID (async):", invoiceId);
      }
    }

    // Always return 200 to acknowledge receipt
    res.status(200).json({ received: true });
  } catch (error) {
    next(error);
  }
};

