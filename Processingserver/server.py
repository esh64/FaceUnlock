#sudo docker run -p 12000:12000 -v /home/fourier/faceRecognition/:/home/Workspace --name=server -it animcogn/face_recognition
#sudo docker start server
#sudo docker attach server
#import os
#os.chdir("/home/Workspace/Processingserver")
#os.popen("pip install -U pip")
#os.popen("pip install mysql-connector-python")
#import server

import imageOperations
from socket import *
import os
from ftplib import FTP
import mysql.connector
import numpy
import datetime

databaseHost = '172.17.0.2'
serverName = '192.168.0.12'
serverPort = 12000

def startServer():
    serverSocket = socket(AF_INET, SOCK_STREAM)
    serverSocket.bind(('', serverPort))
    serverSocket.listen(1)
    while True:
        print("Server pronto para ouvir")
        (clientsocket, address) = serverSocket.accept()
        print("ouvindo "+str(address))
        message = clientsocket.recv(4096)
        print(message.decode())
        #raspberry pi sending image to authorization
        if message.decode()=='SENDING_IMAGE_TO_AUTHORIZATION':
            #clientsocket.send('RECEIVED'.encode('utf-8'))
            #downloading the imagem from the FTP Server
            error=True
            try:
                ftp = FTP(serverName)
                ftp.login("FTPUser","faceUnlock2021")
                error=False
            except:
                print("Erro ao tentar se comunicar com o servidor FTP")
            
            if error==True:
                continue
            
            error=True
            print("Baixando a imagem")
            while error==True:
                try:
                    with open( "NewImageToSend.jpg", 'wb' ) as file :
                        ftp.retrbinary('RETR %s' % "NewImageToSend.jpg", file.write)
                    error=False
                except:
                    error=True
            ftp.quit()
            print("Imagem Baixada")
            
            print("Fazendo Query no banco de dados")
            #request from database to get the encoded List and names
            try:
                usersGateDatabase = mysql.connector.connect(
                    host="172.17.0.2",
                    user="root",
                    password="faceUnlock2021",
                    database="gateUsersDatabase"
                    )
                userGateDatabaseCursor = usersGateDatabase.cursor()
                userGateDatabaseCursor.execute("SELECT * FROM gateUsers;")
                queryResults= userGateDatabaseCursor.fetchall()
            except:
                print("Falha ao tentar se comunciar com o banco de dados")
                continue
            print("Query realizada com sucesso")
            
            print("Processando Imagem")
            listName=[]
            listEncodedPictureString=[]
            listEncodedPictureFloat=[]
            for result in queryResults:
                listName.append(result[1])
                listEncodedPictureString.append(result[4])
            for listString in listEncodedPictureString:
                encodedPictureArray=[]
                for element in listString.split('|')[1:-1]:
                    encodedPictureArray.append(float(element))
                listEncodedPictureFloat.append(numpy.array(encodedPictureArray))
            conseguiuVerificarFoto=True
            try:
                listEncodedPictureFloat = numpy.array(listEncodedPictureFloat)
                idAuthrization=imageOperations.recognizeFace("NewImageToSend.jpg", listEncodedPictureFloat,listName)
            except:
                print("Falha ao tentar verificar foto")
                conseguiuVerificarFoto=False
            if conseguiuVerificarFoto:
                if idAuthrization==None:
                    clientsocket.send('NOT_AUTHORIZED_USER'.encode('utf-8'))
                else:
                    for result in queryResults:
                        if (idAuthrization == result[1]):
                            useTime = result[3]
                            break
                    useTimeStart = useTime.split("-",1)[0]
                    useTimeEnd = useTime.split("-",1)[1]
                    now = datetime.datetime.now()
                    print(idAuthrization ,int(useTimeStart), int(useTimeEnd), now.hour)
                    if ( (int(useTimeStart) <= now.hour) and  (int(useTimeEnd) >= now.hour) ): 
                        clientsocket.send(idAuthrization.encode('utf-8'))
                    else:
                        clientsocket.send('NOT_AUTHORIZED_USER'.encode('utf-8'))
            else:
                clientsocket.send('NOT_AUTHORIZED_USER'.encode('utf-8'))
                
            clientsocket.close()
            print("Imagem procesada com sucesso")
                
                
        #webserver sending image process and store at database
        if 'SENDING_IMAGE_TO_STORE_FILENAME=' in message.decode():
            ftp = FTP(serverName)
            ftp.login("FTPUser","faceUnlock2021")
            filename=message.decode()
            filename=filename[32:]
            if len(filename)==0:
                clientsocket.send('INVALID_FILENAME'.encode('utf-8'))
                clientsocket.close()
            else:
                error=True
                while error==True:
                    try:
                        with open( filename, 'wb' ) as file :
                            ftp.retrbinary('RETR %s' % filename, file.write)
                        error=False
                    except:
                        error=True
                ftp.quit() 
                encodedFace=imageOperations.encodeImage(filename)
                if type(encodedFace)==type(None):
                    clientsocket.send('IMAGE_ENCODING_FAILED'.encode('utf-8'))
                    os.popen("rm "+filename)
                    clientsocket.close()
                    continue
                stringToSend='|'
                for component in encodedFace:
                    stringToSend+=str(component)+'|'
                try:
                    clientsocket.send('SENDING_ENCODED_FACE'.encode('utf-8'))
                    clientsocket.send(stringToSend.encode('utf-8'))
                    clientsocket.close()
                except:
                    clientsocket.send('IMAGE_ENCODING_FAILED'.encode('utf-8'))
                    clientsocket.close()
                os.popen("rm "+filename)

        else:
            print("CodigoInvalido")
            
startServer()
