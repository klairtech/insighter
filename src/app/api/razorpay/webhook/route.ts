import { NextRequest, NextResponse } from "next/server";
import crypto from 'crypto';

export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const signature = request.headers.get('x-razorpay-signature');
    
    if (!signature) {
      return NextResponse.json(
        { error: "Missing signature" },
        { status: 400 }
      );
    }

    // Verify webhook signature
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET!)
      .update(body)
      .digest('hex');

    if (signature !== expectedSignature) {
      return NextResponse.json(
        { error: "Invalid signature" },
        { status: 400 }
      );
    }

    const event = JSON.parse(body);
    
    // Handle different webhook events
    switch (event.event) {
      case 'payment.captured':
        await handlePaymentCaptured(event.payload.payment.entity);
        break;
      case 'payment.failed':
        await handlePaymentFailed(event.payload.payment.entity);
        break;
      case 'order.paid':
        await handleOrderPaid(event.payload.order.entity);
        break;
      default:
        console.log(`Unhandled webhook event: ${event.event}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Webhook error:", error);
    return NextResponse.json(
      { error: "Webhook processing failed" },
      { status: 500 }
    );
  }
}

interface RazorpayPayment {
  id: string;
  amount: number;
  currency: string;
  status: string;
  [key: string]: unknown;
}

interface RazorpayOrder {
  id: string;
  amount: number;
  currency: string;
  status: string;
  [key: string]: unknown;
}

async function handlePaymentCaptured(payment: RazorpayPayment) {
  console.log('Payment captured:', payment.id);
  
  // You can add additional logic here for payment captured events
  // For example, sending confirmation emails, updating analytics, etc.
}

async function handlePaymentFailed(payment: RazorpayPayment) {
  console.log('Payment failed:', payment.id);
  
  // You can add logic here for failed payments
  // For example, notifying the user, logging for analysis, etc.
}

async function handleOrderPaid(order: RazorpayOrder) {
  console.log('Order paid:', order.id);
  
  // You can add logic here for order paid events
  // This is a backup verification in case the frontend verification fails
}
