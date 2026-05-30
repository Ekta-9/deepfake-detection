(function () {
    const canvas = document.getElementById('neural-bg');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');

    // ── Config ────────────────────────────────────────────────────────
    const NUM_NODES   = 70;
    const MAX_DIST    = 180;
    const NODE_SPEED  = 0.35;
    const NODE_RADIUS = 2.2;

    // Dim white palette
    const C_NODE_BRIGHT = 'rgba(255, 255, 255,';  // white core
    const C_NODE_MID    = 'rgba(220, 220, 220,';  // soft white
    const C_LINE        = 'rgba(200, 200, 200,';  // dim white line
    const C_PULSE       = 'rgba(255, 255, 255,';  // white flash

    // ── Resize ────────────────────────────────────────────────────────
    function resize() {
        canvas.width  = window.innerWidth;
        canvas.height = window.innerHeight;
    }
    resize();
    window.addEventListener('resize', resize);

    // ── Node factory ─────────────────────────────────────────────────
    function makeNode() {
        const angle = Math.random() * Math.PI * 2;
        const speed = NODE_SPEED * (0.4 + Math.random() * 0.6);
        return {
            x:       Math.random() * canvas.width,
            y:       Math.random() * canvas.height,
            vx:      Math.cos(angle) * speed,
            vy:      Math.sin(angle) * speed,
            r:       NODE_RADIUS * (0.6 + Math.random() * 0.8),
            // pulse state
            pulse:   Math.random() * Math.PI * 2,
            pulseSpeed: 0.012 + Math.random() * 0.018,
            // occasional bright flash
            bright:  Math.random() > 0.85,
        };
    }

    const nodes = Array.from({ length: NUM_NODES }, makeNode);

    // ── Mouse interaction ─────────────────────────────────────────────
    let mouse = { x: -999, y: -999 };
    window.addEventListener('mousemove', e => {
        mouse.x = e.clientX;
        mouse.y = e.clientY;
    });

    // ── Draw ──────────────────────────────────────────────────────────
    function draw() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Update nodes
        for (const n of nodes) {
            n.x += n.vx;
            n.y += n.vy;
            n.pulse += n.pulseSpeed;

            // Soft bounce
            if (n.x < 0)             { n.x = 0;             n.vx *= -1; }
            if (n.x > canvas.width)  { n.x = canvas.width;  n.vx *= -1; }
            if (n.y < 0)             { n.y = 0;             n.vy *= -1; }
            if (n.y > canvas.height) { n.y = canvas.height; n.vy *= -1; }

            // Slight mouse repulsion
            const dx = n.x - mouse.x;
            const dy = n.y - mouse.y;
            const md = Math.sqrt(dx * dx + dy * dy);
            if (md < 120) {
                n.vx += (dx / md) * 0.06;
                n.vy += (dy / md) * 0.06;
            }

            // Speed cap
            const spd = Math.sqrt(n.vx * n.vx + n.vy * n.vy);
            if (spd > NODE_SPEED * 1.8) {
                n.vx = (n.vx / spd) * NODE_SPEED * 1.8;
                n.vy = (n.vy / spd) * NODE_SPEED * 1.8;
            }
        }

        // Draw connections
        for (let i = 0; i < nodes.length; i++) {
            for (let j = i + 1; j < nodes.length; j++) {
                const a = nodes[i], b = nodes[j];
                const dx = a.x - b.x;
                const dy = a.y - b.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist >= MAX_DIST) continue;

                const alpha = (1 - dist / MAX_DIST) * 0.12;
                ctx.beginPath();
                ctx.moveTo(a.x, a.y);
                ctx.lineTo(b.x, b.y);
                ctx.strokeStyle = `${C_LINE} ${alpha})`;
                ctx.lineWidth = 0.8;
                ctx.stroke();
            }
        }

        // Draw nodes
        for (const n of nodes) {
            const pulse = (Math.sin(n.pulse) + 1) / 2;   // 0→1
            const glow  = n.r * (2 + pulse * 3);
            const alpha = 0.18 + pulse * 0.15;

            // Outer glow
            const grad = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, glow);
            grad.addColorStop(0,   `${n.bright ? C_PULSE : C_NODE_BRIGHT} ${alpha * 0.6})`);
            grad.addColorStop(0.4, `${C_NODE_MID} ${alpha * 0.25})`);
            grad.addColorStop(1,   `${C_NODE_MID} 0)`);
            ctx.beginPath();
            ctx.arc(n.x, n.y, glow, 0, Math.PI * 2);
            ctx.fillStyle = grad;
            ctx.fill();

            // Core dot
            ctx.beginPath();
            ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
            ctx.fillStyle = `${n.bright ? C_PULSE : C_NODE_BRIGHT} ${alpha})`;
            ctx.fill();
        }

        requestAnimationFrame(draw);
    }

    draw();
})();
