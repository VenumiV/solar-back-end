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

    console.log(`Created checkout session ${session.id} for invoice ${invoice._id.toString()}`);

    // Return client secret to frontend
    res.json({ clientSecret: session.client_secret });
  } catch (error) {
    next(error);
  }
};

/**
 * Get session status for payment confirmation
 * Also updates invoice status as a fallback if webhook hasn't processed it yet
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

    // Fallback: Update invoice if payment is completed (in case webhook hasn't fired yet)
    if (session.payment_status === "paid" && session.metadata?.invoiceId) {
      const invoiceId = session.metadata.invoiceId;
      try {
        const invoice = await Invoice.findById(invoiceId);
        if (invoice && invoice.paymentStatus !== "PAID") {
          await Invoice.findByIdAndUpdate(invoiceId, {
            paymentStatus: "PAID",
            paidAt: new Date(),
          });
          console.log(`✓ Invoice ${invoiceId} marked as PAID via session status check (fallback)`);
        }
      } catch (error) {
        // Log error but don't fail the request
        console.error(`Error updating invoice ${invoiceId} via session status:`, error);
      }
    }

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
  const sig = req.headers["stripe-signature"] as string;

  if (!sig) {
    console.error("Webhook Error: Missing stripe-signature header");
    return res.status(400).send("Missing stripe-signature header");
  }

  if (!process.env.STRIPE_WEBHOOK_SECRET) {
    console.error("Webhook Error: STRIPE_WEBHOOK_SECRET is not configured");
    return res.status(500).send("Webhook secret not configured");
  }

  let event: Stripe.Event;

  // Verify webhook signature (SECURITY: proves request is from Stripe)
  try {
    event = stripe.webhooks.constructEvent(
      req.body, // Must be raw body, not parsed JSON
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
    console.log(`Received Stripe webhook event: ${event.type}`);
  } catch (err: any) {
    console.error("Webhook signature verification failed:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    // Handle payment completion (most common event)
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const invoiceId = session.metadata?.invoiceId;

      console.log(`Processing checkout.session.completed for session: ${session.id}`);
      console.log(`Payment status: ${session.payment_status}`);
      console.log(`Invoice ID from metadata: ${invoiceId}`);

      if (!invoiceId) {
        console.warn(`No invoiceId found in session metadata for session: ${session.id}`);
        return res.status(200).json({ received: true, warning: "No invoiceId in metadata" });
      }

      if (session.payment_status === "paid") {
        const invoice = await Invoice.findById(invoiceId);
        
        if (!invoice) {
          console.error(`Invoice not found: ${invoiceId}`);
          return res.status(200).json({ received: true, error: `Invoice ${invoiceId} not found` });
        }

        // Only update if not already paid
        if (invoice.paymentStatus !== "PAID") {
          await Invoice.findByIdAndUpdate(invoiceId, {
            paymentStatus: "PAID",
            paidAt: new Date(),
          });
          console.log(`✓ Invoice ${invoiceId} marked as PAID via webhook`);
        } else {
          console.log(`Invoice ${invoiceId} already marked as PAID, skipping update`);
        }
      } else {
        console.log(`Session ${session.id} payment_status is ${session.payment_status}, not updating invoice`);
      }
    }

    // Handle async payment success (for delayed payment methods like bank transfers)
    if (event.type === "checkout.session.async_payment_succeeded") {
      const session = event.data.object as Stripe.Checkout.Session;
      const invoiceId = session.metadata?.invoiceId;

      console.log(`Processing checkout.session.async_payment_succeeded for session: ${session.id}`);

      if (!invoiceId) {
        console.warn(`No invoiceId found in session metadata for async payment: ${session.id}`);
        return res.status(200).json({ received: true, warning: "No invoiceId in metadata" });
      }

      const invoice = await Invoice.findById(invoiceId);
      
      if (!invoice) {
        console.error(`Invoice not found for async payment: ${invoiceId}`);
        return res.status(200).json({ received: true, error: `Invoice ${invoiceId} not found` });
      }

      if (invoice.paymentStatus !== "PAID") {
        await Invoice.findByIdAndUpdate(invoiceId, {
          paymentStatus: "PAID",
          paidAt: new Date(),
        });
        console.log(`✓ Invoice ${invoiceId} marked as PAID (async payment) via webhook`);
      } else {
        console.log(`Invoice ${invoiceId} already marked as PAID, skipping async update`);
      }
    }

    // Always return 200 to acknowledge receipt (prevents Stripe from retrying)
    res.status(200).json({ received: true });
  } catch (error: any) {
    console.error("Error processing webhook event:", error);
    // Still return 200 to prevent Stripe retries for our errors
    // Log the error for investigation
    res.status(200).json({ received: true, error: error.message });
  }
};

