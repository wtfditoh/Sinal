import { db } from "./firebase-config.js";
import { exigirLogin } from "./auth.js";
import {
  collection, query, where, orderBy, onSnapshot,
  doc, updateDoc, serverTimestamp, Timestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

function escapeHtml(texto) {
  if (!texto) return "";
  const div = document.createElement("div");
  div.textContent = texto;
  return div.innerHTML;
}

function limitesDoDia(data) {
  const inicio = new Date(data); inicio.setHours(0, 0, 0, 0);
  const fim = new Date(data); fim.setHours(23, 59, 59, 999);
  return { inicio, fim };
}

// Relógio ao vivo, dá aquele ar de painel de controle
function atualizarRelogio() {
  const agora = new Date();
  document.getElementById("tvRelogio").textContent =
    `${String(agora.getHours()).padStart(2,"0")}:${String(agora.getMinutes()).padStart(2,"0")}`;
}
setInterval(atualizarRelogio, 1000);
atualizarRelogio();

let cultoAtualId = null;

exigirLogin(() => {
  carregarCultoDeHoje();
});

function carregarCultoDeHoje() {
  const { inicio, fim } = limitesDoDia(new Date());
  const q = query(
    collection(db, "cultos"),
    where("data", ">=", Timestamp.fromDate(inicio)),
    where("data", "<=", Timestamp.fromDate(fim))
  );

  onSnapshot(q, (snapshot) => {
    if (snapshot.empty) {
      cultoAtualId = null;
      mostrarVazio();
      carregarProximoCultoTV();
      return;
    }
    const docSnap = snapshot.docs[0];
    cultoAtualId = docSnap.id;
    mostrarCulto(docSnap.data());
    carregarEscalaDeHoje();
  });
}

function mostrarVazio() {
  document.getElementById("tvVazio").style.display = "flex";
  document.getElementById("tvConteudo").style.display = "none";
}

function carregarProximoCultoTV() {
  const q = query(
    collection(db, "cultos"),
    where("data", ">", Timestamp.fromDate(new Date())),
    orderBy("data", "asc")
  );
  onSnapshot(q, (snapshot) => {
    const texto = document.getElementById("tvProximoTexto");
    if (snapshot.empty) { texto.textContent = ""; return; }
    const c = snapshot.docs[0].data();
    const d = c.data.toDate();
    texto.textContent = `Próximo: ${c.tipo || "Culto"} em ${String(d.getDate()).padStart(2,"0")}/${String(d.getMonth()+1).padStart(2,"0")}`;
  });
}

function mostrarCulto(c) {
  document.getElementById("tvVazio").style.display = "none";
  document.getElementById("tvConteudo").style.display = "grid";

  document.getElementById("tvTipo").textContent = c.tipo || "Culto";

  const temaEl = document.getElementById("tvTema");
  if (c.tema) { temaEl.textContent = `📌 ${c.tema}`; temaEl.style.display = "block"; }
  else temaEl.style.display = "none";

  const pregadorEl = document.getElementById("tvPregador");
  if (c.pregador) { pregadorEl.textContent = `🎤 ${c.pregador}`; pregadorEl.style.display = "block"; }
  else pregadorEl.style.display = "none";

  const versiculoEl = document.getElementById("tvVersiculo");
  if (c.versiculo) { versiculoEl.textContent = `"${c.versiculo}"`; versiculoEl.style.display = "block"; }
  else versiculoEl.style.display = "none";

  ["foto", "story", "feed"].forEach((chave) => {
    const el = document.getElementById(`tvCheck${chave.charAt(0).toUpperCase()}${chave.slice(1)}`);
    el.classList.toggle("feito", !!c.checklist?.[chave]);
    el.onclick = () => toggleChecklistTV(chave, !!c.checklist?.[chave]);
  });

  const statusEl = document.getElementById("tvStatusGeral");
  const isPostado = c.status === "postado";
  statusEl.textContent = isPostado ? `✓ POSTADO POR ${(c.postadoPor || "").toUpperCase()}` : "PENDENTE";
  statusEl.className = `tv-status-geral ${isPostado ? "postado" : "pendente"}`;
}

async function toggleChecklistTV(chave, jaFeito) {
  if (!cultoAtualId) return;
  await updateDoc(doc(db, "cultos", cultoAtualId), {
    [`checklist.${chave}`]: !jaFeito,
    atualizadoEm: serverTimestamp()
  });
}

function carregarEscalaDeHoje() {
  const { inicio, fim } = limitesDoDia(new Date());
  const q = query(
    collection(db, "escalas"),
    where("data", ">=", Timestamp.fromDate(inicio)),
    where("data", "<=", Timestamp.fromDate(fim))
  );

  onSnapshot(q, (snapshot) => {
    const container = document.getElementById("tvEscala");
    if (snapshot.empty) {
      container.innerHTML = `<p style="color:var(--text-faint); font-size:15px;">Ninguém escalado ainda.</p>`;
      return;
    }
    container.innerHTML = snapshot.docs.map((docSnap) => {
      const e = docSnap.data();
      return `
        <div class="tv-escalado ${e.confirmado ? "confirmado" : ""}">
          <div>
            <div class="tv-escalado-funcao">${escapeHtml(e.funcao)}</div>
            <div class="tv-escalado-nome">${escapeHtml(e.pessoa)}</div>
          </div>
        </div>
      `;
    }).join("");
  });
}
