import { db } from "./firebase-config.js";
import { collection, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// Registra uma linha no feed de atividades. Chamado depois de ações
// relevantes (marcar postado, confirmar presença, etc). Falha silenciosa
// se der erro — o feed é só um extra, nunca deve travar a ação principal.
export async function registrarAtividade(usuario, texto) {
  try {
    await addDoc(collection(db, "atividades"), {
      texto,
      usuario: usuario.nome,
      criadoEm: serverTimestamp()
    });
  } catch (e) {
    console.error("Erro ao registrar atividade:", e);
  }
}
