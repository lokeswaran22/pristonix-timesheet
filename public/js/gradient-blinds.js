/**
 * Vanilla JS version of GradientBlinds using OGL
 * Adapted from React component
 */

export default class GradientBlinds {
    constructor(container, options = {}) {
        this.container = container;
        this.options = {
            dpr: window.devicePixelRatio || 1,
            paused: false,
            gradientColors: ['#FF9FFC', '#5227FF'],
            angle: 0,
            noise: 0.3,
            blindCount: 16,
            blindMinWidth: 60,
            mouseDampening: 0.15,
            mirrorGradient: false,
            spotlightRadius: 0.5,
            spotlightSoftness: 1,
            spotlightOpacity: 1,
            distortAmount: 0,
            shineDirection: 'left',
            mixBlendMode: 'lighten',
            ogl: null, // Dependency injection
            ...options
        };

        if (!this.options.ogl) {
            console.error('GradientBlinds: OGL library must be passed in options.ogl');
            return;
        }

        this.OGL = this.options.ogl;

        this.MAX_COLORS = 8;
        this.mouseTarget = [0, 0];
        this.lastTime = 0;
        this.firstResize = true;
        this.raf = null;

        this.init();
    }

    hexToRGB(hex) {
        const c = hex.replace('#', '').padEnd(6, '0');
        const r = parseInt(c.slice(0, 2), 16) / 255;
        const g = parseInt(c.slice(2, 4), 16) / 255;
        const b = parseInt(c.slice(4, 6), 16) / 255;
        return [r, g, b];
    }

    prepStops(stops) {
        const base = (stops && stops.length ? stops : ['#FF9FFC', '#5227FF']).slice(0, this.MAX_COLORS);
        if (base.length === 1) base.push(base[0]);
        while (base.length < this.MAX_COLORS) base.push(base[base.length - 1]);
        const arr = [];
        for (let i = 0; i < this.MAX_COLORS; i++) arr.push(this.hexToRGB(base[i]));
        const count = Math.max(2, Math.min(this.MAX_COLORS, stops?.length ?? 2));
        return { arr, count };
    }

    init() {
        const { Renderer, Program, Mesh, Triangle } = this.OGL;

        this.renderer = new Renderer({
            dpr: this.options.dpr,
            alpha: true,
            antialias: true
        });

        this.gl = this.renderer.gl;
        this.canvas = this.gl.canvas;
        this.canvas.style.width = '100%';
        this.canvas.style.height = '100%';
        this.canvas.style.display = 'block';
        this.canvas.style.position = 'absolute';
        this.canvas.style.top = '0';
        this.canvas.style.left = '0';
        this.canvas.style.zIndex = '-1';

        if (this.options.mixBlendMode) {
            this.canvas.style.mixBlendMode = this.options.mixBlendMode;
        }

        this.container.appendChild(this.canvas);

        const vertex = `
            attribute vec2 position;
            attribute vec2 uv;
            varying vec2 vUv;

            void main() {
                vUv = uv;
                gl_Position = vec4(position, 0.0, 1.0);
            }
        `;

        const fragment = `
            #ifdef GL_ES
            precision mediump float;
            #endif

            uniform vec3  iResolution;
            uniform vec2  iMouse;
            uniform float iTime;

            uniform float uAngle;
            uniform float uNoise;
            uniform float uBlindCount;
            uniform float uSpotlightRadius;
            uniform float uSpotlightSoftness;
            uniform float uSpotlightOpacity;
            uniform float uMirror;
            uniform float uDistort;
            uniform float uShineFlip;
            uniform vec3  uColor0;
            uniform vec3  uColor1;
            uniform vec3  uColor2;
            uniform vec3  uColor3;
            uniform vec3  uColor4;
            uniform vec3  uColor5;
            uniform vec3  uColor6;
            uniform vec3  uColor7;
            uniform int   uColorCount;

            varying vec2 vUv;

            float rand(vec2 co){
                return fract(sin(dot(co, vec2(12.9898,78.233))) * 43758.5453);
            }

            vec2 rotate2D(vec2 p, float a){
                float c = cos(a);
                float s = sin(a);
                return mat2(c, -s, s, c) * p;
            }

            vec3 getGradientColor(float t){
                float tt = clamp(t, 0.0, 1.0);
                int count = uColorCount;
                if (count < 2) count = 2;
                float scaled = tt * float(count - 1);
                float seg = floor(scaled);
                float f = fract(scaled);

                if (seg < 1.0) return mix(uColor0, uColor1, f);
                if (seg < 2.0 && count > 2) return mix(uColor1, uColor2, f);
                if (seg < 3.0 && count > 3) return mix(uColor2, uColor3, f);
                if (seg < 4.0 && count > 4) return mix(uColor3, uColor4, f);
                if (seg < 5.0 && count > 5) return mix(uColor4, uColor5, f);
                if (seg < 6.0 && count > 6) return mix(uColor5, uColor6, f);
                if (seg < 7.0 && count > 7) return mix(uColor6, uColor7, f);
                if (count > 7) return uColor7;
                if (count > 6) return uColor6;
                if (count > 5) return uColor5;
                if (count > 4) return uColor4;
                if (count > 3) return uColor3;
                if (count > 2) return uColor2;
                return uColor1;
            }

            void mainImage( out vec4 fragColor, in vec2 fragCoord )
            {
                vec2 uv0 = fragCoord.xy / iResolution.xy;

                float aspect = iResolution.x / iResolution.y;
                vec2 p = uv0 * 2.0 - 1.0;
                p.x *= aspect;
                vec2 pr = rotate2D(p, uAngle);
                pr.x /= aspect;
                vec2 uv = pr * 0.5 + 0.5;

                vec2 uvMod = uv;
                if (uDistort > 0.0) {
                  float a = uvMod.y * 6.0;
                  float b = uvMod.x * 6.0;
                  float w = 0.01 * uDistort;
                  uvMod.x += sin(a) * w;
                  uvMod.y += cos(b) * w;
                }
                float t = uvMod.x;
                if (uMirror > 0.5) {
                  t = 1.0 - abs(1.0 - 2.0 * fract(t));
                }
                vec3 base = getGradientColor(t);

                vec2 offset = vec2(iMouse.x/iResolution.x, iMouse.y/iResolution.y);
                float d = length(uv0 - offset);
                float r = max(uSpotlightRadius, 1e-4);
                float dn = d / r;
                float spot = (1.0 - 2.0 * pow(dn, uSpotlightSoftness)) * uSpotlightOpacity;
                vec3 cir = vec3(spot);
                float stripe = fract(uvMod.x * max(uBlindCount, 1.0));
                if (uShineFlip > 0.5) stripe = 1.0 - stripe;
                vec3 ran = vec3(stripe);

                vec3 col = cir + base - ran;
                col += (rand(gl_FragCoord.xy + iTime) - 0.5) * uNoise;

                fragColor = vec4(col, 1.0);
            }

            void main() {
                vec4 color;
                mainImage(color, vUv * iResolution.xy);
                gl_FragColor = color;
            }
        `;

        const { arr: colorArr, count: colorCount } = this.prepStops(this.options.gradientColors);
        this.uniforms = {
            iResolution: {
                value: [this.gl.drawingBufferWidth, this.gl.drawingBufferHeight, 1]
            },
            iMouse: { value: [0, 0] },
            iTime: { value: 0 },
            uAngle: { value: (this.options.angle * Math.PI) / 180 },
            uNoise: { value: this.options.noise },
            uBlindCount: { value: Math.max(1, this.options.blindCount) },
            uSpotlightRadius: { value: this.options.spotlightRadius },
            uSpotlightSoftness: { value: this.options.spotlightSoftness },
            uSpotlightOpacity: { value: this.options.spotlightOpacity },
            uMirror: { value: this.options.mirrorGradient ? 1 : 0 },
            uDistort: { value: this.options.distortAmount },
            uShineFlip: { value: this.options.shineDirection === 'right' ? 1 : 0 },
            uColor0: { value: colorArr[0] },
            uColor1: { value: colorArr[1] },
            uColor2: { value: colorArr[2] },
            uColor3: { value: colorArr[3] },
            uColor4: { value: colorArr[4] },
            uColor5: { value: colorArr[5] },
            uColor6: { value: colorArr[6] },
            uColor7: { value: colorArr[7] },
            uColorCount: { value: colorCount }
        };

        this.program = new Program(this.gl, {
            vertex,
            fragment,
            uniforms: this.uniforms
        });

        this.geometry = new Triangle(this.gl);
        this.mesh = new Mesh(this.gl, { geometry: this.geometry, program: this.program });

        this.resize = () => {
            const rect = this.container.getBoundingClientRect();
            this.renderer.setSize(rect.width, rect.height);
            this.uniforms.iResolution.value = [this.gl.drawingBufferWidth, this.gl.drawingBufferHeight, 1];

            if (this.options.blindMinWidth && this.options.blindMinWidth > 0) {
                const maxByMinWidth = Math.max(1, Math.floor(rect.width / this.options.blindMinWidth));
                const effective = this.options.blindCount ? Math.min(this.options.blindCount, maxByMinWidth) : maxByMinWidth;
                this.uniforms.uBlindCount.value = Math.max(1, effective);
            } else {
                this.uniforms.uBlindCount.value = Math.max(1, this.options.blindCount);
            }

            if (this.firstResize) {
                this.firstResize = false;
                const cx = this.gl.drawingBufferWidth / 2;
                const cy = this.gl.drawingBufferHeight / 2;
                this.uniforms.iMouse.value = [cx, cy];
                this.mouseTarget = [cx, cy];
            }
        };

        this.resize();
        this.ro = new ResizeObserver(this.resize);
        this.ro.observe(this.container);

        this.onPointerMove = e => {
            const rect = this.canvas.getBoundingClientRect();
            const scale = this.renderer.dpr || 1;
            const x = (e.clientX - rect.left) * scale;
            const y = (rect.height - (e.clientY - rect.top)) * scale;
            this.mouseTarget = [x, y];
            if (this.options.mouseDampening <= 0) {
                this.uniforms.iMouse.value = [x, y];
            }
        };
        window.addEventListener('pointermove', this.onPointerMove);

        this.loop = (t) => {
            this.raf = requestAnimationFrame(this.loop);
            this.uniforms.iTime.value = t * 0.001;
            if (this.options.mouseDampening > 0) {
                if (!this.lastTime) this.lastTime = t;
                const dt = (t - this.lastTime) / 1000;
                this.lastTime = t;
                const tau = Math.max(1e-4, this.options.mouseDampening);
                let factor = 1 - Math.exp(-dt / tau);
                if (factor > 1) factor = 1;
                const target = this.mouseTarget;
                const cur = this.uniforms.iMouse.value;
                cur[0] += (target[0] - cur[0]) * factor;
                cur[1] += (target[1] - cur[1]) * factor;
            } else {
                this.lastTime = t;
            }
            if (!this.options.paused && this.program && this.mesh) {
                try {
                    this.renderer.render({ scene: this.mesh });
                } catch (e) {
                    console.error(e);
                }
            }
        };
        this.raf = requestAnimationFrame(this.loop);
    }

    destroy() {
        if (this.raf) cancelAnimationFrame(this.raf);
        window.removeEventListener('pointermove', this.onPointerMove);
        if (this.ro) this.ro.disconnect();
        if (this.canvas && this.canvas.parentElement === this.container) {
            this.container.removeChild(this.canvas);
        }

        if (this.program) this.program.remove();
        if (this.geometry) this.geometry.remove();
        if (this.mesh) this.mesh.remove();
        if (this.renderer) this.renderer.destroy();
    }
}
