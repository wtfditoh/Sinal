// ========================================
// CONFIGURAÇÃO DOS PRESETS
// ========================================
// Coloque seus arquivos .cube na pasta "luts/"
// e cadastre aqui:
//   { nome: "Nome que aparece no app", arquivo: "luts/arquivo.cube" }
//
// Exemplo com 1 preset:
//   const PRESETS = [
//     { nome: "Meu Preset", arquivo: "luts/preset.cube" },
//   ];
//
// Exemplo com vários:
//   const PRESETS = [
//     { nome: "Quente",  arquivo: "luts/quente.cube" },
//     { nome: "Story",   arquivo: "luts/story.cube" },
//     { nome: "Feed",    arquivo: "luts/feed.cube" },
//   ];

const PRESETS = [
  { nome: "Feed 2026", arquivo: "luts/Feed2026.cube" },
];

// ========================================

const canvas = document.getElementById("canvasEditor");
const fileInput = document.getElementById("fileInput");
const editorVazio = document.getElementById("editorVazio");
const editorPainel = document.getElementById("editorPainel");
const editorAcoes = document.getElementById("editorAcoes");
const listaPresets = document.getElementById("listaPresets");
const intensidadeSlider = document.getElementById("intensidadeSlider");
const intensidadeValor = document.getElementById("intensidadeValor");
const editorStatus = document.getElementById("editorStatus");
const editorLoading = document.getElementById("editorLoading");
const editorLoadingTexto = document.getElementById("editorLoadingTexto");

let gl = null;
let programa = null;
let texturaImagem = null;
let texturaLUT = null;
let imagemOriginal = null;
let presetsCarregados = []; // [{ nome, data: Float32Array, size: N }]
let presetAtual = null;
let intensidade = 1.0;

// ---------- Inicializa WebGL2 ----------
function initWebGL() {
  gl = canvas.getContext("webgl2", {
    preserveDrawingBuffer: true,
    premultipliedAlpha: false,
  });

  if (!gl) {
    alert("Seu navegador não suporta WebGL2. Tente atualizar o navegador.");
    return false;
  }

  const vertexShaderSrc = `#version 300 es
    in vec2 a_position;
    in vec2 a_texCoord;
    out vec2 v_texCoord;
    void main() {
      gl_Position = vec4(a_position, 0.0, 1.0);
      v_texCoord = a_texCoord;
    }
  `;

  const fragmentShaderSrc = `#version 300 es
    precision highp float;
    precision highp sampler3D;

    in vec2 v_texCoord;
    out vec4 outColor;

    uniform sampler2D u_image;
    uniform sampler3D u_lut;
    uniform float u_lutSize;
    uniform float u_intensity;

    void main() {
      vec4 cor = texture(u_image, v_texCoord);

      // Ajusta coordenadas pra amostrar o centro de cada voxel da LUT
      float escala = (u_lutSize - 1.0) / u_lutSize;
      float offset = 0.5 / u_lutSize;
      vec3 coord = cor.rgb * escala + offset;

      vec3 corLut = texture(u_lut, coord).rgb;

      vec3 resultado = mix(cor.rgb, corLut, u_intensity);
      outColor = vec4(resultado, cor.a);
    }
  `;

  const vs = compilarShader(gl.VERTEX_SHADER, vertexShaderSrc);
  const fs = compilarShader(gl.FRAGMENT_SHADER, fragmentShaderSrc);
  if (!vs || !fs) return false;

  programa = gl.createProgram();
  gl.attachShader(programa, vs);
  gl.attachShader(programa, fs);
  gl.linkProgram(programa);

  if (!gl.getProgramParameter(programa, gl.LINK_STATUS)) {
    console.error("Erro ao linkar programa:", gl.getProgramInfoLog(programa));
    return false;
  }

  // Quad que cobre a tela
  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
    -1, -1,  0, 1,
     1, -1,  1, 1,
    -1,  1,  0, 0,
    -1,  1,  0, 0,
     1, -1,  1, 1,
     1,  1,  1, 0,
  ]), gl.STATIC_DRAW);

  const posLoc = gl.getAttribLocation(programa, "a_position");
  const texLoc = gl.getAttribLocation(programa, "a_texCoord");
  gl.enableVertexAttribArray(posLoc);
  gl.enableVertexAttribArray(texLoc);
  gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 16, 0);
  gl.vertexAttribPointer(texLoc, 2, gl.FLOAT, false, 16, 8);

  return true;
}

function compilarShader(tipo, fonte) {
  const shader = gl.createShader(tipo);
  gl.shaderSource(shader, fonte);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.error("Erro ao compilar shader:", gl.getShaderInfoLog(shader));
    return null;
  }
  return shader;
}

// ---------- Carrega arquivo .cube ----------
async function carregarCube(url) {
  const resposta = await fetch(url);
  if (!resposta.ok) throw new Error("Arquivo não encontrado: " + url);
  const texto = await resposta.text();

  const linhas = texto.split(/\r?\n/);
  let size = 0;
  const dados = [];

  for (const linha of linhas) {
    const l = linha.trim();
    if (!l || l.startsWith("#")) continue;

    if (l.startsWith("LUT_3D_SIZE")) {
      size = parseInt(l.split(/\s+/)[1], 10);
      continue;
    }

    if (l.startsWith("TITLE") || l.startsWith("DOMAIN_MIN") || l.startsWith("DOMAIN_MAX")) {
      continue;
    }

    // Linha de dados: "r g b"
    const partes = l.split(/\s+/);
    if (partes.length === 3) {
      const r = parseFloat(partes[0]);
      const g = parseFloat(partes[1]);
      const b = parseFloat(partes[2]);
      if (!isNaN(r) && !isNaN(g) && !isNaN(b)) {
        dados.push(r, g, b);
      }
    }
  }

  if (!size || dados.length !== size * size * size * 3) {
    throw new Error("Arquivo .cube inválido (esperado " + (size*size*size*3) + " valores, veio " + dados.length + ")");
  }

  return { size, data: new Float32Array(dados) };
}

// ---------- Upload da LUT pra GPU ----------
function criarTexturaLUT(lutSize, lutData) {
  if (texturaLUT) gl.deleteTexture(texturaLUT);

  texturaLUT = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_3D, texturaLUT);
  gl.texImage3D(
    gl.TEXTURE_3D, 0, gl.RGB32F,
    lutSize, lutSize, lutSize, 0,
    gl.RGB, gl.FLOAT, lutData
  );
  gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_R, gl.CLAMP_TO_EDGE);
}

// ---------- Carregar imagem do usuário ----------
function carregarImagem(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ---------- Desenha a imagem com LUT ----------
function desenhar() {
  if (!imagemOriginal || !gl || !programa) return;

  // Ajusta canvas pro tamanho da imagem (limitado pra performance de preview)
  const maxPreview = 1600;
  let w = imagemOriginal.width;
  let h = imagemOriginal.height;
  if (w > maxPreview || h > maxPreview) {
    const fator = Math.min(maxPreview / w, maxPreview / h);
    w = Math.round(w * fator);
    h = Math.round(h * fator);
  }
  canvas.width = w;
  canvas.height = h;

  gl.viewport(0, 0, w, h);

  // Upload da imagem como textura
  if (texturaImagem) gl.deleteTexture(texturaImagem);
  texturaImagem = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texturaImagem);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, imagemOriginal);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

  gl.useProgram(programa);

  // Se não tem preset, usa LUT identidade
  if (!presetAtual) {
    // Cria LUT identidade 2x2x2
    const ident = new Float32Array([
      0,0,0,  1,0,0,
      0,1,0,  1,1,0,
      0,0,1,  1,0,1,
      0,1,1,  1,1,1,
    ]);
    criarTexturaLUT(2, ident);
  } else {
    criarTexturaLUT(presetAtual.size, presetAtual.data);
  }

  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, texturaImagem);
  gl.uniform1i(gl.getUniformLocation(programa, "u_image"), 0);

  gl.activeTexture(gl.TEXTURE1);
  gl.bindTexture(gl.TEXTURE_3D, texturaLUT);
  gl.uniform1i(gl.getUniformLocation(programa, "u_lut"), 1);

  gl.uniform1f(gl.getUniformLocation(programa, "u_lutSize"), presetAtual ? presetAtual.size : 2);
  gl.uniform1f(gl.getUniformLocation(programa, "u_intensity"), presetAtual ? intensidade : 0);

  gl.drawArrays(gl.TRIANGLES, 0, 6);
}

// ---------- Renderiza miniatura pra cada preset ----------
function renderThumb(miniCanvas, lut) {
  const gl2 = miniCanvas.getContext("webgl2", { preserveDrawingBuffer: true });
  if (!gl2) return;

  miniCanvas.width = 88;
  miniCanvas.height = 88;

  // Reutiliza o mesmo shader
  const vs = compilarShaderGL(gl2, gl2.VERTEX_SHADER, `#version 300 es
    in vec2 a_position;
    in vec2 a_texCoord;
    out vec2 v_texCoord;
    void main() {
      gl_Position = vec4(a_position, 0.0, 1.0);
      v_texCoord = a_texCoord;
    }
  `);
  const fs = compilarShaderGL(gl2, gl2.FRAGMENT_SHADER, `#version 300 es
    precision highp float;
    precision highp sampler3D;
    in vec2 v_texCoord;
    out vec4 outColor;
    uniform sampler2D u_image;
    uniform sampler3D u_lut;
    uniform float u_lutSize;
    void main() {
      vec4 cor = texture(u_image, v_texCoord);
      float escala = (u_lutSize - 1.0) / u_lutSize;
      float offset = 0.5 / u_lutSize;
      vec3 coord = cor.rgb * escala + offset;
      vec3 corLut = texture(u_lut, coord).rgb;
      outColor = vec4(corLut, cor.a);
    }
  `);
  if (!vs || !fs) return;

  const prog = gl2.createProgram();
  gl2.attachShader(prog, vs);
  gl2.attachShader(prog, fs);
  gl2.linkProgram(prog);
  gl2.useProgram(prog);

  const buf = gl2.createBuffer();
  gl2.bindBuffer(gl2.ARRAY_BUFFER, buf);
  gl2.bufferData(gl2.ARRAY_BUFFER, new Float32Array([
    -1,-1, 0,1,  1,-1, 1,1,  -1,1, 0,0,
    -1,1, 0,0,   1,-1, 1,1,   1,1, 1,0,
  ]), gl2.STATIC_DRAW);

  const pL = gl2.getAttribLocation(prog, "a_position");
  const tL = gl2.getAttribLocation(prog, "a_texCoord");
  gl2.enableVertexAttribArray(pL);
  gl2.enableVertexAttribArray(tL);
  gl2.vertexAttribPointer(pL, 2, gl2.FLOAT, false, 16, 0);
  gl2.vertexAttribPointer(tL, 2, gl2.FLOAT, false, 16, 8);

  const texImg = gl2.createTexture();
  gl2.bindTexture(gl2.TEXTURE_2D, texImg);
  gl2.pixelStorei(gl2.UNPACK_FLIP_Y_WEBGL, true);
  gl2.texImage2D(gl2.TEXTURE_2D, 0, gl2.RGBA, gl2.RGBA, gl2.UNSIGNED_BYTE, imagemOriginal);
  gl2.texParameteri(gl2.TEXTURE_2D, gl2.TEXTURE_MIN_FILTER, gl2.LINEAR);
  gl2.texParameteri(gl2.TEXTURE_2D, gl2.TEXTURE_MAG_FILTER, gl2.LINEAR);

  const texLut = gl2.createTexture();
  gl2.bindTexture(gl2.TEXTURE_3D, texLut);
  gl2.texImage3D(gl2.TEXTURE_3D, 0, gl2.RGB32F, lut.size, lut.size, lut.size, 0, gl2.RGB, gl2.FLOAT, lut.data);
  gl2.texParameteri(gl2.TEXTURE_3D, gl2.TEXTURE_MIN_FILTER, gl2.LINEAR);
  gl2.texParameteri(gl2.TEXTURE_3D, gl2.TEXTURE_MAG_FILTER, gl2.LINEAR);
  gl2.texParameteri(gl2.TEXTURE_3D, gl2.TEXTURE_WRAP_S, gl2.CLAMP_TO_EDGE);
  gl2.texParameteri(gl2.TEXTURE_3D, gl2.TEXTURE_WRAP_T, gl2.CLAMP_TO_EDGE);
  gl2.texParameteri(gl2.TEXTURE_3D, gl2.TEXTURE_WRAP_R, gl2.CLAMP_TO_EDGE);

  gl2.activeTexture(gl2.TEXTURE0);
  gl2.bindTexture(gl2.TEXTURE_2D, texImg);
  gl2.uniform1i(gl2.getUniformLocation(prog, "u_image"), 0);
  gl2.activeTexture(gl2.TEXTURE1);
  gl2.bindTexture(gl2.TEXTURE_3D, texLut);
  gl2.uniform1i(gl2.getUniformLocation(prog, "u_lut"), 1);
  gl2.uniform1f(gl2.getUniformLocation(prog, "u_lutSize"), lut.size);

  gl2.viewport(0, 0, 88, 88);
  gl2.drawArrays(gl2.TRIANGLES, 0, 6);
}

function compilarShaderGL(contexto, tipo, fonte) {
  const s = contexto.createShader(tipo);
  contexto.shaderSource(s, fonte);
  contexto.compileShader(s);
  if (!contexto.getShaderParameter(s, contexto.COMPILE_STATUS)) {
    console.error(contexto.getShaderInfoLog(s));
    return null;
  }
  return s;
}

// ---------- Carrega todos os presets ----------
async function carregarTodosPresets() {
  const carregados = [];

  for (const p of PRESETS) {
    try {
      const lut = await carregarCube(p.arquivo);
      carregados.push({ nome: p.nome, size: lut.size, data: lut.data });
    } catch (erro) {
      console.error(`Não foi possível carregar ${p.nome}:`, erro);
    }
  }

  presetsCarregados = carregados;
}

// ---------- Monta a UI de presets ----------
function montarListaPresets() {
  listaPresets.innerHTML = "";

  if (presetsCarregados.length === 0) {
    listaPresets.innerHTML = `<div style="color:var(--text-faint); font-size:12px; padding:12px;">Nenhum preset configurado. Veja o editor.js.</div>`;
    return;
  }

  // Adiciona opção "Original"
  const btnOrig = document.createElement("button");
  btnOrig.className = "editor-preset ativo";
  btnOrig.dataset.index = "-1";
  btnOrig.innerHTML = `
    <div class="editor-preset-thumb">
      <canvas></canvas>
    </div>
    <div class="editor-preset-nome">Original</div>
  `;
  listaPresets.appendChild(btnOrig);

  // Cria miniatura da imagem original
  const canvasOrig = btnOrig.querySelector("canvas");
  if (imagemOriginal && gl) {
    // Renderiza miniatura sem LUT aplicado
    renderThumbSemLUT(canvasOrig);
  }

  presetsCarregados.forEach((p, i) => {
    const btn = document.createElement("button");
    btn.className = "editor-preset";
    btn.dataset.index = i;
    btn.innerHTML = `
      <div class="editor-preset-thumb">
        <canvas></canvas>
      </div>
      <div class="editor-preset-nome">${p.nome}</div>
    `;
    listaPresets.appendChild(btn);

    if (imagemOriginal && gl) {
      const c = btn.querySelector("canvas");
      renderThumb(c, p);
    }
  });

  // Handler de clique
  listaPresets.querySelectorAll(".editor-preset").forEach((btn) => {
    btn.addEventListener("click", () => {
      listaPresets.querySelectorAll(".editor-preset").forEach((b) => b.classList.remove("ativo"));
      btn.classList.add("ativo");

      const idx = parseInt(btn.dataset.index, 10);
      presetAtual = idx === -1 ? null : presetsCarregados[idx];
      desenhar();
    });
  });
}

function renderThumbSemLUT(miniCanvas) {
  const gl2 = miniCanvas.getContext("webgl2", { preserveDrawingBuffer: true });
  if (!gl2) return;
  miniCanvas.width = 88;
  miniCanvas.height = 88;

  const vs = compilarShaderGL(gl2, gl2.VERTEX_SHADER, `#version 300 es
    in vec2 a_position;
    in vec2 a_texCoord;
    out vec2 v_texCoord;
    void main() {
      gl_Position = vec4(a_position, 0.0, 1.0);
      v_texCoord = a_texCoord;
    }
  `);
  const fs = compilarShaderGL(gl2, gl2.FRAGMENT_SHADER, `#version 300 es
    precision highp float;
    in vec2 v_texCoord;
    out vec4 outColor;
    uniform sampler2D u_image;
    void main() {
      outColor = texture(u_image, v_texCoord);
    }
  `);

  const prog = gl2.createProgram();
  gl2.attachShader(prog, vs);
  gl2.attachShader(prog, fs);
  gl2.linkProgram(prog);
  gl2.useProgram(prog);

  const buf = gl2.createBuffer();
  gl2.bindBuffer(gl2.ARRAY_BUFFER, buf);
  gl2.bufferData(gl2.ARRAY_BUFFER, new Float32Array([
    -1,-1, 0,1,  1,-1, 1,1,  -1,1, 0,0,
    -1,1, 0,0,   1,-1, 1,1,   1,1, 1,0,
  ]), gl2.STATIC_DRAW);

  const pL = gl2.getAttribLocation(prog, "a_position");
  const tL = gl2.getAttribLocation(prog, "a_texCoord");
  gl2.enableVertexAttribArray(pL);
  gl2.enableVertexAttribArray(tL);
  gl2.vertexAttribPointer(pL, 2, gl2.FLOAT, false, 16, 0);
  gl2.vertexAttribPointer(tL, 2, gl2.FLOAT, false, 16, 8);

  const texImg = gl2.createTexture();
  gl2.bindTexture(gl2.TEXTURE_2D, texImg);
  gl2.pixelStorei(gl2.UNPACK_FLIP_Y_WEBGL, true);
  gl2.texImage2D(gl2.TEXTURE_2D, 0, gl2.RGBA, gl2.RGBA, gl2.UNSIGNED_BYTE, imagemOriginal);
  gl2.texParameteri(gl2.TEXTURE_2D, gl2.TEXTURE_MIN_FILTER, gl2.LINEAR);
  gl2.texParameteri(gl2.TEXTURE_2D, gl2.TEXTURE_MAG_FILTER, gl2.LINEAR);

  gl2.activeTexture(gl2.TEXTURE0);
  gl2.bindTexture(gl2.TEXTURE_2D, texImg);
  gl2.uniform1i(gl2.getUniformLocation(prog, "u_image"), 0);

  gl2.viewport(0, 0, 88, 88);
  gl2.drawArrays(gl2.TRIANGLES, 0, 6);
}

// ---------- Download em alta qualidade ----------
async function baixarFotoProcessada() {
  if (!imagemOriginal || !gl) return;

  editorLoading.classList.remove("hidden");
  editorLoadingTexto.textContent = "Processando em alta qualidade...";

  // Cria canvas temporário no tamanho original
  const cTemp = document.createElement("canvas");
  cTemp.width = imagemOriginal.width;
  cTemp.height = imagemOriginal.height;

  const glTemp = cTemp.getContext("webgl2", { preserveDrawingBuffer: true });
  if (!glTemp) {
    alert("Erro ao processar em alta qualidade.");
    editorLoading.classList.add("hidden");
    return;
  }

  // Compila shaders do zero pra esse contexto
  const vs = compilarShaderGL(glTemp, glTemp.VERTEX_SHADER, `#version 300 es
    in vec2 a_position;
    in vec2 a_texCoord;
    out vec2 v_texCoord;
    void main() {
      gl_Position = vec4(a_position, 0.0, 1.0);
      v_texCoord = a_texCoord;
    }
  `);
  const fs = compilarShaderGL(glTemp, glTemp.FRAGMENT_SHADER, `#version 300 es
    precision highp float;
    precision highp sampler3D;
    in vec2 v_texCoord;
    out vec4 outColor;
    uniform sampler2D u_image;
    uniform sampler3D u_lut;
    uniform float u_lutSize;
    uniform float u_intensity;
    void main() {
      vec4 cor = texture(u_image, v_texCoord);
      float escala = (u_lutSize - 1.0) / u_lutSize;
      float offset = 0.5 / u_lutSize;
      vec3 coord = cor.rgb * escala + offset;
      vec3 corLut = texture(u_lut, coord).rgb;
      vec3 resultado = mix(cor.rgb, corLut, u_intensity);
      outColor = vec4(resultado, cor.a);
    }
  `);
  const prog = glTemp.createProgram();
  glTemp.attachShader(prog, vs);
  glTemp.attachShader(prog, fs);
  glTemp.linkProgram(prog);
  glTemp.useProgram(prog);

  const buf = glTemp.createBuffer();
  glTemp.bindBuffer(glTemp.ARRAY_BUFFER, buf);
  glTemp.bufferData(glTemp.ARRAY_BUFFER, new Float32Array([
    -1,-1, 0,1,  1,-1, 1,1,  -1,1, 0,0,
    -1,1, 0,0,   1,-1, 1,1,   1,1, 1,0,
  ]), glTemp.STATIC_DRAW);

  const pL = glTemp.getAttribLocation(prog, "a_position");
  const tL = glTemp.getAttribLocation(prog, "a_texCoord");
  glTemp.enableVertexAttribArray(pL);
  glTemp.enableVertexAttribArray(tL);
  glTemp.vertexAttribPointer(pL, 2, glTemp.FLOAT, false, 16, 0);
  glTemp.vertexAttribPointer(tL, 2, glTemp.FLOAT, false, 16, 8);

  // Textura da imagem
  const texImg = glTemp.createTexture();
  glTemp.bindTexture(glTemp.TEXTURE_2D, texImg);
  glTemp.pixelStorei(glTemp.UNPACK_FLIP_Y_WEBGL, true);
  glTemp.texImage2D(glTemp.TEXTURE_2D, 0, glTemp.RGBA, glTemp.RGBA, glTemp.UNSIGNED_BYTE, imagemOriginal);
  glTemp.texParameteri(glTemp.TEXTURE_2D, glTemp.TEXTURE_MIN_FILTER, glTemp.LINEAR);
  glTemp.texParameteri(glTemp.TEXTURE_2D, glTemp.TEXTURE_MAG_FILTER, glTemp.LINEAR);

  // LUT
  const texLut = glTemp.createTexture();
  glTemp.bindTexture(glTemp.TEXTURE_3D, texLut);

  const lutParaUsar = presetAtual ? presetAtual : {
    size: 2,
    data: new Float32Array([0,0,0, 1,0,0, 0,1,0, 1,1,0, 0,0,1, 1,0,1, 0,1,1, 1,1,1])
  };

  glTemp.texImage3D(glTemp.TEXTURE_3D, 0, glTemp.RGB32F, lutParaUsar.size, lutParaUsar.size, lutParaUsar.size, 0, glTemp.RGB, glTemp.FLOAT, lutParaUsar.data);
  glTemp.texParameteri(glTemp.TEXTURE_3D, glTemp.TEXTURE_MIN_FILTER, glTemp.LINEAR);
  glTemp.texParameteri(glTemp.TEXTURE_3D, glTemp.TEXTURE_MAG_FILTER, glTemp.LINEAR);
  glTemp.texParameteri(glTemp.TEXTURE_3D, glTemp.TEXTURE_WRAP_S, glTemp.CLAMP_TO_EDGE);
  glTemp.texParameteri(glTemp.TEXTURE_3D, glTemp.TEXTURE_WRAP_T, glTemp.CLAMP_TO_EDGE);
  glTemp.texParameteri(glTemp.TEXTURE_3D, glTemp.TEXTURE_WRAP_R, glTemp.CLAMP_TO_EDGE);

  glTemp.activeTexture(glTemp.TEXTURE0);
  glTemp.bindTexture(glTemp.TEXTURE_2D, texImg);
  glTemp.uniform1i(glTemp.getUniformLocation(prog, "u_image"), 0);
  glTemp.activeTexture(glTemp.TEXTURE1);
  glTemp.bindTexture(glTemp.TEXTURE_3D, texLut);
  glTemp.uniform1i(glTemp.getUniformLocation(prog, "u_lut"), 1);
  glTemp.uniform1f(glTemp.getUniformLocation(prog, "u_lutSize"), lutParaUsar.size);
  glTemp.uniform1f(glTemp.getUniformLocation(prog, "u_intensity"), presetAtual ? intensidade : 0);

  glTemp.viewport(0, 0, cTemp.width, cTemp.height);
  glTemp.drawArrays(glTemp.TRIANGLES, 0, 6);

  // Exporta
  cTemp.toBlob((blob) => {
    editorLoading.classList.add("hidden");
    if (!blob) {
      alert("Erro ao gerar arquivo.");
      return;
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `sinal-editado-${Date.now()}.jpg`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }, "image/jpeg", 0.95);
}

// ---------- Eventos ----------
document.getElementById("btnEscolherFoto").addEventListener("click", () => fileInput.click());
document.getElementById("btnTrocarFoto").addEventListener("click", () => fileInput.click());
document.getElementById("btnBaixar").addEventListener("click", baixarFotoProcessada);

fileInput.addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (!file) return;

  editorLoading.classList.remove("hidden");
  editorLoadingTexto.textContent = "Carregando foto...";

  try {
    imagemOriginal = await carregarImagem(file);

    // Se os presets ainda não foram carregados, tenta de novo agora
    if (presetsCarregados.length === 0 && PRESETS.length > 0) {
      await carregarTodosPresets();
    }

    editorVazio.style.display = "none";
    canvas.style.display = "block";
    editorPainel.style.display = "block";
    editorAcoes.style.display = "flex";

    presetAtual = null;
    intensidade = 1.0;
    intensidadeSlider.value = 100;
    intensidadeValor.textContent = "100%";

    desenhar();
    montarListaPresets();

    const faltando = PRESETS.length - presetsCarregados.length;
    if (faltando > 0) {
      editorStatus.textContent = `⚠️ ${faltando} preset(s) não carregado(s). Confira os arquivos em luts/`;
    } else if (presetsCarregados.length > 0) {
      editorStatus.textContent = `✓ ${presetsCarregados.length} preset(s) carregado(s)`;
    } else {
      editorStatus.textContent = "Nenhum preset configurado";
    }
  } catch (erro) {
    console.error(erro);
    alert("Erro ao carregar a foto.");
  } finally {
    editorLoading.classList.add("hidden");
    fileInput.value = "";
  }
});

intensidadeSlider.addEventListener("input", () => {
  intensidade = parseInt(intensidadeSlider.value, 10) / 100;
  intensidadeValor.textContent = intensidadeSlider.value + "%";
  if (presetAtual) desenhar();
});

// ---------- Inicialização ----------
(async () => {
  if (!initWebGL()) return;
  await carregarTodosPresets();

  if (presetsCarregados.length > 0) {
    editorStatus.textContent = `✓ ${presetsCarregados.length} preset(s) prontos`;
  } else if (PRESETS.length > 0) {
    editorStatus.textContent = `⚠️ Nenhum preset carregado. Verifique a pasta luts/`;
  }
})();
