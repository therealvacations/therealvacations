import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  // Verify the cron secret
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const today = new Date().toISOString().split('T')[0];
    
    // Find due payments
    const { data: duePayments } = await supabase
      .from('payment_schedule')
      .select('*, bookings(*, trips(*), users(*)), user_payment_methods(*)')
      .eq('status', 'pending')
      .lte('auto_charge_date', today);

    if (!duePayments || duePayments.length === 0) {
      return res.status(200).json({ processed: 0, message: 'No payments due' });
    }

    let processed = 0;
    let failed = 0;

    for (const payment of duePayments) {
      try {
        const booking = payment.bookings;
        const user = booking.users;
        const paymentMethod = payment.user_payment_methods?.[0];

        if (!paymentMethod || !paymentMethod.stripe_customer_id) {
          console.log(`No payment method for ${user.user_id}`);
          failed++;
          continue;
        }

        // Create charge
        const charge = await stripe.charges.create({
          amount: Math.round(payment.amount_due * 100),
          currency: 'usd',
          customer: paymentMethod.stripe_customer_id,
          description: `${booking.trips.title} - Payment ${payment.payment_number}`,
          metadata: { booking_id: booking.booking_id },
        });

        // Update schedule
        await supabase
          .from('payment_schedule')
          .update({ 
            status: 'completed', 
            stripe_payment_intent_id: charge.id 
          })
          .eq('schedule_id', payment.schedule_id);

        // Update booking
        const newPaid = booking.amount_paid + payment.amount_due;
        await supabase
          .from('bookings')
          .update({
            amount_paid: newPaid,
            balance_due: booking.total_amount - newPaid,
            status: booking.total_amount === newPaid ? 'confirmed' : 'pending',
          })
          .eq('booking_id', booking.booking_id);

        // Record payment
        await supabase.from('payment_history').insert([
          {
            booking_id: booking.booking_id,
            user_id: user.user_id,
            amount: payment.amount_due,
            payment_date: new Date().toISOString(),
            status: 'succeeded',
            stripe_charge_id: charge.id,
          },
        ]);

        processed++;
      } catch (error) {
        console.error(`Payment processing error for ${payment.schedule_id}:`, error);
        failed++;
      }
    }

    res.status(200).json({ processed, failed });
  } catch (error) {
    console.error('Cron error:', error);
    res.status(500).json({ error: error.message });
  }
}
