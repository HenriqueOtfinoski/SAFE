// Fundo de ondas líquidas: plano preso à câmera, tingido pela cor do estado.

const VERTEX = /* glsl */ `
  void main() {
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const FRAGMENT = /* glsl */ `
  precision highp float;

  uniform float uTime;
  uniform vec2 uResolution;
  uniform vec2 uMouse;
  uniform float uScroll;
  uniform vec3 uCor;
  uniform float uIntensidade;

  void main() {
    vec2 uv = (gl_FragCoord.xy - 0.5 * uResolution.xy) / uResolution.y;
    float aspecto = uResolution.x / uResolution.y;
    float t = uTime * 0.08;
    float deforma = uScroll * 5.0;

    // Arcos largos e suaves; o scroll desloca a fase em vez de comprimir as ondas.
    vec2 w = uv;
    w.x += sin(uv.y * 2.5 + t * 0.2 + deforma) * 0.35;
    w.y += cos(uv.x * 2.5 - t * 0.15 - deforma * 0.8) * 0.35;
    w.x += sin(uv.y * 1.2 - t * 0.1 - deforma * 1.5) * 0.25;
    w.y += cos(uv.x * 1.2 + t * 0.18 + deforma * 1.2) * 0.25;
    w += vec2(uScroll * 0.04, -uScroll * 0.02);
    w += vec2(uMouse.x * aspecto, uMouse.y) * 0.05;

    float w1 = sin(dot(w, vec2(cos(0.6), sin(0.6))) * 2.4 + t);
    float w2 = cos(dot(w, vec2(cos(-0.7), sin(-0.7))) * 3.2 - t * 1.4 + w1 * 0.4);
    float w3 = sin(dot(w, vec2(cos(1.2), sin(1.2))) * 4.0 + t * 1.8 + w2 * 0.5);
    float campo = w1 * 0.50 + w2 * 0.35 + w3 * 0.15;

    float brilhoLargo = pow(max(0.0, 1.0 - abs(campo - 0.1)), 2.5);
    float brilhoFino = pow(max(0.0, 1.0 - abs(campo - 0.15)), 8.0);
    float crista = brilhoLargo * 0.5 + brilhoFino * 0.9;

    vec3 sombra = uCor * 0.004;
    vec3 corpo2 = uCor * 0.035;
    vec3 corpo1 = uCor * 0.06;
    vec3 corCrista = mix(uCor, vec3(1.0), 0.2) * 0.45;

    vec3 cor = sombra;
    cor = mix(cor, corpo2, smoothstep(-0.6, 0.2, campo));
    cor = mix(cor, corpo1, smoothstep(0.0, 0.8, campo));
    cor += corCrista * crista * 0.9;

    cor *= 1.0 - dot(uv, uv) * 0.12;
    cor *= mix(0.4, 1.0, uIntensidade);

    gl_FragColor = vec4(cor, 1.0);
  }
`;

export function criarFundo(THREE, uniforms) {
  const material = new THREE.ShaderMaterial({
    vertexShader: VERTEX,
    fragmentShader: FRAGMENT,
    uniforms,
    depthWrite: false,
    depthTest: false,
  });
  const malha = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), material);
  malha.position.set(0, 0, -8);
  malha.renderOrder = -10;
  malha.frustumCulled = false;
  return malha;
}
