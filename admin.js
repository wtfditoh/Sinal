// admin.js

import { 
  auth, 
  db, 
  storage 
} from "./firebase-config.js";

import {
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-auth.js";

import {
  collection,
  getDocs,
  addDoc,
  deleteDoc,
  doc,
  updateDoc,
  serverTimestamp,
  query,
  orderBy
} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js";

import {
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject
} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-storage.js";


// ===============================
// VARIÁVEIS GLOBAIS
// ===============================

let usuarioAtual = null;
let arquivosUpload = [];


// ===============================
// AUTENTICAÇÃO ADMIN
// ===============================

onAuthStateChanged(auth, async (usuario) => {

  if (!usuario) {
    window.location.href = "index.html";
    return;
  }

  usuarioAtual = usuario;

  console.log("Admin conectado:", usuario.email);

  iniciarAdmin();

});


// ===============================
// INICIALIZAÇÃO
// ===============================

async function iniciarAdmin(){

  carregarUsuarios();
  carregarCultos();
  carregarUploads();

}


// ===============================
// LOGOUT
// ===============================

const btnSair = document.getElementById("btnSair");

if(btnSair){

  btnSair.addEventListener("click", async()=>{

    await signOut(auth);
    window.location.href="index.html";

  });

}

// ===============================
// CARREGAR USUÁRIOS
// ===============================

async function carregarUsuarios(){

  const lista = document.getElementById("listaUsuarios");

  if(!lista) return;

  lista.innerHTML = "";

  try{

    const usuarios = await getDocs(collection(db,"usuarios"));

    usuarios.forEach((item)=>{

      const dados = item.data();

      lista.innerHTML += `
        <div class="admin-card">
          <h3>${dados.nome || "Sem nome"}</h3>
          <p>${dados.email || ""}</p>
          <span>
            Tipo: ${dados.tipo || "membro"}
          </span>
        </div>
      `;

    });


  }catch(error){

    console.error("Erro ao carregar usuários:",error);

  }

}



// ===============================
// CARREGAR CULTOS
// ===============================

async function carregarCultos(){

  const lista = document.getElementById("listaCultos");

  if(!lista) return;

  lista.innerHTML="";


  try{

    const q = query(
      collection(db,"cultos"),
      orderBy("data","desc")
    );


    const resultado = await getDocs(q);


    resultado.forEach((item)=>{

      const culto = item.data();


      lista.innerHTML += `

      <div class="admin-card">

        <h3>${culto.titulo || "Culto"}</h3>

        <p>
          ${culto.data || ""}
        </p>

        <p>
          ${culto.descricao || ""}
        </p>


        <button 
        class="btnExcluirCulto"
        data-id="${item.id}">
          Excluir
        </button>


      </div>

      `;


    });


    document.querySelectorAll(".btnExcluirCulto")
    .forEach(botao=>{

      botao.addEventListener("click",async()=>{

        const id = botao.dataset.id;

        await deleteDoc(
          doc(db,"cultos",id)
        );

        carregarCultos();

      });


    });


  }catch(error){

    console.error("Erro cultos:",error);

  }

}

// ===============================
// ADICIONAR CULTO
// ===============================

const formCulto = document.getElementById("formCulto");


if(formCulto){

  formCulto.addEventListener("submit", async(e)=>{

    e.preventDefault();


    const titulo = document.getElementById("tituloCulto").value;
    const data = document.getElementById("dataCulto").value;
    const descricao = document.getElementById("descricaoCulto").value;


    try{


      await addDoc(collection(db,"cultos"),{

        titulo,
        data,
        descricao,

        criadoPor: usuarioAtual.email,

        criadoEm: serverTimestamp()

      });



      formCulto.reset();

      carregarCultos();


      alert("Culto adicionado com sucesso");


    }catch(error){

      console.error(
        "Erro ao adicionar culto:",
        error
      );

    }


  });


}



// ===============================
// SISTEMA DE UPLOAD
// ===============================


const inputUpload = document.getElementById("arquivoUpload");


if(inputUpload){

  inputUpload.addEventListener("change",(e)=>{


    arquivosUpload = [
      ...e.target.files
    ];


    console.log(
      "Arquivos selecionados:",
      arquivosUpload
    );


  });

}




const btnEnviarUpload = document.getElementById("btnEnviarUpload");


if(btnEnviarUpload){


btnEnviarUpload.addEventListener("click",async()=>{


  if(arquivosUpload.length === 0){

    alert("Selecione algum arquivo");
    return;

  }



  for(const arquivo of arquivosUpload){


    try{


      const caminho = 
      `uploads/${Date.now()}-${arquivo.name}`;


      const arquivoRef = ref(
        storage,
        caminho
      );



      await uploadBytes(
        arquivoRef,
        arquivo
      );



      const url = await getDownloadURL(
        arquivoRef
      );



      await addDoc(
        collection(db,"uploads"),
        {

          nome: arquivo.name,

          url,

          caminho,

          enviadoPor: usuarioAtual.email,

          data: serverTimestamp()

        }

      );


    }catch(error){

      console.error(
        "Erro upload:",
        error
      );

    }


  }


  alert("Upload concluído");


  carregarUploads();


});


}

// ===============================
// CARREGAR UPLOADS
// ===============================

async function carregarUploads(){

  const lista = document.getElementById("listaUploads");

  if(!lista) return;


  lista.innerHTML = "";


  try{


    const q = query(
      collection(db,"uploads"),
      orderBy("data","desc")
    );


    const resultado = await getDocs(q);



    resultado.forEach((item)=>{


      const arquivo = item.data();



      lista.innerHTML += `

      <div class="admin-card">

        <h3>
          ${arquivo.nome}
        </h3>


        <a 
        href="${arquivo.url}"
        target="_blank">
          Abrir arquivo
        </a>


        <button 
        class="btnExcluirUpload"
        data-id="${item.id}"
        data-path="${arquivo.caminho}">
          Excluir
        </button>


      </div>

      `;


    });



    document.querySelectorAll(".btnExcluirUpload")
    .forEach(botao=>{


      botao.addEventListener("click",async()=>{


        const id = botao.dataset.id;
        const caminho = botao.dataset.path;



        try{


          // remove do storage

          const arquivoRef = ref(
            storage,
            caminho
          );


          await deleteObject(
            arquivoRef
          );



          // remove do firestore

          await deleteDoc(
            doc(db,"uploads",id)
          );



          carregarUploads();



        }catch(error){


          console.error(
            "Erro ao excluir upload:",
            error
          );


        }



      });



    });



  }catch(error){


    console.error(
      "Erro ao carregar uploads:",
      error
    );


  }


}



// ===============================
// ATUALIZAR PERFIL ADMIN
// ===============================


async function atualizarPerfil(dados){


  if(!usuarioAtual) return;



  await updateDoc(
    doc(db,"usuarios",usuarioAtual.uid),
    dados
  );


  console.log(
    "Perfil atualizado"
  );


}

// ===============================
// NOTIFICAÇÕES ADMIN
// ===============================

const formNotificacao = document.getElementById("formNotificacao");


if(formNotificacao){


  formNotificacao.addEventListener("submit", async(e)=>{


    e.preventDefault();



    const titulo = document.getElementById("tituloNotificacao").value;

    const mensagem = document.getElementById("mensagemNotificacao").value;



    try{


      await addDoc(
        collection(db,"notificacoes"),
        {

          titulo,

          mensagem,

          criadoPor: usuarioAtual.email,

          criadoEm: serverTimestamp(),

          lida:false

        }
      );



      formNotificacao.reset();



      alert(
        "Notificação criada!"
      );



    }catch(error){


      console.error(
        "Erro ao criar notificação:",
        error
      );


    }



  });


}



// ===============================
// BUSCA NO ADMIN
// ===============================


const campoBusca = document.getElementById("buscaAdmin");


if(campoBusca){


  campoBusca.addEventListener(
    "input",
    ()=>{


      const termo = campoBusca.value
      .toLowerCase();



      document
      .querySelectorAll(".admin-card")
      .forEach(card=>{


        const texto = card.innerText
        .toLowerCase();



        if(texto.includes(termo)){

          card.style.display="block";

        }else{

          card.style.display="none";

        }


      });


    }
  );


}



// ===============================
// ATUALIZAÇÃO AUTOMÁTICA
// ===============================


setInterval(()=>{


  if(usuarioAtual){


    carregarCultos();

    carregarUploads();


  }


},60000);
