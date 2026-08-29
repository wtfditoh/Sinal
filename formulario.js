import { db } from "./firebase-config.js";
import {
  doc, getDoc, updateDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// API key do ImgBB
const IMGBB_API_KEY = "5e3b2c6eae12635e0d9b00e9af54edb6";

const params = new URLSearchParams(window.location.search);
const id = params.get("id");

const carregando = document.getElementById("carregando");
const naoEncontrado = document.getElementById("naoEncontrado");
const jaRespondido = document.getElementById("jaRespondido");
const conteudo = document.getElementById("conteudo");
const enviado = document.getElementById("enviado");

let fotoUrl = null;
let fotoEnviando = false;

async function iniciar() {
  if (!id) {
    mostrar(naoEncontrado);
    return;
  }

  try {
    const snap = await getDoc(doc(db, "solicitacoes", id));
    if (!snap.exists()) {
      mostrar(naoEncontrado);
      return;
    }
    const s = snap.data();
    if (s.status !== "aguardando") {
      mostrar(jaRespondido);
      return;
    }

    document.getElementById("tituloSolicitacao").textContent = s.titulo;
    mostrar(conteudo);

    // Marca que o link foi aberto
    if (!s.visualizadoEm) {
      updateDoc(doc(db, "solicitacoes", id), { visualizadoEm: serverTimestamp() }).catch(() => {});
    }
  } catch (erro) {
    console.error("Erro ao carregar solicitação:", erro);
    mostrar(naoEncontrado);
  }
}

function mostrar(elemento) {
  [carregando, naoEncontrado, jaRespondido, conteudo, enviado].forEach(el => el.style.display = "none");
  elemento.style.display = "block";
}

// ---------- Upload de foto ----------
const uploadArea = document.getElementById("uploadAreaFoto");
const fotoUpload = document.getElementById("fotoUpload");
const fotoPreview = document.getElementById("fotoPreview");
const fotoPreviewImg = document.getElementById("fotoPreviewImg");
const fotoRemover = document.getElementById("fotoRemover");

if (uploadArea) {
  uploadArea.addEventListener("click", () => {
    if (!fotoEnviando) {
      fotoUpload.click();
    }
  });
}

if (fotoUpload) {
  fotoUpload.addEventListener("change", async (e) => {
    const arquivo = e.target.files[0];
    if (!arquivo) return;
    
    // Verifica tamanho (máx 10MB)
    if (arquivo.size > 10 * 1024 * 1024) {
      alert("A foto é muito grande. Escolha uma imagem menor que 10MB.");
      return;
    }
    
    await enviarFoto(arquivo);
  });
}

if (fotoRemover) {
  fotoRemover.addEventListener("click", (e) => {
    e.stopPropagation();
    fotoUrl = null;
    fotoPreview.style.display = "none";
    fotoUpload.value = "";
    document.getElementById("uploadIcone").textContent = "🖼️";
    document.getElementById("uploadTexto").textContent = "Clique para escolher uma foto";
    document.getElementById("uploadHint").textContent = "JPG, PNG ou GIF — máximo 10MB";
  });
}

async function enviarFoto(arquivo) {
  fotoEnviando = true;
  
  document.getElementById("uploadIcone").textContent = "⏳";
  document.getElementById("uploadTexto").textContent = "Enviando foto...";
  document.getElementById("uploadHint").textContent = "Isso pode levar alguns segundos";
  
  try {
    // Converte a imagem para base64
    const base64 = await converterParaBase64(arquivo);
    
    // Faz upload para o ImgBB
    const formData = new FormData();
    formData.append("key", IMGBB_API_KEY);
    formData.append("image", base64.split(",")[1]);
    
    const resposta = await fetch("https://api.imgbb.com/1/upload", {
      method: "POST",
      body: formData
    });
    
    if (!resposta.ok) {
      throw new Error("Falha no upload");
    }
    
    const dados = await resposta.json();
    
    if (dados.success) {
      fotoUrl = dados.data.url;
      
      fotoPreviewImg.src = fotoUrl;
      fotoPreview.style.display = "block";
      
      document.getElementById("uploadIcone").textContent = "✅";
      document.getElementById("uploadTexto").textContent = "Foto enviada com sucesso!";
      document.getElementById("uploadHint").textContent = "Clique para trocar a foto";
    } else {
      throw new Error("Erro no upload");
    }
  } catch (erro) {
    console.error("Erro ao enviar foto:", erro);
    alert("Não foi possível enviar a foto. Tente novamente.");
    
    document.getElementById("uploadIcone").textContent = "🖼️";
    document.getElementById("uploadTexto").textContent = "Clique para escolher uma foto";
    document.getElementById("uploadHint").textContent = "JPG, PNG ou GIF — máximo 10MB";
  } finally {
    fotoEnviando = false;
  }
}

function converterParaBase64(arquivo) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(arquivo);
  });
}

// ---------- Envio do formulário ----------
document.getElementById("formResposta").addEventListener("submit", async (e) => {
  e.preventDefault();
  const btn = document.getElementById("respostaBtn");
  const btnTexto = document.getElementById("btnTexto");
  const errorBox = document.getElementById("respostaError");
  
  errorBox.classList.remove("active");
  btn.disabled = true;
  btnTexto.innerHTML = '<span class="loading-spinner" style="display:inline-block;"></span> Enviando...';

  try {
    await updateDoc(doc(db, "solicitacoes", id), {
      status: "respondido",
      resposta: {
        nomeLider: document.getElementById("rNome").value.trim(),
        pregador: document.getElementById("rPregador").value.trim(),
        tema: document.getElementById("rTema").value.trim(),
        versiculo: document.getElementById("rVersiculo").value.trim(),
        eventoParte: document.getElementById("rEventoParte").value.trim(),
        fotoUrl: fotoUrl,
        fotoEnviadaEm: fotoUrl ? serverTimestamp() : null
      },
      respondidoEm: serverTimestamp()
    });
    
    mostrar(enviado);
  } catch (erro) {
    console.error("Erro ao enviar resposta:", erro);
    errorBox.classList.add("active");
    btn.disabled = false;
    btnTexto.textContent = "📨 Enviar informações";
  }
});

iniciar();
