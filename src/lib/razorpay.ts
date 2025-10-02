import Razorpay from 'razorpay';

// Initialize Razorpay instance
export const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID!,
  key_secret: process.env.RAZORPAY_KEY_SECRET!,
});

// Razorpay configuration for frontend
export const razorpayConfig = {
  key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID!,
  currency: 'INR',
  name: 'Insighter',
  description: 'Credit Purchase',
  image: 'https://uvbtwtqmtsbdwmcrtdcx.supabase.co/storage/v1/object/public/website/public/Logos/Insighter/Insighter%20Logo%20White%202.png',
  theme: {
    color: '#3B82F6', // Blue color matching your theme
  },
};

// Payment options interface
export interface PaymentOptions {
  amount: number; // Amount in paise
  currency: string;
  receipt: string;
  notes?: Record<string, string>;
}

// Create Razorpay order
export async function createRazorpayOrder(options: PaymentOptions) {
  try {
    const order = await razorpay.orders.create({
      amount: options.amount,
      currency: options.currency,
      receipt: options.receipt,
      notes: options.notes,
    });
    
    return order;
  } catch (error) {
    console.error('Error creating Razorpay order:', error);
    throw error;
  }
}

// Verify payment signature
export async function verifyPaymentSignature(
  razorpay_order_id: string,
  razorpay_payment_id: string,
  razorpay_signature: string
): Promise<boolean> {
  const crypto = await import('crypto');
  const expectedSignature = crypto
    .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET!)
    .update(`${razorpay_order_id}|${razorpay_payment_id}`)
    .digest('hex');
    
  return expectedSignature === razorpay_signature;
}
