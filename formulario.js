import { db } from "./firebase-config.js";
import {
  doc, getDoc, updateDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const params = new URLSearchParams(window.location.search);
const id = params.get("id");

const carregando = document.getElementById("carregando");
const naoEncontrado = document.getElementById("naoEncontrado");
const jaRespondido = document.getElementById("jaRespondido");
const conteudo = document.getElementById("conteudo");
const enviado = document.getElementById("enviado");

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
  } catch (erro) {
    console.error("Erro ao carregar solicitação:", erro);
    mostrar(naoEncontrado);
  }
}

function mostrar(elemento) {
  [carregando, naoEncontrado, jaRespondido, conteudo, enviado].forEach(el => el.style.display = "none");
  elemento.style.display = "block";
}

document.getElementById("formResposta").addEventListener("submit", async (e) => {
  e.preventDefault();
  const btn = document.getElementById("respostaBtn");
  const errorBox = document.getElementById("respostaError");
  errorBox.classList.remove("active");
  btn.textContent = "Enviando...";
  btn.disabled = true;

  try {
    await updateDoc(doc(db, "solicitacoes", id), {
      status: "respondido",
      resposta: {
        nomeLider: document.getElementById("rNome").value.trim(),
        pregador: document.getElementById("rPregador").value.trim(),
        tema: document.getElementById("rTema").value.trim(),
        versiculo: document.getElementById("rVersiculo").value.trim(),
        eventoParte: document.getElementById("rEventoParte").value.trim()
      },
      respondidoEm: serverTimestamp()
    });
    mostrar(enviado);
  } catch (erro) {
    console.error("Erro ao enviar resposta:", erro);
    errorBox.classList.add("active");
    btn.textContent = "Enviar";
    btn.disabled = false;
  }
});

iniciar();
