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
/* IA DO SINAL              */
/* ======================= */

const iaInput = document.querySelector("#iaInput");
const iaGerarBtn = document.querySelector("#iaGerarBtn");
const iaGerarTexto = document.querySelector("#iaGerarTexto");
const iaErro = document.querySelector("#iaErro");
const iaResultado = document.querySelector("#iaResultado");
const iaResultadoTexto = document.querySelector("#iaResultadoTexto");
const iaCopiarBtn = document.querySelector("#iaCopiarBtn");

const iaChips = document.querySelectorAll(".ia-chip");


// Sugestões rápidas: clicou, preenche o textarea
iaChips.forEach((chip) => {

  chip.addEventListener("click", () => {

    iaInput.value = chip.dataset.texto;
    iaInput.focus();

  });

});


function iaMostrarErro(mensagem) {

  iaErro.innerText = mensagem;
  iaErro.classList.remove("hidden");

}

function iaEsconderErro() {

  iaErro.classList.add("hidden");

}

function iaEstadoCarregando(carregando) {

  if (carregando) {

    iaGerarBtn.disabled = true;
    iaGerarTexto.innerHTML = '<span class="ia-spinner"></span> Pensando...';

  } else {

    iaGerarBtn.disabled = false;
    iaGerarTexto.innerText = "✨ Gerar";

  }

}


iaGerarBtn.onclick = async () => {

  iaEsconderErro();
  iaResultado.classList.add("hidden");

  const prompt = iaInput.value.trim();

  if (!prompt) {
    iaMostrarErro("Escreve o que você quer antes de gerar.");
    return;
  }

  if (!navigator.onLine) {
    iaMostrarErro("Sem conexão com a internet. Confere o wifi/dados e tenta de novo.");
    return;
  }

  iaEstadoCarregando(true);

  // Timeout de segurança: se a IA demorar mais de 30s, cancela e avisa
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

    iaEstadoCarregando(false);

  }

};


iaCopiarBtn.onclick = () => {

  navigator.clipboard.writeText(iaResultadoTexto.innerText);

  iaCopiarBtn.innerText = "✓ Copiado";

  setTimeout(() => {
    iaCopiarBtn.innerText = "📋 Copiar";
  }, 2000);

};
