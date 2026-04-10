// email-notifications.js
// Function to trigger email notifications via Supabase Functions using SendGrid or similar service.
async function sendPaymentReminder(bookingId) {
    const response = await fetch(`https://lqdflvnkiskzmvvknmmh.supabase.co/functions/v1/sendPaymentReminder`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ bookingId }),
    });
    return response.json();
}
async function sendPaymentSuccessful(bookingId) {
    const response = await fetch(`https://lqdflvnkiskzmvvknmmh.supabase.co/functions/v1/sendPaymentSuccessful`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ bookingId }),
    });
    return response.json();
}
async function sendPaymentFailed(bookingId) {
    const response = await fetch(`https://lqdflvnkiskzmvvknmmh.supabase.co/functions/v1/sendPaymentFailed`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ bookingId }),
    });
    return response.json();
}
async function sendFinalWarning(bookingId) {
    const response = await fetch(`https://lqdflvnkiskzmvvknmmh.supabase.co/functions/v1/sendFinalWarning`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ bookingId }),
    });
    return response.json();
}
async function sendBookingCancelled(bookingId) {
    const response = await fetch(`https://lqdflvnkiskzmvvknmmh.supabase.co/functions/v1/sendBookingCancelled`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ bookingId }),
    });
    return response.json();
}
// Exporting functions for use in other modules
export {
    sendPaymentReminder,
    sendPaymentSuccessful,
    sendPaymentFailed,
    sendFinalWarning,
    sendBookingCancelled,
};
