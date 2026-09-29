export default async function handler(req,res){
  if(req.method!=='GET') return res.status(405).json({error:'Method not allowed'});
  res.setHeader('Cache-Control','no-store');
  return res.status(200).json({
    SUPABASE_URL:!!process.env.SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY:!!process.env.SUPABASE_SERVICE_ROLE_KEY,
    STRIPE_SECRET_KEY:!!process.env.STRIPE_SECRET_KEY,
    PUBLIC_SITE_URL:!!process.env.PUBLIC_SITE_URL,
    RESEND_API_KEY:!!process.env.RESEND_API_KEY,
    RESEND_FROM_EMAIL:!!process.env.RESEND_FROM_EMAIL,
    NEXT_PUBLIC_SUPABASE_URL:!!process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY:!!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    VITE_SUPABASE_URL:!!process.env.VITE_SUPABASE_URL,
    NEXT_PUBLIC_STRIPE_PUBLIC_KEY:!!process.env.NEXT_PUBLIC_STRIPE_PUBLIC_KEY,
    STRIPE_WEBHOOK_SECRET:!!process.env.STRIPE_WEBHOOK_SECRET,
    SENDGRID_API_KEY:!!process.env.SENDGRID_API_KEY
  });
}
