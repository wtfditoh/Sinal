// Tenta baixar a imagem direto (sem abrir nada) via fetch + blob.
// Se o link bloquear isso (CORS), cai pro plano B: abre em nova aba
// pra pessoa salvar manualmente (segurar o dedo na imagem).
export async function baixarImagem(url, nomeArquivo, botao) {
  const textoOriginal = botao ? botao.textContent : null;
  if (botao) { botao.textContent = "Baixando..."; botao.disabled = true; }

  try {
    const resposta = await fetch(url, { mode: "cors" });
    if (!resposta.ok) throw new Error("Falha ao buscar imagem");
    const blob = await resposta.blob();
    const extensao = blob.type.includes("png") ? "png" : blob.type.includes("webp") ? "webp" : "jpg";
    const blobUrl = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = blobUrl;
    link.download = `${(nomeArquivo || "imagem").replace(/[^a-z0-9]+/gi, "-")}.${extensao}`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(blobUrl);
  } catch (erro) {
    // Não conseguiu baixar direto (o site da imagem não permite) — abre em nova aba como alternativa
    window.open(url, "_blank", "noopener");
  } finally {
    if (botao) { botao.textContent = textoOriginal; botao.disabled = false; }
  }
}
