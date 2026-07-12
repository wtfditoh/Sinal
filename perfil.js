import { db } from "./firebase-config.js";
import { doc, setDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

let usuarioRef = null;
let avatarBtnRef = null;

export function initPerfil(usuario) {
  usuarioRef = usuario;
  avatarBtnRef = document.getElementById("topbarAvatar");
  if (!avatarBtnRef) return;

  renderAvatar();
  avatarBtnRef.addEventListener("click", abrirModalPerfil);
  criarModalSeNaoExiste();
}

function iniciais(nome) {
  if (!nome) return "?";
  return nome.trim().charAt(0).toUpperCase();
}

function renderAvatar() {
  avatarBtnRef.innerHTML = usuarioRef.fotoUrl
    ? `<img src="${usuarioRef.fotoUrl}" class="avatar-img" alt="" onerror="this.parentElement.innerHTML='<span class=avatar-iniciais>${iniciais(usuarioRef.nome)}</span>'">`
    : `<span class="avatar-iniciais">${iniciais(usuarioRef.nome)}</span>`;
}

function criarModalSeNaoExiste() {
  if (document.getElementById("perfilModalOverlay")) return;

  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.id = "perfilModalOverlay";
  overlay.innerHTML = `
    <div class="modal-sheet">
      <div class="modal-title">Seu perfil</div>
      <div class="perfil-preview">
        <div class="avatar-grande" id="avatarPreview">
          ${usuarioRef.fotoUrl ? `<img src="${usuarioRef.fotoUrl}" alt="">` : `<span>${iniciais(usuarioRef.nome)}</span>`}
        </div>
      </div>
      <div class="field">
        <label>Nome exibido</label>
        <input type="text" id="perfilNomeInput" value="${usuarioRef.nome || ""}">
      </div>
      <div class="field">
        <label>Link da foto (opcional)</label>
        <input type="url" id="perfilFotoInput" value="${usuarioRef.fotoUrl || ""}" placeholder="Link de imagem do Drive, Google Fotos, etc.">
      </div>
      <div class="field">
        <label>Aniversário (opcional, só dia e mês)</label>
        <div style="display:flex; gap:8px;">
          <select id="perfilAniversarioDia" style="flex:1; background:var(--bg-elevated); border:1px solid var(--border); border-radius:8px; padding:11px; color:var(--text); font-size:14px;">
            <option value="">Dia</option>
            ${Array.from({length:31}, (_,i)=>`<option value="${i+1}" ${usuarioRef.aniversarioDia===i+1?"selected":""}>${i+1}</option>`).join("")}
          </select>
          <select id="perfilAniversarioMes" style="flex:1; background:var(--bg-elevated); border:1px solid var(--border); border-radius:8px; padding:11px; color:var(--text); font-size:14px;">
            <option value="">Mês</option>
            ${["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"].map((m,i)=>`<option value="${i+1}" ${usuarioRef.aniversarioMes===i+1?"selected":""}>${m}</option>`).join("")}
          </select>
        </div>
      </div>
      <div class="modal-actions">
        <button type="button" class="btn" id="perfilCancelBtn">Cancelar</button>
        <button type="button" class="btn btn-primary" id="perfilSalvarBtn">Salvar</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) fecharModalPerfil();
  });
  document.getElementById("perfilCancelBtn").addEventListener("click", fecharModalPerfil);
  document.getElementById("perfilFotoInput").addEventListener("input", (e) => {
    const url = e.target.value.trim();
    const preview = document.getElementById("avatarPreview");
    preview.innerHTML = url
      ? `<img src="${url}" alt="" onerror="this.style.display='none'">`
      : `<span>${iniciais(document.getElementById("perfilNomeInput").value)}</span>`;
  });
  document.getElementById("perfilSalvarBtn").addEventListener("click", salvarPerfil);
}

function abrirModalPerfil() {
  document.getElementById("perfilNomeInput").value = usuarioRef.nome || "";
  document.getElementById("perfilFotoInput").value = usuarioRef.fotoUrl || "";
  document.getElementById("perfilAniversarioDia").value = usuarioRef.aniversarioDia || "";
  document.getElementById("perfilAniversarioMes").value = usuarioRef.aniversarioMes || "";
  const preview = document.getElementById("avatarPreview");
  preview.innerHTML = usuarioRef.fotoUrl
    ? `<img src="${usuarioRef.fotoUrl}" alt="">`
    : `<span>${iniciais(usuarioRef.nome)}</span>`;
  document.getElementById("perfilModalOverlay").classList.add("active");
}

function fecharModalPerfil() {
  document.getElementById("perfilModalOverlay").classList.remove("active");
}

async function salvarPerfil() {
  const btn = document.getElementById("perfilSalvarBtn");
  btn.textContent = "Salvando...";
  btn.disabled = true;

  const novoNome = document.getElementById("perfilNomeInput").value.trim() || usuarioRef.nome;
  const novaFoto = document.getElementById("perfilFotoInput").value.trim();
  const diaVal = document.getElementById("perfilAniversarioDia").value;
  const mesVal = document.getElementById("perfilAniversarioMes").value;

  await setDoc(doc(db, "usuarios", usuarioRef.uid), {
    nome: novoNome,
    fotoUrl: novaFoto || null,
    aniversarioDia: diaVal ? Number(diaVal) : null,
    aniversarioMes: mesVal ? Number(mesVal) : null
  }, { merge: true });

  usuarioRef.nome = novoNome;
  usuarioRef.fotoUrl = novaFoto || null;
  usuarioRef.aniversarioDia = diaVal ? Number(diaVal) : null;
  usuarioRef.aniversarioMes = mesVal ? Number(mesVal) : null;

  renderAvatar();
  btn.textContent = "Salvar";
  btn.disabled = false;
  fecharModalPerfil();
}
