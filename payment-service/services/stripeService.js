import Stripe from "stripe";
const stripeSecret =
  process.env.STRIPE_SECRET_KEY ||
  process.env.STRIPE_KEY ||
  (process.env.NODE_ENV === 'test' ? 'sk_test_dummy' : '');
const stripe = stripeSecret ? new Stripe(stripeSecret) : null;

export const createStripePayment = async ({
  orderId,
  amount,
  customerEmail,
  customerName,
  metadata,
}) => {
  if (!stripe) {
    throw new Error("Stripe not configured");
  }
  const session = await stripe.checkout.sessions.create({
    payment_method_types: ["card"],
    line_items: [
      {
        price_data: {
          currency: "lkr",
          product_data: { name: `Order #${orderId}` },
          unit_amount: Math.round(amount * 100), // Convert to cents
        },
        quantity: 1,
      },
    ],
    mode: "payment",
    customer_email: customerEmail,
    metadata: { ...metadata, customerName },
    success_url: `${process.env.FRONTEND_URL}/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${process.env.FRONTEND_URL}/cancel`,
  });

  return { paymentUrl: session.url };
};
