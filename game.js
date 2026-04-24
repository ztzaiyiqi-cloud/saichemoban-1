const CW = 360, CH = 600, BH = 28, BASE_W = 200, FIXED_MOVING_Y = 210;

const PALETTE = [
    '#FF6B6B', '#FF8E53', '#FFD166', '#06D6A0',
    '#118AB2', '#7B2FBE', '#FF6B9D', '#4ECDC4'
];

function lerp(a, b, t) { return a + (b - a) * t; }

function lighten(hex, amount) {
    const n = parseInt(hex.replace('#', ''), 16);
    const r = Math.min(255, (n >> 16) + amount);
    const g = Math.min(255, ((n >> 8) & 0xff) + amount);
    const b = Math.min(255, (n & 0xff) + amount);
    return `rgb(${r},${g},${b})`;
}

function roundRect(ctx, x, y, w, h, r) {
    if (w < 2 * r) r = w / 2;
    if (h < 2 * r) r = h / 2;
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
}

class StackGame {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx    = this.canvas.getContext('2d');
        this.canvas.width  = CW;
        this.canvas.height = CH;
        this.highScore = parseInt(localStorage.getItem('stackHS') || '0', 10);
        this.state     = 'start';
        this.stack     = [];
        this.moving    = null;
        this.fallers   = [];
        this.particles = [];
        this.scroll       = 0;
        this.scrollTarget = 0;
        this.score = 0;
        this.combo = 0;
        this._scaleCanvas();
        window.addEventListener('resize', () => this._scaleCanvas());
        this._bindEvents();
        requestAnimationFrame(() => this._loop());
    }

    _scaleCanvas() {
        const maxW = Math.min(window.innerWidth  - 20, CW);
        const maxH = Math.min(window.innerHeight - 100, CH);
        const ratio = Math.min(maxW / CW, maxH / CH);
        this.canvas.style.width  = (CW * ratio) + 'px';
        this.canvas.style.height = (CH * ratio) + 'px';
    }

    _startGame() {
        this.score = 0; this.combo = 0;
        this.scroll = 0; this.scrollTarget = 0;
        this.stack = [{ x: (CW - BASE_W) / 2, w: BASE_W, c: PALETTE[0] }];
        this.fallers = []; this.particles = [];
        this._spawnMoving();
        this.state = 'playing';
    }

    _spawnMoving() {
        const top = this.stack[this.stack.length - 1];
        const c = PALETTE[this.stack.length % PALETTE.length];
        const fromLeft = (this.stack.length % 2 === 1);
        this.moving = { x: fromLeft ? 0 : CW - top.w, w: top.w, dir: fromLeft ? 1 : -1, c };
    }

    _place() {
        if (this.state !== 'playing' || !this.moving) return;
        const top = this.stack[this.stack.length - 1];
        const m = this.moving;
        const l = Math.max(m.x, top.x), r = Math.min(m.x + m.w, top.x + top.w);
        const ov = r - l;
        if (ov <= 0) { this._gameOver(); return; }
        const isPerfect = Math.abs(ov - top.w) <= 4;
        const sy = this._movingY();
        if (!isPerfect) {
            if (m.x < l) this.fallers.push({ x: m.x, y: sy, w: l - m.x, vy: -0.5, rot: 0, rv: (Math.random() - 0.5) * 0.09, c: m.c });
            if (m.x + m.w > r) this.fallers.push({ x: r, y: sy, w: (m.x + m.w) - r, vy: -0.5, rot: 0, rv: (Math.random() - 0.5) * 0.09, c: m.c });
            this.combo = 0;
        } else { this.combo++; this._burst(l + ov / 2, sy + BH / 2); }
        this.stack.push({ x: isPerfect ? top.x : l, w: isPerfect ? top.w : ov, c: m.c });
        this.score++;
        this.scrollTarget = Math.max(0, CH - (this.stack.length + 1) * BH - FIXED_MOVING_Y);
        this._spawnMoving();
    }

    _gameOver() {
        this.state = 'over';
        if (this.score > this.highScore) { this.highScore = this.score; localStorage.setItem('stackHS', this.highScore); }
        const m = this.moving;
        if (m) this.fallers.push({ x: m.x, y: this._movingY(), w: m.w, vy: 0, rot: 0, rv: 0.06, c: m.c });
        this.moving = null;
    }

    _burst(cx, cy) {
        for (let i = 0; i < 22; i++) {
            const angle = Math.random() * Math.PI * 2, speed = 1.5 + Math.random() * 5;
            this.particles.push({ x: cx, y: cy, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed - 2.5, life: 1, c: PALETTE[Math.floor(Math.random() * PALETTE.length)], r: 2 + Math.random() * 3 });
        }
    }

    _blockY(i) { return CH - (i + 1) * BH - this.scroll; }
    _movingY()  { return this._blockY(this.stack.length); }
    _speed()    { return Math.min(1.8 + this.score * 0.22, 8); }

    _update() {
        if (this.state === 'playing' && this.moving) {
            const m = this.moving, sp = this._speed();
            m.x += m.dir * sp;
            if (m.x + m.w > CW) { m.dir = -1; m.x = CW - m.w; }
            else if (m.x < 0)   { m.dir =  1; m.x = 0; }
        }
        for (const f of this.fallers) { f.vy += 0.55; f.y += f.vy; f.rot += f.rv; }
        this.fallers = this.fallers.filter(f => f.y < CH + 120);
        for (const p of this.particles) { p.x += p.vx; p.y += p.vy; p.vy += 0.13; p.life -= 0.022; }
        this.particles = this.particles.filter(p => p.life > 0);
        this.scroll += (this.scrollTarget - this.scroll) * 0.13;
    }
      _render() {
        const ctx = this.ctx;
        const prog = Math.min(this.score / 45, 1);
        const bg = ctx.createLinearGradient(0, 0, 0, CH);
        bg.addColorStop(0, `hsl(${lerp(215,260,prog)},${lerp(65,80,prog)}%,${lerp(22,8,prog)}%)`);
        bg.addColorStop(1, `hsl(${lerp(200,250,prog)},${lerp(55,70,prog)}%,${lerp(42,18,prog)}%)`);
        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, CW, CH);
        for (let i = 0; i < this.stack.length; i++) {
            const sy = this._blockY(i);
            if (sy > CH + BH || sy < -BH) continue;
            const b = this.stack[i];
            this._drawBlock(b.x, sy, b.w, b.c);
        }
        if (this.moving) this._drawBlock(this.moving.x, this._movingY(), this.moving.w, this.moving.c);
        for (const f of this.fallers) {
            ctx.save();
            ctx.translate(f.x + f.w / 2, f.y + BH / 2);
            ctx.rotate(f.rot);
            this._drawBlock(-f.w / 2, -BH / 2, f.w, f.c);
            ctx.restore();
        }
        for (const p of this.particles) {
            ctx.save(); ctx.globalAlpha = p.life;
            ctx.fillStyle = p.c;
            ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
            ctx.restore();
        }
        if (this.state === 'playing') {
            ctx.save(); ctx.textAlign = 'center';
            ctx.fillStyle = 'rgba(255,255,255,0.92)'; ctx.font = 'bold 56px Arial';
            ctx.shadowBlur = 16; ctx.shadowColor = 'rgba(0,0,0,0.45)';
            ctx.fillText(this.score, CW / 2, 92);
            if (this.combo > 1) {
                ctx.font = 'bold 20px Arial'; ctx.fillStyle = '#FFD166';
                ctx.shadowColor = 'rgba(255,209,102,0.6)';
                ctx.fillText(`完美 ×${this.combo}`, CW / 2, 124);
            }
            ctx.restore();
        }
        if (this.state === 'start') this._drawStart();
        if (this.state === 'over')  this._drawOver();
    }

    _drawBlock(x, y, w, c) {
        const ctx = this.ctx; ctx.save();
        ctx.shadowColor = 'rgba(0,0,0,0.28)'; ctx.shadowBlur = 8; ctx.shadowOffsetY = 5;
        const grad = ctx.createLinearGradient(x, y, x, y + BH);
        grad.addColorStop(0, lighten(c, 35)); grad.addColorStop(1, c);
        ctx.fillStyle = grad;
        roundRect(ctx, x + 2, y + 2, w - 4, BH - 4, 5); ctx.fill();
        ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
        ctx.fillStyle = 'rgba(255,255,255,0.2)';
        roundRect(ctx, x + 2, y + 2, w - 4, (BH - 4) * 0.42, 5); ctx.fill();
        ctx.restore();
    }

    _drawStart() {
        const ctx = this.ctx;
        ctx.fillStyle = 'rgba(0,0,0,0.48)'; ctx.fillRect(0, 0, CW, CH);
        ctx.save(); ctx.textAlign = 'center';
        ctx.font = 'bold 66px Arial'; ctx.fillStyle = '#FFD166';
        ctx.shadowBlur = 24; ctx.shadowColor = 'rgba(255,209,102,0.55)';
        ctx.fillText('叠叠乐', CW / 2, CH / 2 - 88); ctx.shadowBlur = 0;
        ctx.font = '18px Arial'; ctx.fillStyle = 'rgba(255,255,255,0.82)';
        ctx.fillText('点击屏幕 / 空格键 放置方块', CW / 2, CH / 2 - 26);
        ctx.fillText('对齐越精准得分越高！', CW / 2, CH / 2 + 6);
        ctx.fillStyle = '#06D6A0';
        roundRect(ctx, CW / 2 - 80, CH / 2 + 32, 160, 52, 26); ctx.fill();
        ctx.font = 'bold 22px Arial'; ctx.fillStyle = 'white';
        ctx.fillText('开始游戏', CW / 2, CH / 2 + 65);
        if (this.highScore > 0) {
            ctx.font = '15px Arial'; ctx.fillStyle = 'rgba(255,255,255,0.45)';
            ctx.fillText(`最高分: ${this.highScore}`, CW / 2, CH / 2 + 116);
        }
        ctx.restore();
    }

    _drawOver() {
        const ctx = this.ctx;
        ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(0, 0, CW, CH);
        ctx.save(); ctx.textAlign = 'center';
        ctx.font = 'bold 46px Arial'; ctx.fillStyle = '#FF6B6B';
        ctx.shadowBlur = 14; ctx.shadowColor = 'rgba(255,107,107,0.45)';
        ctx.fillText('游戏结束', CW / 2, CH / 2 - 108); ctx.shadowBlur = 0;
        ctx.font = 'bold 74px Arial'; ctx.fillStyle = 'white';
        ctx.fillText(this.score, CW / 2, CH / 2 - 20);
        ctx.font = '20px Arial'; ctx.fillStyle = 'rgba(255,255,255,0.55)';
        ctx.fillText(`最高分: ${this.highScore}`, CW / 2, CH / 2 + 26);
        if (this.score > 0 && this.score >= this.highScore) {
            ctx.font = 'bold 18px Arial'; ctx.fillStyle = '#FFD166';
            ctx.shadowBlur = 10; ctx.shadowColor = 'rgba(255,209,102,0.5)';
            ctx.fillText('★ 新纪录！', CW / 2, CH / 2 + 60); ctx.shadowBlur = 0;
        }
        ctx.fillStyle = '#06D6A0';
        roundRect(ctx, CW / 2 - 80, CH / 2 + 76, 160, 52, 26); ctx.fill();
        ctx.font = 'bold 22px Arial'; ctx.fillStyle = 'white';
        ctx.fillText('再来一局', CW / 2, CH / 2 + 110);
        ctx.restore();
    }

    _bindEvents() {
        const action = () => {
            if (this.state === 'start' || this.state === 'over') this._startGame();
            else this._place();
        };
        this.canvas.addEventListener('click', action);
        this.canvas.addEventListener('touchstart', e => { e.preventDefault(); action(); }, { passive: false });
        document.addEventListener('keydown', e => { if (e.code === 'Space') { e.preventDefault(); action(); } });
    }

    _loop() { this._update(); this._render(); requestAnimationFrame(() => this._loop()); }
}

window.onload = () => new StackGame();
