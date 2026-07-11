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
      <div class="field-hint">Dica pra foto aparecer corretamente: <code>sinalpv.netlify.app/media-tool.html</code></div>
        <div class="upload-box" id="logoPreviewBox" style="display:none; margin-top:8px;">
          <img id="logoPreviewImg">
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

  await setDoc(doc(db, "usuarios", usuarioRef.uid), { nome: novoNome, fotoUrl: novaFoto || null }, { merge: true });

  usuarioRef.nome = novoNome;
  usuarioRef.fotoUrl = novaFoto || null;

  renderAvatar();
  btn.textContent = "Salvar";
  btn.disabled = false;
  fecharModalPerfil();
}
