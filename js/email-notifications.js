import { supabase } from './supabase-client.js'

// All emails route through the Supabase Edge Function "send-email"
// which calls SendGrid on the server side (keeps API key secret)

async function callEmailFunction(templateType, data) {
  const { data: result, error } = await supabase.functions.invoke('send-email', {
    body: { templateType, ...data }
  })

  if (error) {
    console.error('Email send error:', error)
    throw new Error(error.message)
  }

  return result
}

// ==========================================
// EMAIL TEMPLATES
// ==========================================

// Booking confirmation after deposit
export async function sendBookingConfirmation(booking, trip, user) {
  return callEmailFunction('bookingConfirmation', {
    to: user.email,
    userName: user.first_name,
    tripTitle: trip.title,
    tripDates: `${trip.dates_start} – ${trip.dates_end}`,
    tripLocation: trip.location,
    depositAmount: (booking.deposit_amount / 100).toFixed(2),
    totalAmount: (booking.total_amount / 100).toFixed(2),
    balanceDue: (booking.balance_due / 100).toFixed(2),
    bookingId: booking.booking_id
  })
}

// Payment reminder (upcoming)
export async function sendPaymentReminder(booking, trip, user, nextPayment) {
  return callEmailFunction('paymentReminder', {
    to: user.email,
    userName: user.first_name,
    tripTitle: trip.title,
    amountDue: (nextPayment.amount_due / 100).toFixed(2),
    dueDate: nextPayment.due_date,
    balanceRemaining: (booking.balance_due / 100).toFixed(2),
    bookingId: booking.booking_id
  })
}

// Payment successful
export async function sendPaymentSuccess(booking, trip, user, amount) {
  return callEmailFunction('paymentSuccess', {
    to: user.email,
    userName: user.first_name,
    tripTitle: trip.title,
    amountPaid: (amount / 100).toFixed(2),
    totalPaid: (booking.amount_paid / 100).toFixed(2),
    balanceDue: (booking.balance_due / 100).toFixed(2),
    bookingId: booking.booking_id
  })
}

// Payment failed
export async function sendPaymentFailed(booking, trip, user, errorMsg) {
  return callEmailFunction('paymentFailed', {
    to: user.email,
    userName: user.first_name,
    tripTitle: trip.title,
    errorMessage: errorMsg,
    bookingId: booking.booking_id
  })
}

// Final warning — balance due soon
export async function sendFinalWarning(booking, trip, user) {
  return callEmailFunction('finalWarning', {
    to: user.email,
    userName: user.first_name,
    tripTitle: trip.title,
    balanceDue: (booking.balance_due / 100).toFixed(2),
    finalDeadline: booking.final_payment_deadline,
    bookingId: booking.booking_id
  })
}

// Spin wheel discount code delivery
export async function sendDiscountCode(name, email, prize, code, expiresAt) {
  return callEmailFunction('discountCode', {
    to: email,
    userName: name,
    prize: prize,
    code: code,
    expiresAt: expiresAt
  })
}

// Welcome email after signup
export async function sendWelcomeEmail(email, firstName) {
  return callEmailFunction('welcome', {
    to: email,
    userName: firstName
  })
}
