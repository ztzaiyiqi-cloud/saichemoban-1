// ─── 常量 ─────────────────────────────────────────────────────────────────────
const CW = 360;
const CH = 600;
const BH = 28;
const BD = 6;           // 3D 深度
const BASE_W = 200;
const FIXED_MOVING_Y = 210;

const PALETTE = [
    '#FF6B6B','#FF8E53','#FFD166','#06D6A0',
    '#118AB2','#7B2FBE','#FF6B9D','#4ECDC4'
];

// ─── 工具 ──────────────────────────────────────────────────────────────────────
function lerp(a, b, t) { return a + (b - a) * t; }

function lighten(hex, amt) {
    const n = parseInt(hex.replace('#',''), 16);
    const r = Math.min(255, (n >> 16) + amt);
    const g = Math.min(255, ((n >> 8) & 0xff) + amt);
    const b = Math.min(255, (n & 0xff) + amt);
    return `rgb(${r},${g},${b})`;
}

function darken(hex, amt) {
    const n = parseInt(hex.replace('#',''), 16);
    const r = Math.max(0, (n >> 16) - amt);
    const g = Math.max(0, ((n >> 8) & 0xff) - amt);
    const b = Math.max(0, (n & 0xff) - amt);
    return `rgb(${r},${g},${b})`;
}

// ─── 像素猫（2帧动画，8×8 像素格，每格 4px）────────────────────────────────────
const CAT_FRAMES = [
    [
        [0,0,1,1,1,1,0,0],
        [0,1,2,1,1,2,1,0],
        [0,1,1,1,1,1,1,0],
        [0,0,1,3,3,1,0,0],
        [0,1,1,1,1,1,1,0],
        [1,1,0,0,0,0,1,1],
        [1,0,0,0,0,0,0,1],
        [1,0,0,0,0,0,0,1],
    ],
    [
        [0,0,1,1,1,1,0,0],
        [0,1,2,1,1,2,1,0],
        [0,1,1,1,1,1,1,0],
        [0,0,1,3,3,1,0,0],
        [0,1,1,1,1,1,1,0],
        [0,1,1,0,0,1,1,0],
        [0,1,0,0,0,0,1,0],
        [1,0,0,0,0,0,0,1],
    ]
];

const CAT_COLORS = [
    { main:'#E07820', light:'#FFB060', dark:'#A05010' },
    { main:'#9090A0', light:'#C0C0D0', dark:'#606070' }
];

const PIXEL = 4;

class PixelAnimal {
    constructor(colorIdx, x, dir) {
        this.colorIdx = colorIdx;
        this.x   = x;
        this.y   = CH - 52;
        this.dir = dir;
        this.frame = 0;
        this.frameTimer = 0;
    }

    update() {
        this.x += this.dir * 1.2;
        if (this.x > CW + 40)  this.x = -40;
        if (this.x < -40)      this.x = CW + 40;
        this.frameTimer++;
        if (this.frameTimer > 10) { this.frame ^= 1; this.frameTimer = 0; }
    }

    draw(ctx) {
        const grid  = CAT_FRAMES[this.frame];
        const col   = CAT_COLORS[this.colorIdx];
        const cols  = [null, col.main, col.light, col.dark];
        const W     = grid[0].length;
        const H     = grid.length;

        ctx.save();
        if (this.dir < 0) {
            ctx.translate(this.x + W * PIXEL, this.y);
            ctx.scale(-1, 1);
        } else {
            ctx.translate(this.x, this.y);
        }

        for (let row = 0; row < H; row++) {
            for (let c2 = 0; c2 < W; c2++) {
                const v = grid[row][c2];
                if (!v) continue;
                ctx.fillStyle = cols[v];
                ctx.fillRect(c2 * PIXEL, row * PIXEL, PIXEL, PIXEL);
            }
        }
        ctx.restore();
    }
}

class StarParticle {
    constructor(x, y, c) {
        this.x  = x; this.y  = y; this.c = c;
        const a = Math.random() * Math.PI * 2;
        const s = 1.5 + Math.random() * 4;
        this.vx = Math.cos(a) * s;
        this.vy = Math.sin(a) * s - 3;
        this.life = 1;
        this.sz   = 3 + Math.floor(Math.random() * 3);
    }

    update() {
        this.x    += this.vx;
        this.y    += this.vy;
        this.vy   += 0.15;
        this.life -= 0.025;
    }

    draw(ctx) {
        ctx.save();
        ctx.globalAlpha = this.life;
        ctx.fillStyle   = this.c;
        const s = this.sz;
        ctx.fillRect(this.x - s, this.y, s * 2 + 1, 1);
        ctx.fillRect(this.x,     this.y - s, 1, s * 2 + 1);
        ctx.fillRect(this.x - 1, this.y - 1, 3, 3);
        ctx.restore();
    }
}
// ─── 主游戏类 ──────────────────────────────────────────────────────────────────
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
        this.animals   = [
            new PixelAnimal(0, 60,   1),
            new PixelAnimal(1, 260, -1),
        ];

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
        this.stack     = [{ x: (CW - BASE_W) / 2, w: BASE_W, c: PALETTE[0] }];
        this.fallers   = [];
        this.particles = [];
        this._spawnMoving();
        this.state = 'playing';
    }

    _spawnMoving() {
        const top      = this.stack[this.stack.length - 1];
        const c        = PALETTE[this.stack.length % PALETTE.length];
        const fromLeft = (this.stack.length % 2 === 1);
        this.moving = { x: fromLeft ? 0 : CW - top.w, w: top.w, dir: fromLeft ? 1 : -1, c };
    }

    _place() {
        if (this.state !== 'playing' || !this.moving) return;
        const top = this.stack[this.stack.length - 1];
        const m   = this.moving;

        const l  = Math.max(m.x, top.x);
        const r  = Math.min(m.x + m.w, top.x + top.w);
        const ov = r - l;

        if (ov <= 0) { this._gameOver(); return; }

        const isPerfect = Math.abs(ov - top.w) <= 4;
        const sy = this._movingY();

        if (!isPerfect) {
            if (m.x < l)
                this.fallers.push({ x: m.x, y: sy, w: l - m.x, vy: -0.5, rot: 0, rv: (Math.random()-.5)*.09, c: m.c });
            if (m.x + m.w > r)
                this.fallers.push({ x: r, y: sy, w: (m.x + m.w) - r, vy: -0.5, rot: 0, rv: (Math.random()-.5)*.09, c: m.c });
            this.combo = 0;
        } else {
            this.combo++;
            this._burst(l + ov / 2, sy + BH / 2);
        }

        if (isPerfect || this.score % 5 === 4) {
            this._spawnStars(l + ov / 2, sy);
        }

        const nx = isPerfect ? top.x : l;
        const nw = isPerfect ? top.w : ov;
        this.stack.push({ x: nx, w: nw, c: m.c });
        this.score++;

        this.scrollTarget = Math.max(0, CH - (this.stack.length + 1) * BH - FIXED_MOVING_Y);
        this._spawnMoving();
    }

    _gameOver() {
        this.state = 'over';
        if (this.score > this.highScore) {
            this.highScore = this.score;
            localStorage.setItem('stackHS', this.highScore);
        }
        const m = this.moving;
        if (m) this.fallers.push({ x: m.x, y: this._movingY(), w: m.w, vy: 0, rot: 0, rv: 0.06, c: m.c });
        this.moving = null;
    }

    _burst(cx, cy) {
        for (let i = 0; i < 16; i++) {
            this.particles.push(new StarParticle(cx, cy, PALETTE[Math.floor(Math.random() * PALETTE.length)]));
        }
    }

    _spawnStars(cx, cy) {
        for (let i = 0; i < 8; i++) {
            this.particles.push(new StarParticle(cx + (Math.random()-.5)*60, cy, '#FFD166'));
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

        for (const p of this.particles) p.update();
        this.particles = this.particles.filter(p => p.life > 0);

        for (const a of this.animals) a.update();

        this.scroll += (this.scrollTarget - this.scroll) * 0.13;
    }

    _render() {
        const ctx = this.ctx;

        const prog = Math.min(this.score / 45, 1);
        const bg   = ctx.createLinearGradient(0, 0, 0, CH);
        bg.addColorStop(0, `hsl(${lerp(240,270,prog)},${lerp(40,60,prog)}%,${lerp(12,6,prog)}%)`);
        bg.addColorStop(1, `hsl(${lerp(220,250,prog)},${lerp(35,55,prog)}%,${lerp(20,10,prog)}%)`);
        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, CW, CH);

        ctx.strokeStyle = 'rgba(255,255,255,0.04)';
        ctx.lineWidth   = 1;
        for (let gx = 0; gx < CW; gx += 8) {
            ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, CH); ctx.stroke();
        }
        for (let gy = 0; gy < CH; gy += 8) {
            ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(CW, gy); ctx.stroke();
        }

        for (let i = 0; i < this.stack.length; i++) {
            const sy = this._blockY(i);
            if (sy > CH + BH || sy < -BH) continue;
            const b = this.stack[i];
            this._draw3DBlock(b.x, sy, b.w, b.c);
        }

        if (this.moving) {
            this._draw3DBlock(this.moving.x, this._movingY(), this.moving.w, this.moving.c);
        }

        for (const f of this.fallers) {
            ctx.save();
            ctx.translate(f.x + f.w / 2, f.y + BH / 2);
            ctx.rotate(f.rot);
            this._draw3DBlock(-f.w / 2, -BH / 2, f.w, f.c);
            ctx.restore();
        }

        for (const p of this.particles) p.draw(ctx);
        for (const a of this.animals) a.draw(ctx);

        ctx.fillStyle = 'rgba(0,0,0,0.10)';
        for (let sy2 = 0; sy2 < CH; sy2 += 4) {
            ctx.fillRect(0, sy2, CW, 2);
        }

        if (this.state === 'playing') this._drawHUD();
        if (this.state === 'start')   this._drawStart();
        if (this.state === 'over')    this._drawOver();
    }

    _draw3DBlock(x, y, w, c) {
        const ctx = this.ctx;
        const D   = BD;
        ctx.save();

        ctx.fillStyle = darken(c, 60);
        ctx.beginPath();
        ctx.moveTo(x + w,     y + D);
        ctx.lineTo(x + w + D, y);
        ctx.lineTo(x + w + D, y + BH - D);
        ctx.lineTo(x + w,     y + BH);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = lighten(c, 60);
        ctx.beginPath();
        ctx.moveTo(x,         y);
        ctx.lineTo(x + w,     y);
        ctx.lineTo(x + w + D, y - D);
        ctx.lineTo(x + D,     y - D);
        ctx.closePath();
        ctx.fill();

        const grad = ctx.createLinearGradient(x, y, x, y + BH);
        grad.addColorStop(0, lighten(c, 25));
        grad.addColorStop(1, c);
        ctx.fillStyle = grad;
        ctx.fillRect(x, y, w, BH);

        ctx.strokeStyle = darken(c, 80);
        ctx.lineWidth   = 1;
        ctx.strokeRect(x + 0.5, y + 0.5, w - 1, BH - 1);

        ctx.fillStyle = 'rgba(255,255,255,0.18)';
        ctx.fillRect(x + 2, y + 2, w - 4, 4);

        ctx.restore();
    }

    _drawRetroBox(x, y, w, h) {
        const ctx = this.ctx;
        ctx.fillStyle   = 'rgba(0,0,20,0.82)';
        ctx.fillRect(x, y, w, h);
        ctx.strokeStyle = 'rgba(255,255,255,0.5)';
        ctx.lineWidth   = 1;
        ctx.strokeRect(x + 0.5,     y + 0.5,     w - 1, h - 1);
        ctx.strokeStyle = 'rgba(255,255,255,0.15)';
        ctx.strokeRect(x + 3.5,     y + 3.5,     w - 7, h - 7);
    }

    _drawHUD() {
        const ctx = this.ctx;
        this._drawRetroBox(12, 10, 100, 52);
        ctx.save();
        ctx.font      = '10px monospace';
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        ctx.fillText('SCORE', 22, 26);
        ctx.font      = 'bold 26px monospace';
        ctx.fillStyle = '#FFD166';
        ctx.fillText(this.score, 22, 52);
        ctx.restore();

        if (this.combo > 1) {
            ctx.save();
            ctx.textAlign   = 'center';
            ctx.font        = 'bold 14px monospace';
            ctx.fillStyle   = '#06D6A0';
            ctx.shadowBlur  = 10;
            ctx.shadowColor = '#06D6A0';
            ctx.fillText(`PERFECT x${this.combo}`, CW / 2, 32);
            ctx.restore();
        }
    }

    _drawStart() {
        const ctx = this.ctx;
        ctx.fillStyle = 'rgba(0,0,0,0.60)';
        ctx.fillRect(0, 0, CW, CH);

        this._drawRetroBox(CW/2 - 130, CH/2 - 140, 260, 260);

        ctx.save();
        ctx.textAlign = 'center';

        ctx.font      = 'bold 48px monospace';
        ctx.fillStyle = '#FFD166';
        ctx.shadowBlur  = 20;
        ctx.shadowColor = 'rgba(255,209,102,0.7)';
        ctx.fillText('叠叠乐', CW/2, CH/2 - 60);
        ctx.shadowBlur = 0;

        ctx.font      = '11px monospace';
        ctx.fillStyle = 'rgba(255,255,255,0.7)';
        ctx.fillText('STACK GAME', CW/2, CH/2 - 36);

        ctx.font      = '13px monospace';
        ctx.fillStyle = 'rgba(255,255,255,0.75)';
        ctx.fillText('点击 / 空格  放置方块', CW/2, CH/2 + 2);
        ctx.fillText('精准对齐得分更高！', CW/2, CH/2 + 22);

        this._drawRetroBox(CW/2 - 70, CH/2 + 44, 140, 44);
        ctx.font      = 'bold 18px monospace';
        ctx.fillStyle = '#06D6A0';
        ctx.fillText('▶ 开始', CW/2, CH/2 + 72);

        if (this.highScore > 0) {
            ctx.font      = '11px monospace';
            ctx.fillStyle = 'rgba(255,255,255,0.35)';
            ctx.fillText(`BEST: ${this.highScore}`, CW/2, CH/2 + 108);
        }
        ctx.restore();
    }

    _drawOver() {
        const ctx = this.ctx;
        ctx.fillStyle = 'rgba(0,0,0,0.62)';
        ctx.fillRect(0, 0, CW, CH);

        this._drawRetroBox(CW/2 - 130, CH/2 - 150, 260, 270);

        ctx.save();
        ctx.textAlign = 'center';

        ctx.font      = 'bold 28px monospace';
        ctx.fillStyle = '#FF6B6B';
        ctx.shadowBlur  = 12;
        ctx.shadowColor = 'rgba(255,107,107,0.6)';
        ctx.fillText('GAME  OVER', CW/2, CH/2 - 90);
        ctx.shadowBlur = 0;

        ctx.font      = 'bold 64px monospace';
        ctx.fillStyle = 'white';
        ctx.fillText(this.score, CW/2, CH/2 - 14);

        ctx.font      = '12px monospace';
        ctx.fillStyle = 'rgba(255,255,255,0.45)';
        ctx.fillText(`BEST: ${this.highScore}`, CW/2, CH/2 + 16);

        if (this.score > 0 && this.score >= this.highScore) {
            ctx.font        = 'bold 14px monospace';
            ctx.fillStyle   = '#FFD166';
            ctx.shadowBlur  = 10;
            ctx.shadowColor = '#FFD166';
            ctx.fillText('★ NEW RECORD ★', CW/2, CH/2 + 46);
            ctx.shadowBlur = 0;
        }

        this._drawRetroBox(CW/2 - 70, CH/2 + 64, 140, 44);
        ctx.font      = 'bold 18px monospace';
        ctx.fillStyle = '#06D6A0';
        ctx.fillText('▶ 再来', CW/2, CH/2 + 92);

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

    _loop() {
        this._update();
        this._render();
        requestAnimationFrame(() => this._loop());
    }
}

window.onload = () => new StackGame();
