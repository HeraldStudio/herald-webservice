import os
import tflearn
from tflearn.layers.core import input_data, dropout, fully_connected, flatten
from tflearn.layers.conv import conv_2d, max_pool_2d
from tflearn.layers.normalization import batch_normalization
from tflearn.layers.estimator import regression
import numpy as np
from PIL import Image
import cv2
import json


MODEL_NAME = 'library_captcha.tflearn'
MODEL_PATH = './worker/captcha/models'

IMAGE_WIDTH = 160
IMAGE_HEIGHT = 40

CODE_LEN = 4
MAX_CHAR = 26


# 图像转灰度
def convert_to_gray(image):
    gray = cv2.cvtColor(image, cv2.COLOR_RGB2GRAY)
    return gray


# 自适应阈值化处理
def adaptive_threshold(image):
    image = cv2.adaptiveThreshold(image, 100, cv2.ADAPTIVE_THRESH_MEAN_C,cv2.THRESH_BINARY,51,0)
    return image


# 文本转向量
def text2vec(text):
    vec = np.zeros(CODE_LEN * MAX_CHAR)
    for i, c in enumerate(text):
        char = ord(c)
        if ord('a') <= char <= ord('z'):
            char -= (ord('a') - ord('A'))
        assert ord('A') <= char <= ord('Z')  # 否则存在不合法的字符
        vec[i * MAX_CHAR + char - ord('A')] = 1
    return vec


# 向量转文本
def vec2text(vec):
    text = ''
    max_value = []
    for pos in range(CODE_LEN):
        max_value.append(np.max(vec[pos * MAX_CHAR:(pos + 1)*MAX_CHAR]))
    for i, v in enumerate(vec):
        if v == max_value[int(i/MAX_CHAR)]:
            text += chr(i % MAX_CHAR + ord('A'))
    return text


class LibraryCaptchaCrack(object):
    def __init__(self):
        # 定义网络架构并加载模型
        network = input_data(shape=[None, IMAGE_HEIGHT, IMAGE_WIDTH, 1], name='input')
        network = conv_2d(network, 8, 3, activation='relu', regularizer="L2")
        network = max_pool_2d(network, 2)
        network = batch_normalization(network)
        network = conv_2d(network, 16, 6, activation='relu', regularizer="L2")
        network = max_pool_2d(network, 2)
        network = batch_normalization(network)
        network = conv_2d(network, 16, 9, activation='relu', regularizer="L2")
        network = max_pool_2d(network, 2)
        network = batch_normalization(network)
        network = fully_connected(network, 512, activation='tanh')
        network = dropout(network, 0.8)
        network = fully_connected(network, 512, activation='tanh')
        network = dropout(network, 0.8)
        network = fully_connected(network, CODE_LEN * MAX_CHAR, activation='softmax')
        network = regression(network, optimizer='adam', learning_rate=0.001,
                             loss='categorical_crossentropy', name='target')
        self.cnn = tflearn.DNN(network)
        self.cnn.load(os.path.join(MODEL_PATH, MODEL_NAME))

    def predict(self, image):
        image = np.array(image)
        image = adaptive_threshold(convert_to_gray(image))
        valid_x = np.zeros([1, IMAGE_HEIGHT, IMAGE_WIDTH])
        valid_x[0] = image
        valid_x = valid_x.reshape([-1, IMAGE_HEIGHT, IMAGE_WIDTH, 1])
        result = self.cnn.predict(valid_x)
        return vec2text(result[0])

if __name__ == '__main__':
    engine = LibraryCaptchaCrack()
    print('loaded')
    while True:
        try:
            imagePath = input()
            image = Image.open(imagePath)
            result = json.dumps({
              'path': imagePath,
              'result': engine.predict(image)
            })
            print(result)
        except KeyboardInterrupt:
            break
        except:
            pass
