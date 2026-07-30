const API_KEY = "5e3b2c6eae12635e0d9b00e9af54edb6";


const fileInput = document.querySelector("#file");
const preview = document.querySelector("#preview");
const previewBox = document.querySelector("#previewBox");
const emptyState = document.querySelector("#emptyState");

const fileName = document.querySelector("#fileName");
const removeBtn = document.querySelector("#remove");

const uploadBtn = document.querySelector("#upload");

const status = document.querySelector("#status");
const statusDot = document.querySelector("#statusDot");

const progress = document.querySelector(".progress");
const progressBar = document.querySelector("#progressBar");

const resultCard = document.querySelector("#resultCard");
const urlBox = document.querySelector("#url");
const copyBtn = document.querySelector("#copy");

const renameInput = document.querySelector("#renameInput");

let selectedFile = null;



function setStatus(text,color){

status.innerText = text;

statusDot.style.background = color;

statusDot.style.boxShadow =
`0 0 10px ${color}`;

}




fileInput.addEventListener("change",(e)=>{


const file = e.target.files[0];


if(!file) return;


selectedFile = file;


preview.src = URL.createObjectURL(file);


fileName.innerText = file.name;


emptyState.classList.add("hidden");

previewBox.classList.remove("hidden");


setStatus(
"Imagem pronta para envio",
"#FFB020"
);


});




removeBtn.onclick = (e)=>{


e.preventDefault();


selectedFile = null;


fileInput.value="";


preview.src="";


previewBox.classList.add("hidden");


emptyState.classList.remove("hidden");


setStatus(
"Aguardando imagem",
"#FFB020"
);


};




uploadBtn.onclick = async()=>{


if(!selectedFile){

alert("Selecione uma imagem primeiro");

return;

}



uploadBtn.innerText =
"⏳ ENVIANDO...";


setStatus(
"Enviando imagem...",
"#FFB020"
);



progress.classList.remove("hidden");



let progressValue = 0;


const animation = setInterval(()=>{


if(progressValue < 90){

progressValue += Math.random()*10;

progressBar.style.width =
progressValue+"%";

}


},200);




const form = new FormData();


let fileToSend = selectedFile;


if(renameInput.value.trim()){

const extension = selectedFile.name.split(".").pop();


const newName =
renameInput.value.trim()
+
"."
+
extension;


fileToSend = new File(
[selectedFile],
newName,
{
type:selectedFile.type
}
);

}


form.append(
"image",
fileToSend
);



try{


const response = await fetch(

`https://api.imgbb.com/1/upload?key=${API_KEY}`,

{

method:"POST",

body:form

}

);



const data = await response.json();



clearInterval(animation);



progressBar.style.width="100%";



const link = data.data.url;



urlBox.innerText = link;


resultCard.classList.remove("hidden");



setStatus(
"Upload concluído",
"#2EE896"
);



uploadBtn.innerText =
"✓ LINK GERADO";



}

catch(error){


clearInterval(animation);


setStatus(
"Erro no upload",
"#FF5C5C"
);


uploadBtn.innerText =
"⚡ GERAR LINK DIRETO";


alert(
"Não foi possível enviar a imagem"
);


}


};





copyBtn.onclick = ()=>{


navigator.clipboard.writeText(
urlBox.innerText
);


copyBtn.innerText =
"✓ COPIADO";


setTimeout(()=>{

copyBtn.innerText =
"📋 COPIAR LINK";

},2000);


};





/* ======================= */
/* ABAS DO TOPO (Upload / IA) */
/* ======================= */

const tabUploadBtn = document.querySelector("#tabUploadBtn");
const tabIABtn = document.querySelector("#tabIABtn");
const painelUpload = document.querySelector("#painelUpload");
const painelIA = document.querySelector("#painelIA");

tabUploadBtn.onclick = () => {

  tabUploadBtn.classList.add("active");
  tabIABtn.classList.remove("active");
  painelUpload.classList.remove("hidden");
  painelIA.classList.add("hidden");

};

tabIABtn.onclick = () => {

  tabIABtn.classList.add("active");
  tabUploadBtn.classList.remove("active");
  painelIA.classList.remove("hidden");
  painelUpload.classList.add("hidden");

};



/* ======================= */
/* IA DO SINAL              */
/* ======================= */

const iaErro = document.querySelector("#iaErro");
const iaResultado = document.querySelector("#iaResultado");
const iaResultadoTexto = document.querySelector("#iaResultadoTexto");
const iaCopiarBtn = document.querySelector("#iaCopiarBtn");


function iaMostrarErro(mensagem) {

  iaErro.innerText = mensagem;
  iaErro.classList.remove("hidden");

}

function iaEsconderErro() {

  iaErro.classList.add("hidden");

}

// Recebe o botão e o span de texto dele, pra funcionar tanto
// no modo Legenda de Culto quanto no modo Livre
function iaEstadoCarregando(carregando, botao, span, textoOriginal) {

  if (carregando) {

    botao.disabled = true;
    span.innerHTML = '<span class="ia-spinner"></span> Pensando...';

  } else {

    botao.disabled = false;
    span.innerText = textoOriginal;

  }

}


// Faz a chamada de verdade pra Netlify Function - reaproveitada pelos dois modos
async function iaGerar(prompt, botao, span, textoOriginal) {

  iaEsconderErro();
  iaResultado.classList.add("hidden");

  if (!prompt || !prompt.trim()) {
    iaMostrarErro("Preenche as informações antes de gerar.");
    return;
  }

  if (!navigator.onLine) {
    iaMostrarErro("Sem conexão com a internet. Confere o wifi/dados e tenta de novo.");
    return;
  }

  iaEstadoCarregando(true, botao, span, textoOriginal);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000);

  try {

    const response = await fetch("/.netlify/functions/ia", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error("erro_ia");
    }

    const data = await response.json();

    if (!data.resposta) {
      throw new Error("erro_ia");
    }

    iaResultadoTexto.innerText = data.resposta;
    iaResultado.classList.remove("hidden");
    iaResultado.scrollIntoView({ behavior: "smooth", block: "nearest" });

  } catch (erro) {

    clearTimeout(timeoutId);

    if (erro.name === "AbortError") {
      iaMostrarErro("Demorou demais pra responder. Tenta de novo em instantes.");
    } else if (!navigator.onLine) {
      iaMostrarErro("Sem conexão com a internet. Confere o wifi/dados e tenta de novo.");
    } else {
      iaMostrarErro("A IA não conseguiu responder agora. Tenta de novo em instantes.");
    }

  } finally {

    iaEstadoCarregando(false, botao, span, textoOriginal);

  }

}


iaCopiarBtn.onclick = () => {

  navigator.clipboard.writeText(iaResultadoTexto.innerText);

  iaCopiarBtn.innerText = "✓ Copiado";

  setTimeout(() => {
    iaCopiarBtn.innerText = "📋 Copiar";
  }, 2000);

};



/* ======================= */
/* MODO: LEGENDA DE CULTO   */
/* ======================= */

// Estilo fixo da IEADRN Parque Verde - embutido no prompt toda vez
const ESTILO_LEGENDA_CULTO = `
Você escreve legendas de Instagram para os cultos da igreja IEADRN Parque Verde, seguindo SEMPRE este estilo:

FORMATO FIXO EM 3 PARTES (nessa ordem):
1. Nome do culto + UM emoji relacionado ao tema, só no título.
2. Uma mensagem curta, de 2 a 3 linhas, resumindo o principal ensinamento da pregação.
3. Cite um versículo relacionado à mensagem. Se for só um trecho do versículo, a referência termina com "part.". Se o versículo usado for curto e completo, a referência fica normal, sem "part.".

TOM DE ESCRITA:
- Natural e humano, simples de ler.
- Inspirador, mas sem exagerar na linguagem poética.
- Como se estivesse conversando com a igreja, passando o que foi aprendido no culto.

REGRAS DA MENSAGEM:
- Resume o principal ensinamento da pregação.
- Evita frases genéricas quando há um tema específico definido.
- Destaca a aplicação prática (fé, perdão, santidade, missões, comunhão, etc).
- Não usa muitos adjetivos nem exagera nos emojis (emoji só no título, no máximo).

Responda SOMENTE com a legenda pronta, sem explicações antes ou depois, sem aspas envolvendo o texto.
`.trim();

// Mapa de emoji automático por tipo de culto (mesma lista do padrão da igreja)
const MAPA_EMOJI_CULTO = [
  [/senhora/i, "💐"],
  [/famíli|familia/i, "👨‍👩‍👧‍👦"],
  [/jovens/i, "🔥"],
  [/miss(ã|a)o/i, "🌍"],
  [/doutrina/i, "📖"],
  [/campanha|ora(ç|c)(ã|a)o/i, "🙏"],
  [/ceia/i, "🍞🍷"],
  [/novo viver/i, "🌱"]
];

function emojiParaCulto(nome) {

  for (const [regex, emoji] of MAPA_EMOJI_CULTO) {
    if (regex.test(nome)) return emoji;
  }

  return "🙏";

}


const cultoNome = document.querySelector("#cultoNome");
const cultoTema = document.querySelector("#cultoTema");
const cultoVersiculo = document.querySelector("#cultoVersiculo");
const cultoEmojiPreview = document.querySelector("#cultoEmojiPreview");

const gerarLegendaCultoBtn = document.querySelector("#gerarLegendaCultoBtn");
const gerarLegendaCultoTexto = document.querySelector("#gerarLegendaCultoTexto");


// Atualiza o emoji sozinho conforme a pessoa digita o nome do culto
cultoNome.addEventListener("input", () => {

  cultoEmojiPreview.innerText = emojiParaCulto(cultoNome.value);

});


gerarLegendaCultoBtn.onclick = () => {

  const nome = cultoNome.value.trim();
  const tema = cultoTema.value.trim();
  const versiculo = cultoVersiculo.value.trim();

  if (!nome || !tema) {
    iaMostrarErro("Preenche pelo menos o nome do culto e o tema da pregação.");
    return;
  }

  const emoji = emojiParaCulto(nome);

  const prompt = `${ESTILO_LEGENDA_CULTO}

Nome do culto: ${nome}
Emoji do título: ${emoji}
Tema / o que foi pregado: ${tema}
${versiculo ? `Versículo pra usar: ${versiculo}` : "Nenhum versículo foi indicado - sugira um versículo bíblico real e relacionado ao tema."}

Escreva a legenda agora, seguindo o formato e o estilo acima.`;

  iaGerar(prompt, gerarLegendaCultoBtn, gerarLegendaCultoTexto, "✨ Gerar legenda");

};



/* ======================= */
/* MODO: LIVRE               */
/* ======================= */

const modoCultoBtn = document.querySelector("#modoCultoBtn");
const modoLivreBtn = document.querySelector("#modoLivreBtn");
const painelModoCulto = document.querySelector("#painelModoCulto");
const painelModoLivre = document.querySelector("#painelModoLivre");

modoCultoBtn.onclick = () => {

  modoCultoBtn.classList.add("active");
  modoLivreBtn.classList.remove("active");
  painelModoCulto.classList.remove("hidden");
  painelModoLivre.classList.add("hidden");
  iaEsconderErro();
  iaResultado.classList.add("hidden");

};

modoLivreBtn.onclick = () => {

  modoLivreBtn.classList.add("active");
  modoCultoBtn.classList.remove("active");
  painelModoLivre.classList.remove("hidden");
  painelModoCulto.classList.add("hidden");
  iaEsconderErro();
  iaResultado.classList.add("hidden");

};


const iaInput = document.querySelector("#iaInput");
const iaGerarBtn = document.querySelector("#iaGerarBtn");
const iaGerarTexto = document.querySelector("#iaGerarTexto");

const iaChips = document.querySelectorAll(".ia-chip");


iaChips.forEach((chip) => {

  chip.addEventListener("click", () => {

    iaInput.value = chip.dataset.texto;
    iaInput.focus();

  });

});


iaGerarBtn.onclick = () => {

  iaGerar(iaInput.value.trim(), iaGerarBtn, iaGerarTexto, "✨ Gerar");

};
