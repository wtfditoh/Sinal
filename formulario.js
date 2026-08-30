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

let fotoPregadorUrl = null;
let fotoLouvorUrl = null;
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

// ---------- Upload de foto do pregador ----------
const uploadAreaPregador = document.getElementById("uploadAreaPregador");
const fotoPregadorUpload = document.getElementById("fotoPregadorUpload");
const fotoPregadorPreview = document.getElementById("fotoPregadorPreview");
const fotoPregadorPreviewImg = document.getElementById("fotoPregadorPreviewImg");
const fotoPregadorRemover = document.getElementById("fotoPregadorRemover");

if (uploadAreaPregador) {
  uploadAreaPregador.addEventListener("click", () => {
    if (!fotoEnviando) fotoPregadorUpload.click();
  });
}

if (fotoPregadorUpload) {
  fotoPregadorUpload.addEventListener("change", async (e) => {
    const arquivo = e.target.files[0];
    if (!arquivo) return;
    if (arquivo.size > 10 * 1024 * 1024) {
      alert("A foto é muito grande. Escolha uma imagem menor que 10MB.");
      return;
    }
    await enviarFoto(arquivo, "pregador");
  });
}

if (fotoPregadorRemover) {
  fotoPregadorRemover.addEventListener("click", (e) => {
    e.stopPropagation();
    fotoPregadorUrl = null;
    fotoPregadorPreview.style.display = "none";
    fotoPregadorUpload.value = "";
    document.getElementById("uploadIconePregador").textContent = "🖼️";
    document.getElementById("uploadTextoPregador").textContent = "Clique para escolher";
    document.getElementById("uploadHintPregador").textContent = "JPG ou PNG — máx 10MB";
  });
}

// ---------- Upload de foto do louvor ----------
const uploadAreaLouvor = document.getElementById("uploadAreaLouvor");
const fotoLouvorUpload = document.getElementById("fotoLouvorUpload");
const fotoLouvorPreview = document.getElementById("fotoLouvorPreview");
const fotoLouvorPreviewImg = document.getElementById("fotoLouvorPreviewImg");
const fotoLouvorRemover = document.getElementById("fotoLouvorRemover");

if (uploadAreaLouvor) {
  uploadAreaLouvor.addEventListener("click", () => {
    if (!fotoEnviando) fotoLouvorUpload.click();
  });
}

if (fotoLouvorUpload) {
  fotoLouvorUpload.addEventListener("change", async (e) => {
    const arquivo = e.target.files[0];
    if (!arquivo) return;
    if (arquivo.size > 10 * 1024 * 1024) {
      alert("A foto é muito grande. Escolha uma imagem menor que 10MB.");
      return;
    }
    await enviarFoto(arquivo, "louvor");
  });
}

if (fotoLouvorRemover) {
  fotoLouvorRemover.addEventListener("click", (e) => {
    e.stopPropagation();
    fotoLouvorUrl = null;
    fotoLouvorPreview.style.display = "none";
    fotoLouvorUpload.value = "";
    document.getElementById("uploadIconeLouvor").textContent = "🖼️";
    document.getElementById("uploadTextoLouvor").textContent = "Clique para escolher";
    document.getElementById("uploadHintLouvor").textContent = "JPG ou PNG — máx 10MB";
  });
}

async function enviarFoto(arquivo, tipo) {
  fotoEnviando = true;
  
  const prefixo = tipo === "pregador" ? "Pregador" : "Louvor";
  const uploadIcone = document.getElementById(`uploadIcone${prefixo}`);
  const uploadTexto = document.getElementById(`uploadTexto${prefixo}`);
  const uploadHint = document.getElementById(`uploadHint${prefixo}`);
  
  uploadIcone.textContent = "⏳";
  uploadTexto.textContent = "Enviando foto...";
  uploadHint.textContent = "Isso pode levar alguns segundos";
  
  try {
    const base64 = await converterParaBase64(arquivo);
    
    const formData = new FormData();
    formData.append("key", IMGBB_API_KEY);
    formData.append("image", base64.split(",")[1]);
    
    const resposta = await fetch("https://api.imgbb.com/1/upload", {
      method: "POST",
      body: formData
    });
    
    if (!resposta.ok) throw new Error("Falha no upload");
    
    const dados = await resposta.json();
    
    if (dados.success) {
      if (tipo === "pregador") {
        fotoPregadorUrl = dados.data.url;
        fotoPregadorPreviewImg.src = fotoPregadorUrl;
        fotoPregadorPreview.style.display = "block";
      } else {
        fotoLouvorUrl = dados.data.url;
        fotoLouvorPreviewImg.src = fotoLouvorUrl;
        fotoLouvorPreview.style.display = "block";
      }
      
      uploadIcone.textContent = "✅";
      uploadTexto.textContent = "Foto enviada!";
      uploadHint.textContent = "Clique para trocar";
    } else {
      throw new Error("Erro no upload");
    }
  } catch (erro) {
    console.error("Erro ao enviar foto:", erro);
    alert("Não foi possível enviar a foto. Tente novamente.");
    
    uploadIcone.textContent = "🖼️";
    uploadTexto.textContent = "Clique para escolher";
    uploadHint.textContent = "JPG ou PNG — máx 10MB";
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
        fotoPregadorUrl: fotoPregadorUrl,
        fotoLouvorUrl: fotoLouvorUrl,
        fotosEnviadasEm: (fotoPregadorUrl || fotoLouvorUrl) ? serverTimestamp() : null
      },
      respondidoEm: serverTimestamp()
    });

    // Dispara notificação push para a equipe
    const nomeLider = document.getElementById("rNome").value.trim();
    const pregador = document.getElementById("rPregador").value.trim() || "não informado";
    const tema = document.getElementById("rTema").value.trim() || "não informado";

    try {
      await fetch("https://sinalpv.netlify.app/.netlify/functions/enviar-notificacao", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          titulo: "✅ Formulário respondido!",
          mensagem: `${nomeLider} respondeu o formulário. Pregador: ${pregador}. Tema: ${tema}. Confira no app.`,
          link: "https://sinalpv.netlify.app/dashboard.html",
          imagem: fotoPregadorUrl || fotoLouvorUrl || null
        })
      });
    } catch (erroNotificacao) {
      console.error("Erro ao notificar equipe:", erroNotificacao);
      // Não bloqueia o envio do formulário se a notificação falhar
    }
    
    mostrar(enviado);
  } catch (erro) {
    console.error("Erro ao enviar resposta:", erro);
    errorBox.classList.add("active");
    btn.disabled = false;
    btnTexto.textContent = "📨 Enviar informações";
  }
});

iniciar();
