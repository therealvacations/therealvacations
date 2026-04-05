// email-notifications.js

// Function to trigger email notifications via Supabase Functions using SendGrid or similar service.

async function sendPaymentReminder(bookingId) {
    const response = await fetch(`https://your-supabase-url.com/functions/sendPaymentReminder`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ bookingId }),
    });
    return response.json();
}

async function sendPaymentSuccessful(bookingId) {
    const response = await fetch(`https://your-supabase-url.com/functions/sendPaymentSuccessful`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ bookingId }),
    });
    return response.json();
}

async function sendPaymentFailed(bookingId) {
    const response = await fetch(`https://your-supabase-url.com/functions/sendPaymentFailed`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ bookingId }),
    });
    return response.json();
}

async function sendFinalWarning(bookingId) {
    const response = await fetch(`https://your-supabase-url.com/functions/sendFinalWarning`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ bookingId }),
    });
    return response.json();
}

async function sendBookingCancelled(bookingId) {
    const response = await fetch(`https://your-supabase-url.com/functions/sendBookingCancelled`, {
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