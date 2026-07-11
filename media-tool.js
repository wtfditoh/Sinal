const API_KEY = "5e3b2c6eae12635e0d9b00e9af54edb6";


const fileInput = document.querySelector("#file");
const preview = document.querySelector("#preview");
const uploadBtn = document.querySelector("#upload");

let selectedFile = null;



fileInput.addEventListener("change",(event)=>{


selectedFile = event.target.files[0];


if(selectedFile){

preview.innerHTML = `

<img src="${URL.createObjectURL(selectedFile)}">

`;

}


});




uploadBtn.onclick = async()=>{


if(!selectedFile){

alert("Escolha uma imagem primeiro");

return;

}



uploadBtn.innerText="ENVIANDO...";


const formData = new FormData();


formData.append(
"image",
selectedFile
);



try{


const response = await fetch(

`https://api.imgbb.com/1/upload?key=${API_KEY}`,

{

method:"POST",

body:formData

}

);



const data = await response.json();



const directUrl = data.data.url;



document.querySelector("#url").innerText = directUrl;


document.querySelector(".result")
.classList.remove("hidden");



uploadBtn.innerText="ENVIAR IMAGEM";



}

catch(error){


alert("Erro ao enviar imagem");


uploadBtn.innerText="ENVIAR IMAGEM";


}



};




document.querySelector("#copy").onclick=()=>{


const link =
document.querySelector("#url").innerText;


navigator.clipboard.writeText(link);


alert("Link copiado!");

};
