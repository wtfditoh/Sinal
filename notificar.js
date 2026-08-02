import {
  collection, addDoc, updateDoc, doc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// Registra no histórico de notificações (mesma coleção que o Admin usa) e
// dispara o push de verdade pela Netlify Function. Usado quando conteúdo
// novo é criado direto no app (culto, cartaz, escala) - sem precisar abrir
// o Admin pra avisar a equipe manualmente.
//
// Falha silenciosa: se a notificação não sair por algum motivo, isso NUNCA
// deve impedir o culto/cartaz/escala de ser salvo - só registra no console.
export async function dispararNotificacao(db, usuario, { titulo, mensagem, tipo = "geral", cor = "#FFB020", destino = "dashboard.html", imagemUrl = null }) {

  try {

    const linkCompleto = `${window.location.origin}/${destino}`;

    const registro = await addDoc(collection(db, "notificacoes"), {
      titulo,
      mensagem,
      tipo,
      cor,
      destino,
      imagemUrl,
      enviadoPor: usuario?.nome || "Sistema (automático)",
      data: serverTimestamp(),
      totalEnviados: 0,
      status: "enviando",
      automatica: true
    });

    const resposta = await fetch("/.netlify/functions/enviar-notificacao", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ titulo, mensagem, link: linkCompleto, imagem: imagemUrl })
    });

    if (resposta.ok) {
      const resultado = await resposta.json();
      await updateDoc(doc(db, "notificacoes", registro.id), {
        totalEnviados: resultado.enviados || 0,
        status: "enviada"
      });
    } else {
      await updateDoc(doc(db, "notificacoes", registro.id), { status: "erro" });
    }

  } catch (erro) {
    console.error("Notificação automática não saiu (o conteúdo foi salvo normalmente):", erro);
  }

}
