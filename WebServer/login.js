var mysql = require('mysql2');
var express = require('express');
var session = require('express-session');
var bodyParser = require('body-parser');
var path = require('path');
var mv = require('mv');
var ftp = require("basic-ftp")
var formidable = require('formidable');
var net = require('net');
var fs = require('fs');

var connectionLogin = mysql.createConnection({
	host     : '172.17.0.2',
	user     : 'root',
	password : 'faceUnlock2021',
	database : 'nodelogin',
    port     : 3306
});

connectionLogin.connect(function(err) {
  if (err) throw err;
});

var connectionUSM = mysql.createConnection({
    host: '172.17.0.2',
    user: 'root',
    password: 'faceUnlock2021',
    database: 'gateUsersDatabase',
    port: 3306
});


connectionUSM.connect(function(err) {
  if (err) throw err;
});

var app = express();
app.use(session({
	secret: 'secret',
	resave: true,
	saveUninitialized: true
}));
app.use(bodyParser.urlencoded({extended : true}));
app.use(bodyParser.json());
app.use(express.static('public'));


app.get('/', function(request, response) {
	response.sendFile(path.join(__dirname + '/login.html'));
});

app.post('/auth', function(request, response) {
	var username = request.body.username;
	var password = request.body.password;
	if (username && password) {
		connectionLogin.query('SELECT * FROM accounts WHERE username = ? AND password = ?', [username, password], function(error, results, fields) {
			if (results.length > 0) {
				request.session.loggedin = true;
				request.session.username = username;
				response.redirect('/home');
			} else {
				response.send('Incorrect Username and/or Password!');
			}			
			response.end();
		});
	} else {
		response.send('Please enter Username and Password!');
		response.end();
	}
});

app.get('/cadastrarUser', function(request, response)
{
    if (request.session.loggedin)
    {
        response.sendFile(path.join(__dirname + '/cadastraruser.html'))
    }
    else
    {
		response.send('Not Authorized User');
        response.end();
    }
});

app.post('/addNewUser', function(request, response) {
    if (request.session.loggedin)
    {
            var form = new formidable.IncomingForm();
            
            form.parse(request, function (err, fields, files) 
            {
                var nome = fields.nome;
                var horaUso = fields.horaUso;
                var addUser = fields.buttAddUser;
                var fotoCadastrar = files.fotoCadastrar.originalFilename;
                if (addUser=="Submit")
                {
                    //Inserindo Na Tabela
                    dbQuery= "INSERT INTO gateUsers (name, picture, useTime, encodedPicture) VALUES ('"+nome+"', 'temporary', '"+horaUso+"', 'temporary');";
                    connectionUSM.query(dbQuery);
                    //Atualizando foto filename
                    dbQuery= "UPDATE gateUsers SET picture=concat('foto', id, '"+fotoCadastrar.slice(-4)+"') WHERE name='"+nome+"';";
                    connectionUSM.query(dbQuery);
                    var oldpath = files.fotoCadastrar.filepath;
                    connectionUSM.query("SELECT * FROM gateUsers WHERE name='"+nome+"';", function (err, result, fields) 
                    {
                        var newpath =  path.join(__dirname +"/public/"+result[0].picture);
                        mv(oldpath, newpath, function (err)
                        {
                            if (err) throw err;
                            connectToFTPServerToUploadPicture(result[0].picture);

                            // Apenas para teste, já que o socket/servidor de processamento não funcionava aqui

                            //Communicating with Processing Server to encode the new user image
                            var client = new net.Socket();
                            client.connect(12000, '192.168.0.12', function()
                            {
                                client.write('SENDING_IMAGE_TO_STORE_FILENAME='+result[0].picture);
                                var receveidString=0;
                                client.on('data', (data) =>
                                {;
                                    if (receveidString=="SENDING_ENCODED_FACE")
                                    {
                                        dbQuery= "UPDATE gateUsers SET encodedPicture='"+data.toString()+"' WHERE name='"+nome+"';";
                                        connectionUSM.query(dbQuery);
                                    }
                                    if (data.toString()=="SENDING_ENCODED_FACE")
                                    {
                                        console.log("Codificação realizada com sucesso");
                                        receveidString="SENDING_ENCODED_FACE";
                                        response.redirect('/home');
                                    }
                                    else
                                    {
                                        if(data.toString()=="IMAGE_ENCODING_FAILED")
                                        {
                                            console.log("Codificação falhou, tente outra imagem")
                                            fs.unlinkSync(path.join(__dirname +"/public/" + result[0].picture));
                                            connectToFTPServerToDeletePicture(result[0].picture);
                                            dbQuery= "DELETE FROM gateUsers WHERE name='"+nome+"';";
                                            connectionUSM.query(dbQuery);
                                            console.log(nome+" Deletado do banco de dados");
                                            response.redirect('/falhaCadastrar');
                                        }
                                    }
                                    
                                });
                            });
                            
                        });
                        
                    });
                }
            });
    }
    else
    {
        response.send('Not Authorized User');
        response.end();
    }
});

app.get('/falhaCadastrar', function(request, response){
    if (request.session.loggedin)
    {
        response.write('<!DOCTYPE html>');
        response.write('<html lang="pt-br">');
            response.write('<head>');
                response.write('<meta charset="UTF-8">')
                response.write('<meta http-equiv="X-UA-Compatible" content="IE=edge">');
                response.write('<meta name="viewport" content="width=device-width, initial-scale=1.1">');
                response.write('<script type="module" src="https://unpkg.com/ionicons@5.5.2/dist/ionicons/ionicons.esm.js"></script>');
                response.write('<script nomodule src="https://unpkg.com/ionicons@5.5.2/dist/ionicons/ionicons.js"></script>');
                response.write('<link rel="preconnect" href="https://fonts.googleapis.com">');
                response.write('<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>');
                response.write('<link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300&display=swap" rel="stylesheet">');
                response.write('<link rel="stylesheet" type="text/css" href="css/reset.css">');
                response.write('<link rel="stylesheet" type="text/css" href="css/style.css">');
                response.write('<title>FaceUnlock Fail at User Registers</title>')
            response.write('</head>')
            response.write('<body>')
                response.write('Imagem de cadastro Inválida')
                response.write('<form action="/home" method="get"><button name="voltarHome" ">Voltar</button></form>')
        response.write('</html>')
        response.end();
    }
    else
    {
		response.send('Not Authorized User');
        response.end();
    }
});

app.post('/deletarUser', function(request, response) {
    if (request.session.loggedin)
    {
        connectionUSM.query("SELECT * FROM gateUsers WHERE id='"+request.body.buttDeletar+"';", function (err, result, fields)
        {
            fs.unlinkSync(path.join(__dirname +"/public/" + result[0].picture));
            connectToFTPServerToDeletePicture(result[0].picture);
            dbQuery= "DELETE FROM gateUsers WHERE id="+request.body.buttDeletar+";";
            connectionUSM.query(dbQuery);
        });
        response.redirect('/home');
    }
    else
    {
        response.send('Not Authorized User');
        response.end();
    }
});

async function connectToFTPServerToDeletePicture(filename)
{
    var client = new ftp.Client();
    console.log("Connecting to FTP Server to Delete Pictures...")
    client.ftp.verbose = false;
    try {
        await client.access({
            host: "192.168.0.12",
            user: "FTPUser",
            password: "faceUnlock2021",
            secure: false,
            port: 21
        })
        await client.remove(filename);
    }
    catch(err) {
        console.log(err)
    }
    client.close()
}

async function connectToFTPServerToUploadPicture(filename)
{
    var client = new ftp.Client();
    console.log("Connecting to FTP Server to Upload Pictures...")
    client.ftp.verbose = false;
    try {
        await client.access({
            host: "192.168.0.12",
            user: "FTPUser",
            password: "faceUnlock2021",
            secure: false,
            port: 21
        })
        await client.uploadFrom(path.join(__dirname + '/public/'+filename), filename);
    }
    catch(err) {
        console.log(err)
    }
    client.close()
}

async function connectToFTPServerToDownloadPictures()
{
    var client = new ftp.Client()
    console.log("Connecting to FTP Server to Download Pictures...")
    client.ftp.verbose = true
    try {
        await client.access({
            host: "192.168.0.12",
            user: "FTPUser",
            password: "faceUnlock2021",
            secure: false,
            port: 21
        })
        lista = await client.list();
        for (let index = 0; index < lista.length; index++)
        {
            if (lista[index].name.slice(-4)==".png" || lista[index].name.slice(-4)==".jpg")
            {
                await client.downloadTo("public/"+lista[index].name, lista[index].name);
            }
        } 
    }
    catch(err) {
        console.log(err)
    }
    client.close()
}

app.get('/home', function(request, response) {
	if (request.session.loggedin) 
    {
		response.write('<!DOCTYPE html>');
        response.write('<html lang="pt-br">');
            response.write('<head>');
                response.write('<meta charset="UTF-8">')
                response.write('<meta http-equiv="X-UA-Compatible" content="IE=edge">');
                response.write('<meta name="viewport" content="width=device-width, initial-scale=1.1">');
                response.write('<script type="module" src="https://unpkg.com/ionicons@5.5.2/dist/ionicons/ionicons.esm.js"></script>');
                response.write('<script nomodule src="https://unpkg.com/ionicons@5.5.2/dist/ionicons/ionicons.js"></script>');
                response.write('<link rel="preconnect" href="https://fonts.googleapis.com">');
                response.write('<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>');
                response.write('<link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300&display=swap" rel="stylesheet">');
                response.write('<link rel="stylesheet" type="text/css" href="css/reset.css">');
                response.write('<link rel="stylesheet" type="text/css" href="css/style.css">');
                response.write('<title>FaceUnlock Users Manager</title>')
            response.write('</head>')
            response.write('<body>')
            response.write('<div class="modal-home">')
                response.write('<div class="area-botoes-home">')
                    response.write('<form action="/cadastrarUser" method="GET" id="cadastrarUser"><button type="usuario"  form="cadastrarUser" name="buttCadastrar" value="buttCadastrar">Cadastrar Novo Usuário</button></form>')
                response.write('</div>')
            
                connectionUSM.connect(function(err)
                {
                    if (err) throw err;
                    connectionUSM.query("SELECT * FROM gateUsers", function (err, result, fields) 
                        {
                            if (err) throw err;
                            if (result.length>0)
                            {
                                connectToFTPServerToDownloadPictures()
                                //Create Tables
                                response.write('<table>')
                                    response.write('<colgroup>')
                                        response.write('<col span="1">')
                                        response.write('<col span="2">')
                                        response.write('<col span="3">')
                                        response.write('<col span="4">')
                                        response.write('<col span="5">')
                                    response.write('</colgroup>')
                                    response.write('<thead>')
                                        response.write('<tr>')
                                            response.write('<th>ID</th>')
                                            response.write('<th>Foto</th>')
                                            response.write('<th>Nome</th>')
                                            response.write('<th>Horário de Uso</th>')
                                            response.write('<th>Excluir</th>')
                                            response.write('<th>Editar</th>')
                                        response.write('</tr>')
                                    response.write('</thead>')
                                    response.write('<tbody>')
                                for (let index = 0; index < result.length; index++)
                                {
                                    
                                        response.write('<tr>')
                                            response.write('<td>'+result[index].id+'</td>')
                                            response.write('<td><img src="'+result[index].picture+'" style="width:150px;height:200px"></td>')
                                            response.write('<td>'+result[index].name+'</td>')
                                            response.write('<td>'+result[index].useTime+'</td>')
                                            response.write('<td><form action="/deletarUser" method="POST" id="manageUser"><button type="excluir" name="buttDeletar" value="'+result[index].id+'">Excluir</button></form></td>')
                                            response.write('<td><form action="/mudarCadastroUser" method="POST" id="manageUser"><button type="excluir" name="buttEditar" value="'+result[index].id+'">Editar</button></form></td>')
                                        response.write('</tr>')
                                }   
                                response.write('</tbody>')
                                response.write('</table>')
                                response.write('</div>')
                            response.write('</body>')
                        response.write('</html>');
                            }
                            else
                            {
                                response.write('</div>')
                            response.write('</body>')
                        response.write('</html>');
                        response.end();
                            }
                        });
                });
	} 
	else 
    {
		response.send('Not Authorized User');
        response.end();
	}
});

app.post('/mudarCadastroUser', function(request, response)
{
    if (request.session.loggedin)
    {
        var form = new formidable.IncomingForm();

        connectionUSM.query("SELECT * FROM gateUsers WHERE id='"+request.body.buttEditar+"';", function (err, result, fields)
        {

        response.write('<!DOCTYPE html>');
        response.write('<html lang="pt-br">');
        response.write('<head>');
            response.write('<meta charset="UTF-8">')
            response.write('<meta http-equiv="X-UA-Compatible" content="IE=edge">');
            response.write('<meta name="viewport" content="width=device-width, initial-scale=1.1">');
            response.write('<script type="module" src="https://unpkg.com/ionicons@5.5.2/dist/ionicons/ionicons.esm.js"></script>');
            response.write('<script nomodule src="https://unpkg.com/ionicons@5.5.2/dist/ionicons/ionicons.js"></script>');
            response.write('<link rel="preconnect" href="https://fonts.googleapis.com">');
            response.write('<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>');
            response.write('<link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300&display=swap" rel="stylesheet">');
            response.write('<link rel="stylesheet" type="text/css" href="css/reset.css">');
            response.write('<link rel="stylesheet" type="text/css" href="css/style.css">');
            response.write('<title>FaceUnlock User Updater</title>')
        
            response.write('<script>')
                response.write('var inputs = document.querySelectorAll( ".inputfile" );')
                    response.write('Array.prototype.forEach.call( inputs, function( input ) {')
                        response.write('var label	 = input.nextElementSibling')
                        response.write('var labelVal = label.innerHTML;')
                        response.write('input.addEventListener( "change", function( e ) {')
                            response.write('var fileName = "";')
                            response.write('if( this.files && this.files.length > 1 )')
                                response.write('fileName = ( this.getAttribute( "data-multiple-caption" ) || "" ).replace( "{count}", this.files.length );')
                            response.write('else')
                                response.write('fileName = e.target.value.split( "\"" ).pop();')
                            response.write('if( fileName )')
                                response.write('label.querySelector( "span" ).innerHTML = fileName;')
                            response.write('else')
                                response.write('label.innerHTML = labelVal')
                        response.write('});')
                    response.write('});')
            response.write('</script>')
        response.write('</head>')

        response.write('<body>')
        response.write('<div class="modal">')
        response.write('<img src="assets/FaceUnlock-logo.png" alt="Face Unlock Logo">')
        response.write('<p>Insira as informações atualizadas do usuário</p>')
        response.write('<form action="updateUser" method="POST" enctype="multipart/form-data" id="updateUser">')

        

            response.write('<div class="input-area">')
                response.write('<p>Nome</p>')
                response.write('<input type="text" name="nome" id="nome" value="'+result[0].name+'" required>')
            response.write('</div>')

            response.write('<div class="input-area">')
                response.write('<p>Hora de Uso</p>')
                response.write('<input type="text" name="horaUso" id="horaUso" value="'+result[0].useTime+'" required>')
            response.write('</div>')

            response.write('<div class="area-envio-arquivo">')
                response.write('<label for="fotoCadastrar">')
                    response.write('<span>Escolher Foto do Usuário&hellip;</span>')
                response.write('</label>')
                response.write('<input type="file" id="fotoCadastrar" name="fotoCadastrar" class="inputfile" accept="image/png, image/jpeg, image/jpg">')
            response.write('</div>')
        
            response.write('<input type="text" name="hiddenIDbutton" id="hiddenButton" value="'+request.body.buttEditar+'" style="display: none;">')
            response.write('<button type="submit" form="updateUser" name="buttUpdate" value="Submit">Atualizar Usuário</button>')
			
        response.write('</form>')

    

        response.write('<form action="home" method="GET" id="returnForm">')
            response.write('<button type="navigation" form="returnForm" name="Return" value="Return">Voltar</button>')
        response.write('</form>')
    
        response.write('</div>')
        response.write('</body>')
        response.write('</html>');
    })
    }
    else
    {
		response.send('Not Authorized User');
        response.end();
    }
});

app.post('/updateUser', function(request, response) {
    if (request.session.loggedin)
    {
            var form = new formidable.IncomingForm();
            
            form.parse(request, function (err, fields, files) 
            {
                var nome = fields.nome;
                var horaUso = fields.horaUso;
                var addUser = fields.buttUpdate;
                var fotoCadastrar = files.fotoCadastrar.originalFilename;
                var id = fields.hiddenIDbutton;
                if (addUser=="Submit")
                {
                    //Inserindo Na Tabela
                    dbQuery= "UPDATE gateUsers SET name = '"+nome+"', picture = 'temporary', useTime = '"+horaUso+"', encodedPicture = 'temporary' WHERE id='"+id+"';";
                    connectionUSM.query(dbQuery);
                    //Atualizando foto filename
                    dbQuery= "UPDATE gateUsers SET picture=concat('foto', id, '"+fotoCadastrar.slice(-4)+"') WHERE name='"+nome+"';";
                    connectionUSM.query(dbQuery);
                    var oldpath = files.fotoCadastrar.filepath;
                    connectionUSM.query("SELECT * FROM gateUsers WHERE name='"+nome+"';", function (err, result, fields) 
                    {
                        var newpath =  path.join(__dirname +"/public/"+result[0].picture);
                        mv(oldpath, newpath, function (err)
                        {
                            if (err) throw err;
                            connectToFTPServerToUploadPicture(result[0].picture);

                            //Communicating with Processing Server to encode the new user image
                            var client = new net.Socket();
                            client.connect(12000, '192.168.0.12', function()
                            {
                                client.write('SENDING_IMAGE_TO_STORE_FILENAME='+result[0].picture);
                                var receveidString=0;
                                client.on('data', (data) =>
                                {;
                                    if (receveidString=="SENDING_ENCODED_FACE")
                                    {
                                        dbQuery= "UPDATE gateUsers SET encodedPicture='"+data.toString()+"' WHERE name='"+nome+"';";
                                        connectionUSM.query(dbQuery);
                                    }
                                    if (data.toString()=="SENDING_ENCODED_FACE")
                                    {
                                        console.log("Codificação realizada com sucesso");
                                        receveidString="SENDING_ENCODED_FACE";
                                        response.redirect('/home');
                                    }
                                    else
                                    {
                                        if(data.toString()=="IMAGE_ENCODING_FAILED")
                                        {
                                            console.log("Codificação falhou, tente outra imagem")
                                            fs.unlinkSync(path.join(__dirname +"/public/" + result[0].picture));
                                            connectToFTPServerToDeletePicture(result[0].picture);
                                            dbQuery= "DELETE FROM gateUsers WHERE name='"+nome+"';";
                                            connectionUSM.query(dbQuery);
                                            console.log(nome+" Deletado do banco de dados");
                                            response.redirect('/falhaCadastrar');
                                        }
                                    }
                                    
                                });
                            });
                            
                        });
                        
                    });
                }
            });
    }
    else
    {
        response.send('Not Authorized User');
        response.end();
    }
});


app.listen(3000);
console.log("WebServer pronto para ouvir na porta 3000")
