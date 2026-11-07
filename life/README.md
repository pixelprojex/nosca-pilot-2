# Fionn's Life

A personal life-management web app: Today · Room · Wardrobe · Pack ·
School, as five tabs. Vite + React + Tailwind, a home-screen PWA. The
plan is at https://claude.ai/artifact/8MsFvtkvX7sVwRt182ukZW.

This folder sits inside the Nosca repository as a holding place only,
on a branch, until it has a repository of its own. Nothing in Nosca
imports it and Nosca's checks do not read it.

## What is built

- **Wardrobe** (`src/Wardrobe.jsx`): every item as a vector drawing,
  filter chips, search, an item sheet with "Wearing today", and the
  outfit board: tap a slot to choose, swipe across it to slide to the
  next of its kind, save, wear today.
- **Drawings** (`src/lib/garments.js`): templates for tops, trousers,
  shoes, caps, beanies, scarves, bags, watches, ties, belts, sunglasses
  and socks, with stripe, hoop, cable, waffle, argyle, check and puffer
  patterns. `renderGarment(item)` returns an SVG string.
- **Catalogue** (`src/lib/catalogue.js`): the 115 kinds of item (129
  with pairs and multiples) from the description of 7 Nov 2026, each
  with its drawing recipe. `ask` marks a guessed detail.
- **Store** (`src/lib/store.js`): outfits and wears in localStorage,
  behind one interface so Supabase can replace it without touching a
  screen.
- The other four tabs say "Not built yet" and what they will hold.

## Commands

    npm install
    npm run dev        # local
    npm run check      # undeclared names, bad JSX tags
    npm run build      # what Netlify runs
    npm run gallery    # writes gallery.html, every drawing on one page

## Deploy

A Netlify site with base directory `life`, build `npm run build`,
publish `dist` (netlify.toml carries the SPA redirect). Once the app has
its own repository, drop the base directory.
