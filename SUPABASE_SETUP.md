# 🔐 Supabase Setup Guide

## Overview
Your admin login now uses **environment variables** instead of hardcoded credentials. This is much more secure!

## Step 1: Get New Supabase Credentials

Since your old credentials were exposed in the GitHub repo, you need new ones:

1. Go to [Supabase Dashboard](https://app.supabase.com)
2. Select your project
3. Click **Settings** → **API**
4. Copy:
   - **Project URL** (looks like: `https://your-project.supabase.co`)
   - **Anon Key** (the public key under "Project API keys")

## Step 2: Add to Vercel (Production)

1. Go to [Vercel Dashboard](https://vercel.com)
2. Select your **therealvacations** project
3. Click **Settings** → **Environment Variables**
4. Add two new variables:
   - **Name:** `VITE_SUPABASE_URL` → **Value:** Your Project URL
   - **Name:** `VITE_SUPABASE_ANON_KEY` → **Value:** Your Anon Key
5. Click "Save"
6. **Go to Deployments** and click the three dots on the latest deployment → **Redeploy**

Your login will work immediately after redeploy! 🎯

## Step 3: Local Testing (Optional)

For testing locally:

1. Create a `.env.local` file in your project root
2. Add your credentials:
   ```
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key-here
   ```
3. Never commit this file (it's in `.gitignore`)

## Security Checklist

- ✅ Old credentials removed from code
- ✅ Environment variables configured in Vercel
- ✅ `.env.local` ignored by git
- ✅ New Supabase credentials generated
- ⚠️ **TODO:** Regenerate Supabase API keys to invalidate old exposed ones

## Troubleshooting

**Login still not working?**
- Check that environment variables are set in Vercel
- Verify you redeployed after adding the variables
- Check browser console for error messages
- Make sure your Supabase project URL and key are correct

**"Configuration error" message?**
- The environment variables aren't being injected
- Redeploy your Vercel project to refresh

**Still seeing credential errors?**
- Clear your browser cache and try again
- Check that you copied the full Anon Key (it's quite long)

Need help? Check your Vercel deployment logs for more details!
