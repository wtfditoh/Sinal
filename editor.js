// ========================================
// CONFIGURAÇÃO DOS PRESETS
// ========================================
// Coloque seus arquivos .cube na pasta "luts/"
// e cadastre aqui:

const PRESETS = [
  { nome: "Meu Preset", arquivo: "luts/Feed2026.cube" },
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
let presetsCarregados = [];
let presetAtual = null;
let intensidade = 1.0;

const VERTEX_SHADER = `#version 300 es
  in vec2 a_position;
  in vec2 a_texCoord;
  out vec2 v_texCoord;
  void main() {
    gl_Position = vec4(a_position, 0.0, 1.0);
    v_texCoord = a_texCoord;
  }
`;

const FRAGMENT_SHADER = `#version 300 es
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
`;

// Vertices: sem flip, sem UNPACK_FLIP
const VERTICES = new Float32Array([
  -1, -1,  0, 0,
   1, -1,  1, 0,
  -1,  1,  0, 1,
  -1,  1,  0, 1,
   1, -1,  1, 0,
   1,  1,  1, 1,
]);

function compilarShader(contexto, tipo, fonte) {
  const s = contexto.createShader(tipo);
  contexto.shaderSource(s, fonte);
  contexto.compileShader(s);
  if (!contexto.getShaderParameter(s, contexto.COMPILE_STATUS)) {
    console.error("Erro shader:", contexto.getShaderInfoLog(s));
    return null;
  }
  return s;
}

function criarPrograma(contexto) {
  const vs = compilarShader(contexto, contexto.VERTEX_SHADER, VERTEX_SHADER);
  const fs = compilarShader(contexto, contexto.FRAGMENT_SHADER, FRAGMENT_SHADER);
  if (!vs || !fs) return null;

  const prog = contexto.createProgram();
  contexto.attachShader(prog, vs);
  contexto.attachShader(prog, fs);
  contexto.linkProgram(prog);

  if (!contexto.getProgramParameter(prog, contexto.LINK_STATUS)) {
    console.error("Erro link:", contexto.getProgramInfoLog(prog));
    return null;
  }
  return prog;
}

function configurarQuad(contexto, prog) {
  const buffer = contexto.createBuffer();
  contexto.bindBuffer(contexto.ARRAY_BUFFER, buffer);
  contexto.bufferData(contexto.ARRAY_BUFFER, VERTICES, contexto.STATIC_DRAW);

  const posLoc = contexto.getAttribLocation(prog, "a_position");
  const texLoc = contexto.getAttribLocation(prog, "a_texCoord");
  contexto.enableVertexAttribArray(posLoc);
  contexto.enableVertexAttribArray(texLoc);
  contexto.vertexAttribPointer(posLoc, 2, contexto.FLOAT, false, 16, 0);
  contexto.vertexAttribPointer(texLoc, 2, contexto.FLOAT, false, 16, 8);
}

// Converte Float32 [0..1] pra Uint8 [0..255] com alpha
function lutFloatParaRGBA8(lutSize, lutData) {
  const total = lutSize * lutSize * lutSize;
  const pixels = new Uint8Array(total * 4);
  for (let i = 0; i < total; i++) {
    pixels[i * 4 + 0] = Math.max(0, Math.min(255, Math.round(lutData[i * 3 + 0] * 255)));
    pixels[i * 4 + 1] = Math.max(0, Math.min(255, Math.round(lutData[i * 3 + 1] * 255)));
    pixels[i * 4 + 2] = Math.max(0, Math.min(255, Math.round(lutData[i * 3 + 2] * 255)));
    pixels[i * 4 + 3] = 255;
  }
  return pixels;
}

function criarTexturaLUT(contexto, lut) {
  const pixels = lutFloatParaRGBA8(lut.size, lut.data);

  const tex = contexto.createTexture();
  contexto.bindTexture(contexto.TEXTURE_3D, tex);
  contexto.texImage3D(
    contexto.TEXTURE_3D, 0, contexto.RGBA,
    lut.size, lut.size, lut.size, 0,
    contexto.RGBA, contexto.UNSIGNED_BYTE, pixels
  );
  contexto.texParameteri(contexto.TEXTURE_3D, contexto.TEXTURE_MIN_FILTER, contexto.LINEAR);
  contexto.texParameteri(contexto.TEXTURE_3D, contexto.TEXTURE_MAG_FILTER, contexto.LINEAR);
  contexto.texParameteri(contexto.TEXTURE_3D, contexto.TEXTURE_WRAP_S, contexto.CLAMP_TO_EDGE);
  contexto.texParameteri(contexto.TEXTURE_3D, contexto.TEXTURE_WRAP_T, contexto.CLAMP_TO_EDGE);
  contexto.texParameteri(contexto.TEXTURE_3D, contexto.TEXTURE_WRAP_R, contexto.CLAMP_TO_EDGE);

  return tex;
}

function criarTexturaImagem(contexto, img) {
  const tex = contexto.createTexture();
  contexto.bindTexture(contexto.TEXTURE_2D, tex);
  contexto.pixelStorei(contexto.UNPACK_FLIP_Y_WEBGL, false);
  contexto.texImage2D(contexto.TEXTURE_2D, 0, contexto.RGBA, contexto.RGBA, contexto.UNSIGNED_BYTE, img);
  contexto.texParameteri(contexto.TEXTURE_2D, contexto.TEXTURE_MIN_FILTER, contexto.LINEAR);
  contexto.texParameteri(contexto.TEXTURE_2D, contexto.TEXTURE_MAG_FILTER, contexto.LINEAR);
  contexto.texParameteri(contexto.TEXTURE_2D, contexto.TEXTURE_WRAP_S, contexto.CLAMP_TO_EDGE);
  contexto.texParameteri(contexto.TEXTURE_2D, contexto.TEXTURE_WRAP_T, contexto.CLAMP_TO_EDGE);
  return tex;
}

function initWebGL() {
  gl = canvas.getContext("webgl2", { preserveDrawingBuffer: true, premultipliedAlpha: false });
  if (!gl) {
    alert("Seu navegador não suporta WebGL2. Tente atualizar.");
    return false;
  }
  programa = criarPrograma(gl);
  if (!programa) return false;
  configurarQuad(gl, programa);
  return true;
}

async function carregarCube(url) {
  const resposta = await fetch(url);
  if (!resposta.ok) throw new Error("Não achou: " + url);
  const texto = await resposta.text();

  const linhas = texto.split(/\r?\n/);
  let size = 0;
  const dados = [];

  for (const linha of linhas) {
    const l = linha.trim();
    if (!l || l.startsWith("#")) continue;
    if (l.startsWith("LUT_3D_SIZE")) { size = parseInt(l.split(/\s+/)[1], 10); continue; }
    if (l.startsWith("TITLE") || l.startsWith("DOMAIN_MIN") || l.startsWith("DOMAIN_MAX")) continue;

    const partes = l.split(/\s+/);
    if (partes.length === 3) {
      const r = parseFloat(partes[0]);
      const g = parseFloat(partes[1]);
      const b = parseFloat(partes[2]);
      if (!isNaN(r) && !isNaN(g) && !isNaN(b)) dados.push(r, g, b);
    }
  }

  if (!size || dados.length !== size * size * size * 3) {
    throw new Error("LUT inválida. Esperado " + (size*size*size*3) + " valores, recebido " + dados.length);
  }

  return { size, data: new Float32Array(dados) };
}

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

function desenhar() {
  if (!imagemOriginal || !gl || !programa) return;

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

  if (texturaImagem) gl.deleteTexture(texturaImagem);
  texturaImagem = criarTexturaImagem(gl, imagemOriginal);

  if (texturaLUT) gl.deleteTexture(texturaLUT);
  const lutParaUsar = presetAtual || {
    size: 2,
    data: new Float32Array([0,0,0, 1,0,0, 0,1,0, 1,1,0, 0,0,1, 1,0,1, 0,1,1, 1,1,1])
  };
  texturaLUT = criarTexturaLUT(gl, lutParaUsar);

  gl.useProgram(programa);

  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, texturaImagem);
  gl.uniform1i(gl.getUniformLocation(programa, "u_image"), 0);

  gl.activeTexture(gl.TEXTURE1);
  gl.bindTexture(gl.TEXTURE_3D, texturaLUT);
  gl.uniform1i(gl.getUniformLocation(programa, "u_lut"), 1);

  gl.uniform1f(gl.getUniformLocation(programa, "u_lutSize"), lutParaUsar.size);
  gl.uniform1f(gl.getUniformLocation(programa, "u_intensity"), presetAtual ? intensidade : 0);

  gl.drawArrays(gl.TRIANGLES, 0, 6);
}

function renderThumb(miniCanvas, lut) {
  const gl2 = miniCanvas.getContext("webgl2", { preserveDrawingBuffer: true });
  if (!gl2) return;

  miniCanvas.width = 88;
  miniCanvas.height = 88;

  const prog = criarPrograma(gl2);
  if (!prog) return;
  configurarQuad(gl2, prog);
  gl2.useProgram(prog);

  const texImg = criarTexturaImagem(gl2, imagemOriginal);
  const texLut = lut ? criarTexturaLUT(gl2, lut) : criarTexturaLUT(gl2, {
    size: 2,
    data: new Float32Array([0,0,0, 1,0,0, 0,1,0, 1,1,0, 0,0,1, 1,0,1, 0,1,1, 1,1,1])
  });

  gl2.activeTexture(gl2.TEXTURE0);
  gl2.bindTexture(gl2.TEXTURE_2D, texImg);
  gl2.uniform1i(gl2.getUniformLocation(prog, "u_image"), 0);

  gl2.activeTexture(gl2.TEXTURE1);
  gl2.bindTexture(gl2.TEXTURE_3D, texLut);
  gl2.uniform1i(gl2.getUniformLocation(prog, "u_lut"), 1);

  gl2.uniform1f(gl2.getUniformLocation(prog, "u_lutSize"), lut ? lut.size : 2);
  gl2.uniform1f(gl2.getUniformLocation(prog, "u_intensity"), lut ? 1.0 : 0.0);

  gl2.viewport(0, 0, 88, 88);
  gl2.drawArrays(gl2.TRIANGLES, 0, 6);
}

async function carregarTodosPresets() {
  const carregados = [];
  for (const p of PRESETS) {
    try {
      const lut = await carregarCube(p.arquivo);
      carregados.push({ nome: p.nome, size: lut.size, data: lut.data });
      console.log("Preset carregado:", p.nome, lut.size + "x" + lut.size + "x" + lut.size);
    } catch (erro) {
      console.error("Falha ao carregar " + p.nome + ":", erro);
    }
  }
  presetsCarregados = carregados;
}

function montarListaPresets() {
  listaPresets.innerHTML = "";

  if (presetsCarregados.length === 0) {
    listaPresets.innerHTML = `<div style="color:var(--text-faint); font-size:12px; padding:12px;">Nenhum preset. Verifique a pasta luts/</div>`;
    return;
  }

  // Botão "Original"
  const btnOrig = document.createElement("button");
  btnOrig.className = "editor-preset ativo";
  btnOrig.dataset.index = "-1";
  btnOrig.innerHTML = `<div class="editor-preset-thumb"><canvas></canvas></div><div class="editor-preset-nome">Original</div>`;
  listaPresets.appendChild(btnOrig);
  renderThumb(btnOrig.querySelector("canvas"), null);

  // Botões de cada preset
  presetsCarregados.forEach((p, i) => {
    const btn = document.createElement("button");
    btn.className = "editor-preset";
    btn.dataset.index = i;
    btn.innerHTML = `<div class="editor-preset-thumb"><canvas></canvas></div><div class="editor-preset-nome">${p.nome}</div>`;
    listaPresets.appendChild(btn);
    renderThumb(btn.querySelector("canvas"), p);
  });

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

async function baixarFotoProcessada() {
  if (!imagemOriginal) return;

  editorLoading.classList.remove("hidden");
  editorLoadingTexto.textContent = "Processando em alta qualidade...";

  const cTemp = document.createElement("canvas");
  cTemp.width = imagemOriginal.width;
  cTemp.height = imagemOriginal.height;

  const glTemp = cTemp.getContext("webgl2", { preserveDrawingBuffer: true });
  if (!glTemp) {
    alert("Erro ao processar.");
    editorLoading.classList.add("hidden");
    return;
  }

  const prog = criarPrograma(glTemp);
  if (!prog) {
    alert("Erro ao processar.");
    editorLoading.classList.add("hidden");
    return;
  }
  configurarQuad(glTemp, prog);
  glTemp.useProgram(prog);

  const texImg = criarTexturaImagem(glTemp, imagemOriginal);
  const lutParaUsar = presetAtual || {
    size: 2,
    data: new Float32Array([0,0,0, 1,0,0, 0,1,0, 1,1,0, 0,0,1, 1,0,1, 0,1,1, 1,1,1])
  };
  const texLut = criarTexturaLUT(glTemp, lutParaUsar);

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
      editorStatus.textContent = `⚠️ ${faltando} preset(s) não carregado(s)`;
    } else if (presetsCarregados.length > 0) {
      editorStatus.textContent = `✓ ${presetsCarregados.length} preset(s) prontos`;
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

(async () => {
  if (!initWebGL()) return;
  await carregarTodosPresets();

  if (presetsCarregados.length > 0) {
    editorStatus.textContent = `✓ ${presetsCarregados.length} preset(s) prontos`;
  } else if (PRESETS.length > 0) {
    editorStatus.textContent = `⚠️ Nenhum preset carregado. Verifique a pasta luts/`;
  }
})();
