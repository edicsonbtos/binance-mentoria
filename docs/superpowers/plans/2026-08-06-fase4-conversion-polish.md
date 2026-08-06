# FASE 4: Conversión y Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Improve landing page conversion with sticky CTA, scroll animations, animated counters, mobile polish, SEO tags, scroll-to-top, and loading skeleton

**Architecture:** CSS animations + IntersectionObserver native, no frameworks

**Tech Stack:** HTML, CSS, vanilla JS

## Global Constraints

- Only modify `index.html` and `styles.css` (+ inline script)
- CSS animations + IntersectionObserver native
- No npm dependencies
- Do not touch `server.js` or `admin.html`

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `public/index.html` | Modify | SEO meta tags, sticky CTA, scroll to top, skeleton markup |
| `public/styles.css` | Modify | All new CSS for animations, sticky CTA, scroll to top, skeleton, mobile polish |

---

### Task 1: SEO Meta Tags + Favicon

**Files:**
- Modify: `public/index.html:1-14` (head section)

**Interfaces:**
- Consumes: None
- Produces: Updated meta tags in head

- [ ] **Step 1: Replace meta tags in head**

Replace the existing meta tags (lines 6-11) with:

```html
<meta name="description" content="Mentoría Binance Venezuela: aprende a resguardar tu dinero, recibir remesas sin comisiones y operar con seguridad real en 4 sesiones en vivo.">
<meta property="og:title" content="Mentoría Binance Venezuela — De los Bolívares a la Soberanía Digital">
<meta property="og:description" content="4 sesiones en vivo. Máximo 3 personas. Seguridad real, no teoría.">
<meta property="og:type" content="website">
<meta property="og:url" content="https://binance-mentoria-production.up.railway.app">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>🔒</text></svg>">
```

- [ ] **Step 2: Commit**

```bash
git add public/index.html
git commit -m "feat: SEO meta tags and favicon"
```

---

### Task 2: Sticky CTA Bar + Scroll to Top HTML

**Files:**
- Modify: `public/index.html` (add before closing body tag)

**Interfaces:**
- Consumes: None
- Produces: `.sticky-cta` and `.scroll-top` elements

- [ ] **Step 1: Add sticky CTA and scroll to top before closing body**

Add before `</body>` tag:

```html
<div class="sticky-cta" id="stickyCta">
  <span class="sticky-cta-text">Mentoría Binance Venezuela — <span id="stickyPrice">150</span> USDT</span>
  <button class="sticky-cta-btn" onclick="document.getElementById('reserva').scrollIntoView({behavior:'smooth'})">Reservar cupo →</button>
</div>

<button class="scroll-top" id="scrollTop" onclick="window.scrollTo({top:0,behavior:'smooth'})">↑</button>
```

- [ ] **Step 2: Commit**

```bash
git add public/index.html
git commit -m "feat: sticky CTA bar and scroll to top HTML"
```

---

### Task 3: Loading Skeleton for Price

**Files:**
- Modify: `public/index.html` (modify pricing section)

**Interfaces:**
- Consumes: None
- Produces: `.skeleton` element in price area

- [ ] **Step 1: Add skeleton to price section**

Find the price div (around line 154-156) and replace:

```html
<div class="price">
  <span class="price-currency">USDT</span><span id="priceValue"><span class="skeleton skeleton-text"></span></span>
</div>
```

- [ ] **Step 2: Commit**

```bash
git add public/index.html
git commit -m "feat: loading skeleton for price"
```

---

### Task 4: Module Animation Classes

**Files:**
- Modify: `public/index.html` (add class to each .module)

**Interfaces:**
- Consumes: None
- Produces: `.module-animate` class on all modules

- [ ] **Step 1: Add module-animate class to all .module divs**

Find all `<div class="module">` and change to `<div class="module module-animate">`:

```html
<div class="module module-animate">
```

There are 5 modules (lines 45, 61, 78, 94, 110).

- [ ] **Step 2: Commit**

```bash
git add public/index.html
git commit -m "feat: module animation classes"
```

---

### Task 5: All CSS for New Features

**Files:**
- Modify: `public/styles.css` (add before @media query)

**Interfaces:**
- Consumes: None
- Produces: All new CSS rules

- [ ] **Step 1: Add sticky CTA CSS**

Add before the `@media` query:

```css
/* Sticky CTA Bar */
.sticky-cta {
  position: fixed;
  bottom: 0;
  left: 0;
  width: 100%;
  background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
  border-top: 1px solid rgba(0, 208, 132, 0.3);
  padding: 12px 24px;
  z-index: 100;
  display: flex;
  justify-content: space-between;
  align-items: center;
  transform: translateY(100%);
  opacity: 0;
  transition: transform 0.3s ease, opacity 0.3s ease;
}

.sticky-cta.visible {
  transform: translateY(0);
  opacity: 1;
}

.sticky-cta-text {
  font-size: 14px;
  font-weight: 600;
  color: #e2e8f0;
}

.sticky-cta-btn {
  background: linear-gradient(135deg, #00d084, #00b4d8);
  color: #0a0e17;
  border: none;
  padding: 10px 20px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.3s ease;
}

.sticky-cta-btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(0, 208, 132, 0.3);
}
```

- [ ] **Step 2: Add module animation CSS**

```css
/* Module Animations */
.module-animate {
  opacity: 0;
  transform: translateY(30px);
  transition: opacity 0.6s ease, transform 0.6s ease;
}

.module-animate.visible {
  opacity: 1;
  transform: translateY(0);
}
```

- [ ] **Step 3: Add scroll to top CSS**

```css
/* Scroll to Top */
.scroll-top {
  position: fixed;
  bottom: 80px;
  right: 20px;
  width: 48px;
  height: 48px;
  background: linear-gradient(135deg, #00d084, #00b4d8);
  color: #fff;
  border: none;
  border-radius: 50%;
  font-size: 20px;
  font-weight: 700;
  cursor: pointer;
  z-index: 99;
  opacity: 0;
  transform: translateY(20px);
  transition: opacity 0.3s ease, transform 0.3s ease;
  display: flex;
  align-items: center;
  justify-content: center;
}

.scroll-top.visible {
  opacity: 1;
  transform: translateY(0);
}

.scroll-top:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 208, 132, 0.3);
}
```

- [ ] **Step 4: Add skeleton CSS**

```css
/* Loading Skeleton */
.skeleton {
  background: linear-gradient(90deg, #1e293b 25%, #334155 50%, #1e293b 75%);
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
  border-radius: 8px;
  display: inline-block;
}

.skeleton-text {
  width: 80px;
  height: 40px;
}

@keyframes shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}
```

- [ ] **Step 5: Add mobile polish CSS**

```css
/* Mobile Polish */
@media (max-width: 600px) {
  .sticky-cta-text { display: none; }
  .sticky-cta::before {
    content: 'Reservar — 150 USDT';
    font-size: 14px;
    font-weight: 600;
    color: #e2e8f0;
  }
  
  .form-group input {
    font-size: 16px;
  }
  
  .submit-btn {
    min-height: 48px;
    min-width: 120px;
  }
  
  .form-group {
    margin-bottom: 20px;
  }
  
  .timeline {
    padding-left: 20px;
  }
  
  .module::before {
    left: -16px;
    width: 10px;
    height: 10px;
  }
}
```

- [ ] **Step 6: Commit**

```bash
git add public/styles.css
git commit -m "feat: CSS for sticky CTA, animations, scroll to top, skeleton, mobile polish"
```

---

### Task 6: JavaScript for All Features

**Files:**
- Modify: `public/index.html` (add inline script before closing body)

**Interfaces:**
- Consumes: All HTML elements from previous tasks
- Produces: IntersectionObservers, animateValue function, skeleton loading

- [ ] **Step 1: Add inline script before closing body**

Add after the sticky CTA and scroll to top HTML:

```html
<script>
(function() {
  // === Animate Value Function ===
  function animateValue(element, start, end, duration) {
    const startTime = performance.now();
    function update(currentTime) {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const easeOut = 1 - Math.pow(1 - progress, 3);
      const current = Math.floor(start + (end - start) * easeOut);
      element.textContent = current;
      if (progress < 1) {
        requestAnimationFrame(update);
      }
    }
    requestAnimationFrame(update);
  }

  // === Sticky CTA & Scroll to Top ===
  const header = document.querySelector('.header');
  const stickyCta = document.getElementById('stickyCta');
  const scrollTop = document.getElementById('scrollTop');

  const stickyObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) {
        stickyCta.classList.add('visible');
      } else {
        stickyCta.classList.remove('visible');
      }
    });
  }, { threshold: 0 });

  stickyObserver.observe(header);

  // Scroll to top visibility
  window.addEventListener('scroll', () => {
    if (window.scrollY > 500) {
      scrollTop.classList.add('visible');
    } else {
      scrollTop.classList.remove('visible');
    }
  });

  // === Module Animations ===
  const modules = document.querySelectorAll('.module-animate');
  const moduleObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
      }
    });
  }, { threshold: 0.2 });

  modules.forEach(module => moduleObserver.observe(module));

  // === Loading Skeleton ===
  const priceEl = document.getElementById('priceValue');
  const stickyPriceEl = document.getElementById('stickyPrice');

  fetch('/api/settings')
    .then(res => res.json())
    .then(settings => {
      const price = settings.precio || '150';
      priceEl.textContent = price;
      if (stickyPriceEl) stickyPriceEl.textContent = price;
      const badge = document.querySelector('.badge');
      if (badge && settings.badge) badge.textContent = settings.badge;
    })
    .catch(() => {
      priceEl.textContent = '150';
    });
})();
</script>
```

- [ ] **Step 2: Commit**

```bash
git add public/index.html
git commit -m "feat: JavaScript for animations, sticky CTA, skeleton loading"
```

---

### Task 7: Deploy & Verify

**Files:**
- None (deployment only)

**Interfaces:**
- Consumes: All previous tasks
- Produces: Working production deployment

- [ ] **Step 1: Push to GitHub**

```bash
git push
```

- [ ] **Step 2: Deploy to Railway**

```bash
railway up
```

- [ ] **Step 3: Wait for deployment**

```bash
Start-Sleep -Seconds 90
```

- [ ] **Step 4: Verify deployment**

```bash
# Check health
curl.exe -s https://binance-mentoria-production.up.railway.app/api/health

# Check settings (for skeleton loading)
curl.exe -s https://binance-mentoria-production.up.railway.app/api/settings
```

- [ ] **Step 5: Final commit**

```bash
git add .
git commit -m "feat: FASE 4 complete - conversion and polish"
```
