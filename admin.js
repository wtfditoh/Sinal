// ===============================
// SINAL ADMIN • admin.js
// ===============================

import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  collection, addDoc, updateDoc, doc, getDocs,
  query, where, orderBy, limit, serverTimestamp, Timestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";


// ===============================
// VARIÁVEIS
// ===============================

let usuarioAtual = null;

let tituloAtual = "";
let mensagemAtual = "";
let tipoAtual = "geral";
let corAtual = "#FFB020";


// ===============================
// ELEMENTOS
// ===============================

const tituloInput = document.getElementById("titulo");
const mensagemInput = document.getElementById("mensagem");
const destinoSelect = document.getElementById("destino");
const imagemInput = document.getElementById("imagemUrl");

const tituloCount = document.getElementById("tituloCount");
const mensagemCount = document.getElementById("mensagemCount");

const previewTitulo = document.getElementById("previewTitulo");
const previewMensagem = document.getElementById("previewMensagem");
const previewImagem = document.getElementById("previewImagem");


// ===============================
// VERIFICA LOGIN ADMIN
// ===============================

onAuthStateChanged(auth, (usuario) => {

  if (!usuario) {
    window.location.href = "index.html";
    return;
  }

  usuarioAtual = usuario;
  console.log("Admin conectado:", usuario.email);

});


// ===============================
// CONTADORES DE TEXTO + PREVIEW
// ===============================

if (tituloInput) {
  tituloInput.addEventListener("input", () => {
    tituloAtual = tituloInput.value;
    tituloCount.textContent = tituloAtual.length;
    atualizarPreview();
  });
}

if (mensagemInput) {
  mensagemInput.addEventListener("input", () => {
    mensagemAtual = mensagemInput.value;
    mensagemCount.textContent = mensagemAtual.length;
    atualizarPreview();
  });
}

if (imagemInput) {
  imagemInput.addEventListener("input", () => {
    atualizarPreview();
  });
}


function atualizarPreview() {

  if (previewTitulo && previewMensagem) {
    previewTitulo.textContent = tituloAtual || "Título da notificação";
    previewMensagem.textContent = mensagemAtual || "A mensagem aparecerá aqui conforme você digita.";
  }

  if (previewImagem) {
    const url = imagemInput?.value.trim();
    if (url) {
      previewImagem.src = url;
      previewImagem.style.display = "block";
    } else {
      previewImagem.style.display = "none";
    }
  }

}


// ===============================
// CHIPS DE MENSAGENS RÁPIDAS
// ===============================

const chips = document.querySelectorAll(".chip");

chips.forEach((chip) => {

  chip.addEventListener("click", () => {

    const titulo = chip.dataset.title;
    const mensagem = chip.dataset.message;

    tituloInput.value = titulo;
    mensagemInput.value = mensagem;

    tituloAtual = titulo;
    mensagemAtual = mensagem;

    tipoAtual = chip.dataset.tipo || "geral";
    corAtual = chip.dataset.cor || "#FFB020";

    if (destinoSelect && chip.dataset.destino) {
      destinoSelect.value = chip.dataset.destino;
    }

    tituloCount.textContent = titulo.length;
    mensagemCount.textContent = mensagem.length;

    atualizarPreview();

  });

});


// ===============================
// MODAL DE CONFIRMAÇÃO
// ===============================

const btnEnviar = document.getElementById("btnEnviar");
const confirmModal = document.getElementById("confirmModal");
const cancelarEnvio = document.getElementById("cancelarEnvio");
const confirmarEnvio = document.getElementById("confirmarEnvio");


if (btnEnviar) {
  btnEnviar.addEventListener("click", () => {

    if (!tituloAtual || !mensagemAtual) {
      mostrarToast("Atenção", "Preencha o título e a mensagem.");
      return;
    }

    confirmModal.classList.remove("hidden");

  });
}

if (cancelarEnvio) {
  cancelarEnvio.addEventListener("click", () => {
    confirmModal.classList.add("hidden");
  });
}

if (confirmarEnvio) {
  confirmarEnvio.addEventListener("click", () => {
    confirmModal.classList.add("hidden");
    enviarNotificacao();
  });
}


// ===============================
// FUNÇÃO TOAST
// ===============================

function mostrarToast(titulo, mensagem) {

  const toast = document.getElementById("toast");
  const toastTitulo = document.getElementById("toastTitulo");
  const toastMensagem = document.getElementById("toastMensagem");

  toastTitulo.textContent = titulo;
  toastMensagem.textContent = mensagem;

  toast.classList.remove("hidden");

  setTimeout(() => {
    toast.classList.add("hidden");
  }, 4000);

}


// ===============================
// ENVIO DA NOTIFICAÇÃO
// ===============================

async function enviarNotificacao() {

  const btnText = document.getElementById("btnText");
  const btnIcon = document.getElementById("btnIcon");
  const loadingScreen = document.getElementById("loadingScreen");

  try {

    if (loadingScreen) loadingScreen.classList.remove("hidden");
    if (btnText) btnText.textContent = "Enviando...";
    if (btnIcon) btnIcon.textContent = "⏳";

    const destinoPagina = destinoSelect?.value || "dashboard.html";
    const linkCompleto = `${window.location.origin}/${destinoPagina}`;
    const imagemUrl = imagemInput?.value.trim() || null;

    // Salva o registro no histórico ANTES de enviar, pra não perder o registro
    // mesmo se o envio falhar no meio do caminho
    const registro = await addDoc(collection(db, "notificacoes"), {
      titulo: tituloAtual,
      mensagem: mensagemAtual,
      tipo: tipoAtual,
      cor: corAtual,
      destino: destinoPagina,
      imagemUrl: imagemUrl,
      enviadoPor: usuarioAtual?.email || "admin",
      data: serverTimestamp(),
      totalEnviados: 0,
      status: "enviando"
    });

    const resposta = await fetch("/.netlify/functions/enviar-notificacao", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        titulo: tituloAtual,
        mensagem: mensagemAtual,
        link: linkCompleto,
        imagem: imagemUrl,
        id: registro.id
      })
    });

    if (!resposta.ok) throw new Error("Falha no envio");

    const resultado = await resposta.json();

    // Atualiza o registro com o total real de dispositivos alcançados
    await updateDoc(doc(db, "notificacoes", registro.id), {
      totalEnviados: resultado.enviados || 0,
      status: "enviada"
    });

    mostrarToast("Sucesso", `Notificação enviada para ${resultado.enviados || 0} dispositivo(s).`);

    // Limpa o formulário
    tituloInput.value = "";
    mensagemInput.value = "";
    if (imagemInput) imagemInput.value = "";

    tituloAtual = "";
    mensagemAtual = "";
    tipoAtual = "geral";
    corAtual = "#FFB020";

    tituloCount.textContent = "0";
    mensagemCount.textContent = "0";

    atualizarPreview();
    carregarHistorico();
    atualizarDashboard();

  } catch (error) {

    console.error("Erro ao enviar:", error);
    mostrarToast("Erro", error.message);

  } finally {

    if (loadingScreen) loadingScreen.classList.add("hidden");
    if (btnText) btnText.textContent = "Enviar notificação";
    if (btnIcon) btnIcon.textContent = "🚀";

  }

}


// ===============================
// HISTÓRICO DE NOTIFICAÇÕES
// ===============================

const historico = document.getElementById("historico");
const deviceCount = document.getElementById("deviceCount");
const lastSend = document.getElementById("lastSend");
const todayCount = document.getElementById("todayCount");


// Rótulo amigável por categoria, pro selo do histórico
const NOMES_TIPO = {
  culto: "Culto",
  escala: "Escala",
  aviso: "Aviso",
  urgente: "Urgente",
  oracao: "Oração",
  evento: "Evento",
  geral: "Geral"
};

function formatarDataHistorico(data) {

  if (!data) return "agora mesmo";

  const agora = Date.now();
  const diffMin = Math.round((agora - data.getTime()) / 60000);

  if (diffMin < 1) return "agora mesmo";
  if (diffMin < 60) return `há ${diffMin} min`;

  const diffHoras = Math.round(diffMin / 60);
  if (diffHoras < 24) return `há ${diffHoras}h`;

  return data.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

}


async function carregarHistorico() {

  if (!historico) return;

  try {

    const q = query(collection(db, "notificacoes"), orderBy("data", "desc"), limit(20));
    const resultado = await getDocs(q);

    if (resultado.empty) {
      historico.innerHTML = "";
      return;
    }

    historico.innerHTML = "";

    resultado.forEach((item) => {

      const dados = item.data();
      const data = dados.data?.toDate ? dados.data.toDate() : null;
      const cor = dados.cor || "#FFB020";
      const nomeTipo = NOMES_TIPO[dados.tipo] || "Geral";

      const el = document.createElement("div");
      el.className = "history-item";
      el.style.borderLeftColor = cor;

      el.innerHTML = `
        <div class="history-badge" style="background:${cor}22; color:${cor};">${nomeTipo}</div>
        <div class="history-top">
          <div class="history-title">${escapeHtml(dados.titulo)}</div>
          <div class="history-date">${formatarDataHistorico(data)}</div>
        </div>
        <div class="history-message">${escapeHtml(dados.mensagem)}</div>
        <div class="history-footer">
          <div class="history-status">✓ ${dados.totalEnviados || 0} dispositivo(s)</div>
          <button type="button" class="history-repeat" data-id="${item.id}">🔁 Reenviar</button>
        </div>
      `;

      historico.appendChild(el);

    });

    historico.querySelectorAll(".history-repeat").forEach((btn) => {
      btn.addEventListener("click", () => reenviarDoHistorico(btn.dataset.id));
    });

  } catch (error) {
    console.error("Erro histórico:", error);
  }

}


function escapeHtml(texto) {
  const div = document.createElement("div");
  div.innerText = texto || "";
  return div.innerHTML;
}


// Preenche o formulário de novo com os dados de um envio antigo,
// pra facilitar mandar uma mensagem parecida sem digitar tudo de novo
async function reenviarDoHistorico(id) {

  const q = query(collection(db, "notificacoes"), orderBy("data", "desc"), limit(20));
  const resultado = await getDocs(q);
  const encontrado = resultado.docs.find((d) => d.id === id);

  if (!encontrado) return;

  const dados = encontrado.data();

  tituloInput.value = dados.titulo || "";
  mensagemInput.value = dados.mensagem || "";
  if (imagemInput) imagemInput.value = dados.imagemUrl || "";
  if (destinoSelect) destinoSelect.value = dados.destino || "dashboard.html";

  tituloAtual = dados.titulo || "";
  mensagemAtual = dados.mensagem || "";
  tipoAtual = dados.tipo || "geral";
  corAtual = dados.cor || "#FFB020";

  tituloCount.textContent = tituloAtual.length;
  mensagemCount.textContent = mensagemAtual.length;

  atualizarPreview();
  window.scrollTo({ top: 0, behavior: "smooth" });
  mostrarToast("Pronto", "Formulário preenchido. Confere e clica em enviar.");

}


// ===============================
// ATUALIZAR DASHBOARD (contadores)
// ===============================

async function atualizarDashboard() {

  try {

    // Último envio (o mais recente de todos)
    const qUltimo = query(collection(db, "notificacoes"), orderBy("data", "desc"), limit(1));
    const resultadoUltimo = await getDocs(qUltimo);

    if (!resultadoUltimo.empty) {
      const ultima = resultadoUltimo.docs[0].data();
      const data = ultima.data?.toDate ? ultima.data.toDate() : null;
      lastSend.textContent = formatarDataHistorico(data);
    } else {
      lastSend.textContent = "Nenhum envio ainda";
    }

    // Enviadas HOJE de verdade (consulta separada, filtrando por data)
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    const qHoje = query(
      collection(db, "notificacoes"),
      where("data", ">=", Timestamp.fromDate(hoje))
    );
    const resultadoHoje = await getDocs(qHoje);
    todayCount.textContent = resultadoHoje.size;

    // Dispositivos com token registrado + total de usuários (mesma consulta)
    const usuariosSnapshot = await getDocs(collection(db, "usuarios"));
    let dispositivos = 0;

    usuariosSnapshot.forEach((doc) => {
      const dados = doc.data();
      if (dados.push?.token) dispositivos++;
    });

    deviceCount.textContent = dispositivos;

    const userCount = document.getElementById("userCount");
    if (userCount) userCount.textContent = usuariosSnapshot.size;

    // Total de cultos cadastrados
    const cultoCount = document.getElementById("cultoCount");
    if (cultoCount) {
      const cultosSnapshot = await getDocs(collection(db, "cultos"));
      cultoCount.textContent = cultosSnapshot.size;
    }

    // Atividade recente (mesma coleção "atividades" que o app já alimenta)
    const atividadeContainer = document.getElementById("atividadeRecente");
    if (atividadeContainer) {
      const qAtividade = query(collection(db, "atividades"), orderBy("criadoEm", "desc"), limit(10));
      const resultadoAtividade = await getDocs(qAtividade);

      if (resultadoAtividade.empty) {
        atividadeContainer.innerHTML = '<p style="color:var(--faint); font-size:12.5px;">Nenhuma atividade ainda.</p>';
      } else {
        atividadeContainer.innerHTML = resultadoAtividade.docs.map((docSnap) => {
          const a = docSnap.data();
          const data = a.criadoEm?.toDate ? a.criadoEm.toDate() : null;
          return `
            <div class="atividade-item">
              <div class="atividade-ponto"></div>
              <div class="atividade-texto"><strong>${escapeHtml(a.usuario)}</strong> ${escapeHtml(a.texto)}</div>
              <div class="atividade-tempo">${formatarDataHistorico(data)}</div>
            </div>
          `;
        }).join("");
      }
    }

  } catch (error) {
    console.error("Erro dashboard:", error);
  }

}


// ===============================
// MÓDULO: AVISOS (publica no Mural do app)
// ===============================

const btnPublicarAviso = document.getElementById("btnPublicarAviso");

if (btnPublicarAviso) {
  btnPublicarAviso.addEventListener("click", async () => {

    const titulo = document.getElementById("avisoTitulo").value.trim();
    const conteudo = document.getElementById("avisoConteudo").value.trim();
    const categoria = document.getElementById("avisoCategoria").value;

    if (!titulo || !conteudo) {
      mostrarToast("Atenção", "Preenche o título e o conteúdo do aviso.");
      return;
    }

    const avisoBtnText = document.getElementById("avisoBtnText");
    const avisoBtnIcon = document.getElementById("avisoBtnIcon");

    try {

      avisoBtnText.textContent = "Publicando...";
      avisoBtnIcon.textContent = "⏳";

      // Publica direto no mural que o app já usa - assim a equipe vê
      // no mesmo lugar de sempre, com um selo de "aviso oficial"
      await addDoc(collection(db, "mural"), {
        texto: conteudo,
        titulo: titulo,
        categoria: categoria,
        tipo: "aviso",
        autor: "Administração",
        criadoPor: usuarioAtual?.uid || "admin",
        criadoEm: serverTimestamp()
      });

      // Dispara a notificação push também
      const linkCompleto = `${window.location.origin}/dashboard.html`;

      const registro = await addDoc(collection(db, "notificacoes"), {
        titulo: `📢 ${titulo}`,
        mensagem: conteudo,
        tipo: "aviso",
        cor: "#6D28D9",
        destino: "dashboard.html",
        imagemUrl: null,
        enviadoPor: usuarioAtual?.email || "admin",
        data: serverTimestamp(),
        totalEnviados: 0,
        status: "enviando"
      });

      const resposta = await fetch("/.netlify/functions/enviar-notificacao", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ titulo: `📢 ${titulo}`, mensagem: conteudo, link: linkCompleto })
      });

      if (resposta.ok) {
        const resultado = await resposta.json();
        await updateDoc(doc(db, "notificacoes", registro.id), {
          totalEnviados: resultado.enviados || 0,
          status: "enviada"
        });
      }

      mostrarToast("Sucesso", "Aviso publicado no mural e notificação enviada.");

      document.getElementById("avisoTitulo").value = "";
      document.getElementById("avisoConteudo").value = "";

      carregarHistorico();
      atualizarDashboard();

    } catch (error) {
      console.error("Erro ao publicar aviso:", error);
      mostrarToast("Erro", "Não foi possível publicar o aviso.");
    } finally {
      avisoBtnText.textContent = "Publicar aviso";
      avisoBtnIcon.textContent = "📢";
    }

  });
}


// ===============================
// MÓDULO: EVENTOS
// ===============================

const btnPublicarEvento = document.getElementById("btnPublicarEvento");

if (btnPublicarEvento) {
  btnPublicarEvento.addEventListener("click", async () => {

    const nome = document.getElementById("eventoNome").value.trim();
    const dataInput = document.getElementById("eventoData").value;
    const horario = document.getElementById("eventoHorario").value.trim();
    const local = document.getElementById("eventoLocal").value.trim();
    const descricao = document.getElementById("eventoDescricao").value.trim();
    const banner = document.getElementById("eventoBanner").value.trim();

    if (!nome || !dataInput) {
      mostrarToast("Atenção", "Preenche pelo menos o nome e a data do evento.");
      return;
    }

    const eventoBtnText = document.getElementById("eventoBtnText");
    const eventoBtnIcon = document.getElementById("eventoBtnIcon");

    try {

      eventoBtnText.textContent = "Publicando...";
      eventoBtnIcon.textContent = "⏳";

      const [ano, mes, dia] = dataInput.split("-").map(Number);
      const dataEvento = Timestamp.fromDate(new Date(ano, mes - 1, dia, 12, 0));

      await addDoc(collection(db, "eventos"), {
        nome,
        data: dataEvento,
        horario: horario || null,
        local: local || null,
        descricao: descricao || null,
        banner: banner || null,
        criadoPor: usuarioAtual?.uid || "admin",
        criadoEm: serverTimestamp()
      });

      // Notifica a equipe
      const linkCompleto = `${window.location.origin}/eventos.html`;
      const dataFormatada = `${String(dia).padStart(2,"0")}/${String(mes).padStart(2,"0")}`;
      const mensagemNotificacao = `${nome} — ${dataFormatada}${horario ? " às " + horario : ""}. Confira no app.`;

      const registro = await addDoc(collection(db, "notificacoes"), {
        titulo: `🎉 Novo evento: ${nome}`,
        mensagem: mensagemNotificacao,
        tipo: "evento",
        cor: "#FFB020",
        destino: "eventos.html",
        imagemUrl: banner || null,
        enviadoPor: usuarioAtual?.email || "admin",
        data: serverTimestamp(),
        totalEnviados: 0,
        status: "enviando"
      });

      const resposta = await fetch("/.netlify/functions/enviar-notificacao", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          titulo: `🎉 Novo evento: ${nome}`,
          mensagem: mensagemNotificacao,
          link: linkCompleto,
          imagem: banner || null
        })
      });

      if (resposta.ok) {
        const resultado = await resposta.json();
        await updateDoc(doc(db, "notificacoes", registro.id), {
          totalEnviados: resultado.enviados || 0,
          status: "enviada"
        });
      }

      mostrarToast("Sucesso", "Evento publicado e notificação enviada.");

      document.getElementById("eventoNome").value = "";
      document.getElementById("eventoData").value = "";
      document.getElementById("eventoHorario").value = "";
      document.getElementById("eventoLocal").value = "";
      document.getElementById("eventoDescricao").value = "";
      document.getElementById("eventoBanner").value = "";

      carregarHistorico();
      atualizarDashboard();

    } catch (error) {
      console.error("Erro ao publicar evento:", error);
      mostrarToast("Erro", "Não foi possível publicar o evento.");
    } finally {
      eventoBtnText.textContent = "Publicar evento";
      eventoBtnIcon.textContent = "🎉";
    }

  });
}


// ===============================
// INICIAR PAINEL
// ===============================

carregarHistorico();
atualizarDashboard();
