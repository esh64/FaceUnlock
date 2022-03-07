import face_recognition
import numpy as np

#this function opens the newImage file and returns it in RAM
def readImage(filename=None):
    if filename==None:
        return face_recognition.load_image_file("NewImageToSend.jpg")
    return face_recognition.load_image_file(filename)

#this function will search the image for faces, but only the largest face will be considered and returned
def detectFaces(raw_image):
    face_locations = face_recognition.face_locations(raw_image)
    face=None
    areaMax=None
    for face_location in face_locations:
        top, right, bottom, left = face_location
        if areaMax==None:
            face = raw_image[top:bottom, left:right]
            areaMax=abs(bottom-top)*abs(left-right)
        else:
            if abs(bottom-top)*abs(left-right)>areaMax:
                face = raw_image[top:bottom, left:right]
                areaMax=abs(bottom-top)*abs(left-right)
    return face

#this function will analize a face image and returns the userID if the image have strong similarity with any of the images in the system, returns none if the image is have no similarity with the system images. Only the lowest similarity will be considered
def recognizeFace(filename, known_faces_encoded, users_ID):
    new_face_encoding=encodeImage(filename)
    if type(new_face_encoding)==type(None):
        return None
    minDistance=None
    minDistanceId=None
    for knowFace, userID in zip(known_faces_encoded, users_ID):
        distance=np.linalg.norm(knowFace - new_face_encoding, axis=0)
        if distance<0.55:
            if minDistance==None:
                minDistance=distance
                minDistanceId=userID
            else:
                if distance<minDistance:
                    minDistance=distance
                    minDistanceId=userID
    return minDistanceId

#this function will encode the image to be used to compare images
def encodeImage(filename):
    try:
        image=readImage(filename)
    except:
        print("Erro ao abrir a imagem")
        return None
    try:
        face=detectFaces(image)
    except:
        print("Error ao detectar faces")
        return None
    if type(face)==type(None):
        return None
    try:
        encoded=face_recognition.face_encodings(face)[0]
    except:
        print("Erro ao codificar imagem")
        return None
    return encoded

        
    
    
    
    
