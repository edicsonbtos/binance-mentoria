# FASE 4: Conversión y Polish - Design Spec

## Overview
Improve landing page conversion with sticky CTA, scroll animations, animated counters, mobile polish, SEO tags, scroll-to-top, and loading skeleton.

## Files Modified
- `public/index.html` — Sticky CTA, scroll to top, SEO meta tags, skeleton loading markup
- `public/styles.css` — All CSS for animations, sticky CTA, scroll to top, mobile polish, skeleton

## Features

### 1. Sticky CTA Bar
- Fixed bottom bar visible when header scrolls out of view
- IntersectionObserver on header element
- Shows price + "Reservar cupo →" button
- Smooth scroll to #reserva on click
- Mobile: shorter text "Reservar — [precio] USDT"

### 2. Module Scroll Animations
- CSS: opacity 0→1, translateY 30px→0, 0.6s ease
- IntersectionObserver on .module elements, threshold 0.2
- Add .visible class when in viewport

### 3. Animated Counter
- animateValue(element, start, end, duration) function
- 1.5s duration, animates from 0 to final value
- Applied to 4 outcome-item numbers

### 4. Mobile Polish (≤600px)
- Form inputs: font-size 16px (prevents iOS zoom)
- Submit button: min-height 48px, min-width 120px
- Form field spacing: margin-bottom 20px
- Timeline: padding-left 20px, dot 10px

### 5. SEO Meta Tags
- description, og:title, og:description, og:type, og:url, twitter:card
- SVG favicon with lock emoji

### 6. Scroll to Top Button
- Fixed position, bottom 80px, right 20px
- Appears after 500px scroll
- Green gradient background, white arrow
- Smooth scroll to top on click

### 7. Loading Skeleton
- Shimmer animation (linear-gradient 200% background-size)
- Shows while /api/settings loads
- Replaces with real price on success

## Constraints
- Only modify index.html and styles.css (+ inline script)
- CSS animations + IntersectionObserver native
- No npm dependencies
- Do not touch server.js or admin.html
