const API_KEY = "const API_KEY = "5e3b2c6eae12635e0d9b00e9af54edb6";


// ELEMENTOS

const fileInput = document.querySelector("#file");

const preview = document.querySelector("#preview");
const previewBox = document.querySelector("#previewBox");
const emptyState = document.querySelector("#emptyState");

const fileName = document.querySelector("#fileName");
const removeBtn = document.querySelector("#remove");

const renameInput = document.querySelector("#renameInput");

const uploadBtn = document.querySelector("#upload");

const status = document.querySelector("#status");
const statusDot = document.querySelector("#statusDot");

const progress = document.querySelector(".progress");
const progressBar = document.querySelector("#progressBar");

const resultCard = document.querySelector("#resultCard");
const urlBox = document.querySelector("#url");
const copyBtn = document.querySelector("#copy");



let selectedFile = null;





// STATUS

function setStatus(text,color){

status.innerText = text;

statusDot.style.background = color;

statusDot.style.boxShadow =
`0 0 10px ${color}`;

}





// ESCOLHER IMAGEM

fileInput.addEventListener("change",()=>{


const file = fileInput.files[0];


if(!file) return;



selectedFile = file;



preview.src = URL.createObjectURL(file);


fileName.innerText = file.name;



emptyState.classList.add("hidden");

previewBox.classList.remove("hidden");



setStatus(
"Imagem pronta",
"#FFB020"
);



});







// REMOVER IMAGEM


removeBtn.onclick = (e)=>{


e.preventDefault();



selectedFile = null;


fileInput.value="";


preview.src="";


renameInput.value="";



previewBox.classList.add("hidden");


emptyState.classList.remove("hidden");



setStatus(
"Aguardando imagem",
"#FFB020"
);



};







// UPLOAD


uploadBtn.onclick = async()=>{


if(!selectedFile){


alert("Escolha uma imagem primeiro");

return;


}




uploadBtn.innerText =
"⏳ ENVIANDO...";



setStatus(
"Enviando imagem...",
"#FFB020"
);



progress.classList.remove("hidden");



let percent = 0;



const loader = setInterval(()=>{


if(percent < 90){

percent += Math.random()*8;

progressBar.style.width =
percent+"%";

}


},200);







// RENOMEAR ARQUIVO


let fileToSend = selectedFile;



if(renameInput.value.trim()){


const extension =
selectedFile.name.split(".").pop();



const newName =
renameInput.value
.trim()
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






// FORM DATA


const form = new FormData();


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




clearInterval(loader);



progressBar.style.width="100%";





if(!data.success){

throw new Error();

}




const directLink =
data.data.url;



urlBox.innerText =
directLink;



resultCard.classList.remove("hidden");





setStatus(

"Upload concluído",

"#2EE896"

);



uploadBtn.innerText =
"✓ LINK GERADO";





}



catch(error){



clearInterval(loader);



setStatus(

"Erro no upload",

"#FF5C5C"

);



uploadBtn.innerText =
"⚡ GERAR LINK DIRETO";



alert(
"Erro ao enviar imagem"
);



}



};








// COPIAR LINK


copyBtn.onclick = async()=>{


await navigator.clipboard.writeText(
urlBox.innerText
);



copyBtn.innerText =
"✓ COPIADO";



setTimeout(()=>{


copyBtn.innerText =
"📋 COPIAR LINK";


},2000);



};
