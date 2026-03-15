# 21 – Kartenspiel

Online Multiplayer Kartenspiel, gebaut mit Next.js + Supabase.

## 🚀 Setup in 5 Minuten

### 1. Supabase einrichten
1. Gehe zu [supabase.com](https://supabase.com) → Dein Projekt
2. Klicke auf **SQL Editor** → **New Query**
3. Füge den Inhalt von `SUPABASE_SETUP.sql` ein und klicke **Run**

### 2. Environment Variables
1. Kopiere `.env.local.example` → `.env.local`
2. Fülle deine Supabase-Daten ein:
   - **URL**: Supabase → Settings → API → Project URL
   - **Anon Key**: Supabase → Settings → API → anon public

### 3. Vercel deployen
1. Lade diesen Ordner auf GitHub hoch
2. Gehe zu [vercel.com](https://vercel.com) → **New Project** → GitHub Repo wählen
3. Unter **Environment Variables** füge hinzu:
   - `NEXT_PUBLIC_SUPABASE_URL` = deine URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = dein Anon Key
4. Klicke **Deploy** → Fertig! 🎉

## 🎮 Spielregeln
- 4 Karten pro Spieler + 4 auf dem Tisch
- 11er-Kombinationen (z.B. 2+9, 3+8, 5+6, 7+4...)
- Bube nimmt alle Nicht-Bildkarten vom Tisch
- Dame nimmt eine Dame, König einen König
- Punkte: Meiste Karten (2Pkt), Meiste ♣ (1), 2♣ (1), 10♦ (1)
- Gewinner: Erster mit 21 Punkten

## Entwickelt von Omran & Nyaz
