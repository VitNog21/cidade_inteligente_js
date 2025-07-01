Configuração e Instalação

Para configurar o ambiente do projeto após o download, siga os passos abaixo.

1. Pré-requisitos de Software

    Node.js e npm (Versão 18 ou superior)

    Compilador Protocol Buffers (protoc)

2. Passos de Instalação

Execute os seguintes comandos no terminal, a partir da pasta raiz do projeto.

a. Instale as Dependências do Backend:

npm install

b. Compile o Arquivo .proto:

npm run build-proto

c. Instale as Dependências do Frontend:

cd frontend
npm install