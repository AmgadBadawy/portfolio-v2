// QA screenshot modes
if (/[?&]shot/.test(location.search)) document.documentElement.classList.add("shot");
if (/[?&]flat/.test(location.search)) document.documentElement.classList.add("flat");
const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// Reveal on scroll
const io = new IntersectionObserver(
  (entries) => entries.forEach((e) => {
    if (e.isIntersecting) { e.target.classList.add("visible"); io.unobserve(e.target); }
  }),
  { threshold: 0.12, rootMargin: "0px 0px -40px 0px" }
);
document.querySelectorAll(".reveal").forEach((el) => io.observe(el));

// ---- ID badge pendulum (drag & swing) ----
(function badge() {
  const swing = document.getElementById("badgeSwing");
  if (!swing) return;
  let angle = 0.28, vel = 0;         // radians, rad/s
  let dragging = false, lastX = 0, lastT = 0;
  const G = 26, DAMP = 0.55;         // gravity gain + damping

  function setTransform(a, tilt) {
    const sway = Math.sin(a) * 14;   // horizontal offset illusion
    swing.style.transform = `translateX(calc(-50% + ${sway}px)) rotate(${a}rad)`;
    if (tilt !== undefined) swing.style.filter = `drop-shadow(0 ${18 + Math.abs(a) * 30}px 30px rgba(0,0,0,0.5))`;
  }

  function step(dt) {
    if (!dragging) {
      const acc = -G * Math.sin(angle) - DAMP * vel;
      vel += acc * dt;
      angle += vel * dt;
      if (Math.abs(angle) < 0.0008 && Math.abs(vel) < 0.002) { angle = 0; vel = 0; }
    }
    setTransform(angle, true);
  }

  function onDown(e) {
    dragging = true;
    lastX = e.clientX ?? (e.touches && e.touches[0].clientX);
    lastT = performance.now();
    vel = 0;
    swing.setPointerCapture && e.pointerId !== undefined && swing.setPointerCapture(e.pointerId);
  }
  function onMove(e) {
    if (!dragging) return;
    const x = e.clientX ?? (e.touches && e.touches[0].clientX);
    const now = performance.now();
    const rect = swing.getBoundingClientRect();
    const anchorX = rect.left + rect.width / 2;
    const dx = x - anchorX;
    const target = Math.max(-1.1, Math.min(1.1, dx / 220));
    const dt = Math.max((now - lastT) / 1000, 0.001);
    vel = (target - angle) / dt * 0.6;
    angle = target;
    lastT = now;
  }
  function onUp() { dragging = false; }

  swing.addEventListener("pointerdown", onDown);
  window.addEventListener("pointermove", onMove, { passive: true });
  window.addEventListener("pointerup", onUp);
  window.addEventListener("pointercancel", onUp);

  if (!reduced) {
    let prev = performance.now();
    (function loop(now) {
      const dt = Math.min((now - prev) / 1000, 0.05);
      prev = now;
      step(dt);
      requestAnimationFrame(loop);
    })(prev);
  } else {
    setTransform(0);
  }
})();

// ---- Physics chips (drag & throw) ----
(function chips() {
  const arena = document.getElementById("chipsArena");
  if (!arena) return;
  const items = Array.from(arena.querySelectorAll(".chip"));
  const state = [];

  function bounds() { return { w: arena.clientWidth, h: arena.clientHeight }; }

  function place() {
    const { w, h } = bounds();
    items.forEach((el, i) => {
      const px = (parseFloat(el.dataset.x) / 100) * (w - el.offsetWidth);
      const py = (parseFloat(el.dataset.y) / 100) * (h - el.offsetHeight);
      state[i] = state[i] || {};
      state[i].x = px; state[i].y = py;
      state[i].vx = state[i].vx || 0; state[i].vy = state[i].vy || 0;
      el.style.transform = `translate(${px}px, ${py}px)`;
    });
  }
  place();
  window.addEventListener("resize", place);

  let drag = null;
  items.forEach((el, i) => {
    el.addEventListener("pointerdown", (e) => {
      drag = { i, x: e.clientX, y: e.clientY, t: performance.now() };
      state[i].vx = 0; state[i].vy = 0;
      el.setPointerCapture && el.setPointerCapture(e.pointerId);
      e.preventDefault();
    });
  });
  window.addEventListener("pointermove", (e) => {
    if (!drag) return;
    const s = state[drag.i];
    const now = performance.now();
    const dt = Math.max((now - drag.t) / 1000, 0.001);
    s.vx = (e.clientX - drag.x) / dt * 0.9;
    s.vy = (e.clientY - drag.y) / dt * 0.9;
    s.x += e.clientX - drag.x;
    s.y += e.clientY - drag.y;
    drag.x = e.clientX; drag.y = e.clientY; drag.t = now;
  }, { passive: true });
  window.addEventListener("pointerup", () => { drag = null; });
  window.addEventListener("pointercancel", () => { drag = null; });

  if (!reduced) {
    let prev = performance.now();
    (function loop(now) {
      const dt = Math.min((now - prev) / 1000, 0.05);
      prev = now;
      const { w, h } = bounds();
      items.forEach((el, i) => {
        if (drag && drag.i === i) { el.style.transform = `translate(${state[i].x}px, ${state[i].y}px)`; return; }
        const s = state[i];
        if (Math.abs(s.vx) < 1 && Math.abs(s.vy) < 1) return;
        s.x += s.vx * dt; s.y += s.vy * dt;
        s.vx *= 0.965; s.vy *= 0.965;
        const ew = el.offsetWidth, eh = el.offsetHeight;
        if (s.x < 0) { s.x = 0; s.vx = -s.vx * 0.55; }
        if (s.x > w - ew) { s.x = w - ew; s.vx = -s.vx * 0.55; }
        if (s.y < 0) { s.y = 0; s.vy = -s.vy * 0.55; }
        if (s.y > h - eh) { s.y = h - eh; s.vy = -s.vy * 0.55; }
        el.style.transform = `translate(${s.x}px, ${s.y}px)`;
      });
      requestAnimationFrame(loop);
    })(prev);
  }
})();

// ---- Cursor + magnetic (fine pointers) ----
const fine = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
if (fine) {
  const dot = document.querySelector(".cursor");
  const ring = document.querySelector(".cursor-ring");
  let mx = -100, my = -100, rx = -100, ry = -100;
  window.addEventListener("mousemove", (e) => { mx = e.clientX; my = e.clientY; }, { passive: true });
  (function loop() {
    rx += (mx - rx) * 0.16; ry += (my - ry) * 0.16;
    dot.style.transform = `translate(${mx}px, ${my}px) translate(-50%,-50%)`;
    ring.style.transform = `translate(${rx}px, ${ry}px) translate(-50%,-50%)`;
    requestAnimationFrame(loop);
  })();
  document.querySelectorAll("a, button, .chip, .glass-card").forEach((el) => {
    el.addEventListener("mouseenter", () => ring.classList.add("hovering"));
    el.addEventListener("mouseleave", () => ring.classList.remove("hovering"));
  });
  document.querySelectorAll(".magnetic").forEach((el) => {
    el.addEventListener("mousemove", (e) => {
      const r = el.getBoundingClientRect();
      const x = e.clientX - r.left - r.width / 2;
      const y = e.clientY - r.top - r.height / 2;
      el.style.transform = `translate(${x * 0.16}px, ${y * 0.16}px)`;
    });
    el.addEventListener("mouseleave", () => { el.style.transform = ""; });
  });
}

// Nav shadow on scroll
const nav = document.getElementById("nav");
window.addEventListener("scroll", () => {
  nav.style.transform = window.scrollY > 30 ? "translateY(-4px)" : "";
}, { passive: true });
