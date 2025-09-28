import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/server-utils";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    console.log('🔍 Invoice request for ID:', id);
    
    // Create server-side Supabase client that can read session cookies
    const supabase = await createServerSupabaseClient();
    
    // Get the current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Fetch purchase details
    const { data: purchase, error: purchaseError } = await supabase
      .from('insighter_purchases')
      .select(`
        id,
        credits_purchased,
        amount_paid,
        status,
        purchase_date,
        payment_id,
        order_id,
        insighter_plans!inner(
          plan_type
        )
      `)
      .eq('id', id)
      .eq('user_id', user.id)
      .single();

    if (purchaseError) {
      console.log('❌ Purchase not found in insighter_purchases:', purchaseError);
      // Try premium purchases table
      const { data: premiumPurchase, error: premiumError } = await supabase
        .from('credit_purchases')
        .select(`
          id,
          credits_purchased,
          bonus_credits,
          total_credits,
          amount_paid,
          status,
          purchase_date,
          razorpay_payment_id,
          razorpay_order_id
        `)
        .eq('id', id)
        .eq('user_id', user.id)
        .single();

      if (premiumError) {
        console.log('❌ Purchase not found in credit_purchases either:', premiumError);
        return NextResponse.json(
          { error: "Invoice not found" },
          { status: 404 }
        );
      }

      // Generate invoice for premium purchase
      const invoice = generateInvoice(premiumPurchase, user);
      return new NextResponse(invoice as BodyInit, {
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Content-Disposition': `inline; filename="invoice-${id}.html"`
        }
      });
    }

    // Generate invoice for flexible purchase
    console.log('✅ Purchase found, generating invoice for:', purchase.id);
    const invoice = generateInvoice(purchase, user);
    return new NextResponse(invoice as BodyInit, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Disposition': `inline; filename="invoice-${id}.html"`
      }
    });

  } catch (error) {
    console.error("Invoice generation error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

function generateInvoice(purchase: { id: string; purchase_date: string; insighter_plans?: Array<{ plan_type: string }>; [key: string]: unknown }, user: { email?: string | null; user_metadata?: { name?: string } | null }): Buffer {
  // Simple PDF generation - in production, you'd use a proper PDF library like puppeteer or jsPDF
  const invoiceData = {
    invoiceId: purchase.id,
    date: new Date(purchase.purchase_date).toLocaleDateString(),
    customerEmail: user.email || '',
    customerName: user.user_metadata?.name || user.email?.split('@')[0] || 'Customer',
    items: [
      {
        description: `${purchase.credits_purchased || purchase.total_credits} Credits (${purchase.insighter_plans?.[0]?.plan_type || 'flexible'} plan)`,
        quantity: 1,
        unitPrice: (purchase.amount_paid as number) / 100,
        total: (purchase.amount_paid as number) / 100
      }
    ],
    subtotal: (purchase.amount_paid as number) / 100,
    tax: 0,
    total: (purchase.amount_paid as number) / 100,
    paymentId: purchase.payment_id || purchase.razorpay_payment_id,
    orderId: purchase.order_id || purchase.razorpay_order_id
  };

  // Generate HTML invoice with company branding
  const invoiceHTML = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Invoice #${invoiceData.invoiceId}</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6;
            color: #ffffff;
            background: #000000;
        }
        
        .invoice-container {
            max-width: 800px;
            margin: 0 auto;
            padding: 40px 20px;
            background: #000000;
        }
        
        .header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            margin-bottom: 40px;
            padding-bottom: 20px;
            border-bottom: 2px solid #3b82f6;
        }
        
        .company-info h1 {
            color: #60a5fa;
            font-size: 28px;
            font-weight: 700;
            margin-bottom: 8px;
        }
        
        .company-info .tagline {
            color: #9ca3af;
            font-size: 14px;
            font-weight: 500;
            margin-bottom: 16px;
        }
        
        .company-details {
            color: #d1d5db;
            font-size: 14px;
            line-height: 1.5;
        }
        
        .invoice-meta {
            text-align: right;
        }
        
        .invoice-title {
            font-size: 32px;
            font-weight: 700;
            color: #60a5fa;
            margin-bottom: 8px;
        }
        
        .invoice-number {
            color: #9ca3af;
            font-size: 16px;
        }
        
        .invoice-date {
            color: #9ca3af;
            font-size: 14px;
            margin-top: 4px;
        }
        
        .billing-section {
            display: flex;
            justify-content: space-between;
            margin-bottom: 40px;
        }
        
        .bill-to {
            flex: 1;
        }
        
        .bill-to h3 {
            color: #60a5fa;
            font-size: 18px;
            font-weight: 600;
            margin-bottom: 12px;
        }
        
        .bill-to p {
            color: #d1d5db;
            font-size: 14px;
            margin-bottom: 4px;
        }
        
        .items-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 30px;
            background: #111827;
            border-radius: 8px;
            overflow: hidden;
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
            border: 1px solid #374151;
        }
        
        .items-table th {
            background: #3b82f6;
            color: white;
            padding: 16px;
            text-align: left;
            font-weight: 600;
            font-size: 14px;
        }
        
        .items-table td {
            padding: 16px;
            border-bottom: 1px solid #374151;
            font-size: 14px;
        }
        
        .items-table tr:last-child td {
            border-bottom: none;
        }
        
        .items-table tr:nth-child(even) {
            background: #1f2937;
        }
        
        .description {
            color: #ffffff;
            font-weight: 500;
        }
        
        .quantity, .unit-price, .total {
            text-align: right;
            color: #d1d5db;
        }
        
        .total {
            font-weight: 600;
            color: #60a5fa;
        }
        
        .totals-section {
            display: flex;
            justify-content: flex-end;
            margin-bottom: 40px;
        }
        
        .totals-table {
            width: 300px;
        }
        
        .totals-table tr {
            display: flex;
            justify-content: space-between;
            padding: 8px 0;
            border-bottom: 1px solid #374151;
        }
        
        .totals-table tr:last-child {
            border-bottom: 2px solid #3b82f6;
            font-weight: 700;
            font-size: 16px;
            color: #60a5fa;
        }
        
        .totals-table td:first-child {
            color: #9ca3af;
        }
        
        .totals-table td:last-child {
            text-align: right;
        }
        
        .payment-info {
            background: #1f2937;
            padding: 20px;
            border-radius: 8px;
            border-left: 4px solid #3b82f6;
            border: 1px solid #374151;
        }
        
        .payment-info h3 {
            color: #60a5fa;
            font-size: 16px;
            font-weight: 600;
            margin-bottom: 12px;
        }
        
        .payment-info p {
            color: #d1d5db;
            font-size: 14px;
            margin-bottom: 4px;
        }
        
        .footer {
            margin-top: 40px;
            padding-top: 20px;
            border-top: 1px solid #374151;
            text-align: center;
            color: #9ca3af;
            font-size: 14px;
        }
        
        .footer .brand {
            color: #60a5fa;
            font-weight: 600;
        }
        
        @media print {
            body { margin: 0; }
            .invoice-container { padding: 20px; }
        }
    </style>
</head>
<body>
    <div class="invoice-container">
        <div class="header">
            <div class="company-info">
                <h1>Klair Technology Solutions Private Limited</h1>
                <div class="tagline">Insighter is a Brand of Klair Tech</div>
                <div class="company-details">
                    MCH No.10-2-289/120/30/2, 332/2RT, near Ratnadeep Supermarket<br>
                    Vijaynagar Colony, Potti Sriramulu Nagar, Masab Tank<br>
                    Hyderabad, Telangana 500057<br>
                    Email: ceo@klairtech.com
                </div>
            </div>
            <div class="invoice-meta">
                <div class="invoice-title">INVOICE</div>
                <div class="invoice-number">#${invoiceData.invoiceId}</div>
                <div class="invoice-date">Date: ${invoiceData.date}</div>
            </div>
        </div>
        
        <div class="billing-section">
            <div class="bill-to">
                <h3>Bill To:</h3>
                <p><strong>${invoiceData.customerName}</strong></p>
                <p>${invoiceData.customerEmail}</p>
            </div>
        </div>
        
        <table class="items-table">
            <thead>
                <tr>
                    <th>Description</th>
                    <th style="text-align: right;">Quantity</th>
                    <th style="text-align: right;">Unit Price</th>
                    <th style="text-align: right;">Total</th>
                </tr>
            </thead>
            <tbody>
                ${invoiceData.items.map(item => `
                    <tr>
                        <td class="description">${item.description}</td>
                        <td class="quantity">${item.quantity}</td>
                        <td class="unit-price">₹${item.unitPrice.toFixed(2)}</td>
                        <td class="total">₹${item.total.toFixed(2)}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
        
        <div class="totals-section">
            <table class="totals-table">
                <tr>
                    <td>Subtotal:</td>
                    <td>₹${invoiceData.subtotal.toFixed(2)}</td>
                </tr>
                <tr>
                    <td>Tax:</td>
                    <td>₹${invoiceData.tax.toFixed(2)}</td>
                </tr>
                <tr>
                    <td>Total:</td>
                    <td>₹${invoiceData.total.toFixed(2)}</td>
                </tr>
            </table>
        </div>
        
        <div class="payment-info">
            <h3>Payment Information</h3>
            <p><strong>Payment ID:</strong> ${invoiceData.paymentId}</p>
            <p><strong>Order ID:</strong> ${invoiceData.orderId}</p>
        </div>
        
        <div class="footer">
            <p>Thank you for choosing <span class="brand">Insighter</span>!</p>
            <p>For support, contact us at ceo@klairtech.com</p>
        </div>
    </div>
</body>
</html>`;

  return Buffer.from(invoiceHTML, 'utf-8');
}
