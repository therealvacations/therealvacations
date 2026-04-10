import { supabase } from './supabase-client.js';

export async function createPaymentSchedule(bookingId, totalAmount, depositAmount, numberOfPayments) {
  const paymentAmount = (totalAmount - depositAmount) / numberOfPayments;
  const startDate = new Date();
  
  const schedules = [];
  for (let i = 0; i < numberOfPayments; i++) {
    const dueDate = new Date(startDate);
    dueDate.setMonth(dueDate.getMonth() + (i + 1));
    
    schedules.push({
      booking_id: bookingId,
      payment_number: i + 1,
      amount_due: paymentAmount,
      auto_charge_date: dueDate.toISOString().split('T')[0],
      status: 'pending'
    });
  }

  const { data, error } = await supabase
    .from('payment_schedule')
    .insert(schedules);

  if (error) throw error;
  return data;
}

export async function getPaymentSchedule(bookingId) {
  const { data, error } = await supabase
    .from('payment_schedule')
    .select('*')
    .eq('booking_id', bookingId)
    .order('payment_number', { ascending: true });

  if (error) throw error;
  return data;
}

export async function updatePaymentStatus(scheduleId, status) {
  const { data, error } = await supabase
    .from('payment_schedule')
    .update({ status })
    .eq('schedule_id', scheduleId);

  if (error) throw error;
  return data;
}
