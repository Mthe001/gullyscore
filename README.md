# GullyScore Pro Setup Guide

GullyScore Pro is a mobile-first, real-time cricket scoring application.

## 🚀 Getting Started

### 1. Prerequisites
- Node.js 18+
- Supabase Account

### 2. Setup Supabase
1. Create a new project in [Supabase](https://supabase.com).
2. Go to **SQL Editor** and paste the contents of `database_schema.sql` (found in the project root).
3. Run `supabase-storage.sql` to create the public `avatars` and `team-logos` buckets plus upload policies.
4. If your project was already created before the latest admin fixes, run `supabase-admin-policies.sql` to enable admin/moderator inserts and updates for matches, tournaments, innings, balls, and stats.
5. Go to **Project Settings > API** and get your `URL` and `anon public` key.
6. Enable **Email Auth** in Authentication > Providers (or use dummy credentials for testing).

### 3. Environment Variables
Create a `.env.local` file in the root with:
```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### 4. Install & Run
```bash
npm install
npm run dev
```

## 📱 PWA Support
GullyScore Pro is a Progressive Web App. 
- **Desktop**: Click the install icon in the address bar.
- **Mobile**: Open the site in Chrome/Safari and select "Add to Home Screen".

## 🏆 Roles
- **Client**: View scores and leaderboards.
- **Moderator**: Can score live matches.
- **Admin**: All features + user/tournament management.

*To make yourself an admin, manually change your role in the `public.users` table in Supabase.*

## Profile Pictures
- Users can upload profile pictures from `/profile`.
- Uploads are stored in the Supabase Storage bucket `avatars`.
- Allowed formats: `png`, `jpeg`, `webp`, `gif`
- Max size: `2MB`

## Team Logos
- Admins can upload team logos from `/admin/teams/new`.
- Uploads are stored in the Supabase Storage bucket `team-logos`.
- Allowed formats: `png`, `jpeg`, `webp`
- Max size: `2MB`

## 🏏 Scoring Rules
- **Wide**: 1 run added to team score, ball not counted.
- **No Ball**: runs added (0, 4, 6), ball not counted.
- **Wicket**: Ball counted, strike rotatable depending on type.
- **Strike Rotation**: Automatic on odd runs and end of over.
