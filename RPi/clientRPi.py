from socket import *
import cv2
import pickle
import RPi.GPIO as gpio
import time
from ftplib import FTP

#configurations
serverName = '192.168.0.12'
serverPort = 12000
gpio.setmode(gpio.BCM)
gpio.setwarnings(False)
gpio.setup(26, gpio.IN, pull_up_down = gpio.PUD_DOWN)
gpio.setup(16, gpio.OUT, initial=gpio.HIGH)

def mainFunction():
    while True:
        print("Ligue a chave para iniciar a operação de reconhecimento facial")
        while True:
            #print(gpio.input(26))
            if gpio.input(26) == 1:
                break
        while True:
            #print(gpio.input(26))
            if gpio.input(26)==0:
                break
        print("Comunicando com o servidor")
        try:
            sendImage()
        except:
            print("Erro ao tentar se comunicar com o servidor")
    gpio.cleanup()
            

def sendImage():
    cam = cv2.VideoCapture(0)
    s, image = cam.read()
    #save image to send it to server in bytes format
    cv2.imwrite("NewImageToSend.jpg", image)
    #open image in bytes format
    image = open('NewImageToSend.jpg', 'rb')
    #send code
    #FTP server makes it faster
    #connect to FTP server
    error=False
    try:
        ftp = FTP('192.168.0.12')
        ftp.login("FTPUser","faceUnlock2021")
        ftp.storbinary('STOR NewImageToSend.jpg', image)
        ftp.quit()
    except:
        print("Erro ao tentar enviar imagem para servidor FTP")
        error=True
    print(error)
    if error==False:
        #Image was sent to FTP server with sucess
        print("Comunicando com servidor de processamento")
        clientSocket = socket(AF_INET, SOCK_STREAM)
        clientSocket.connect((serverName, serverPort))
        print("Enviando mensagem pedindo para autorizar imagem")
        clientSocket.send("SENDING_IMAGE_TO_AUTHORIZATION".encode('utf-8'))
        returnMessage = clientSocket.recv(4096)
        print(returnMessage.decode())
        clientSocket.close()
        if returnMessage.decode()=='NOT_AUTHORIZED_USER':
            print("Acesso negado!")
        else:
            print("Acesso permitido, "+returnMessage.decode())
            gpio.output(16, gpio.LOW)
            time.sleep(0.5)
            gpio.output(16, gpio.HIGH)

mainFunction()
