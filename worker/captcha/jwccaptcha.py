import os
import tflearn
from tflearn.layers.core import input_data, dropout, fully_connected, flatten
from tflearn.layers.conv import conv_2d, max_pool_2d
from tflearn.layers.normalization import batch_normalization
from tflearn.layers.estimator import regression
import numpy as np
from PIL import Image
import json
import traceback

MODEL_NAME = 'gpa_captcha.tflearn'
MODEL_PATH = './worker/captcha/models'

MAX_CAPTCHA = 4  # 验证码字符长度（4位验证码）（4）
CHAR_SET_LEN = 10  # 验证码字符取值（0-9）（10）
IMAGE_WIDTH = 210  # 图像宽度
IMAGE_HEIGHT = 100  # 图像高度

#
# 字符转向量
def text2vec(text):
    vector = np.zeros(MAX_CAPTCHA * CHAR_SET_LEN)
    for i, c in enumerate(text):
        vector[i * 10 + ord(c)-48] = 1
    return vector


# 向量转字符
def vec2text(vec):
    text = ""
    max_value = []
    for i in range(MAX_CAPTCHA):
        max_value.append(np.max(vec[i * CHAR_SET_LEN:(i + 1) * CHAR_SET_LEN]))
    for i, c in enumerate(vec):
        if c == max_value[int(i/CHAR_SET_LEN)]:
            vec[i] = 1
        else:
            vec[i] = 0
    # 只适合纯数字，有谁有闲情逸致写一下支持字母的
    for i, c in enumerate(vec):
        if c == 1:
            text += str(i % 10)
    return text


# 图像转灰度
def convert2gray(img):
    if len(img.shape) > 2:
        gray = np.mean(img, -1)
        return gray
    else:
        return img


class JWCCaptchaCrack(object):
    def __init__(self):
        # 定义网络架构并加载模型
        network = input_data(shape=[None, IMAGE_HEIGHT, IMAGE_WIDTH, 1], name='input')
        network = conv_2d(network, 8, 3, activation='relu', regularizer="L2")
        network = max_pool_2d(network, 2)
        network = batch_normalization(network)
        network = conv_2d(network, 16, 3, activation='relu', regularizer="L2")
        network = max_pool_2d(network, 2)
        network = batch_normalization(network)
        network = conv_2d(network, 16, 3, activation='relu', regularizer="L2")
        network = max_pool_2d(network, 2)
        network = batch_normalization(network)
        network = fully_connected(network, 256, activation='tanh')
        network = dropout(network, 0.8)
        network = fully_connected(network, 256, activation='tanh')
        network = dropout(network, 0.8)
        network = fully_connected(network, MAX_CAPTCHA * CHAR_SET_LEN, activation='softmax')
        network = regression(network, optimizer='adam', learning_rate=0.001,
                             loss='categorical_crossentropy', name='target')
        self.cnn = tflearn.DNN(network)
        self.cnn.load(os.path.join(MODEL_PATH, MODEL_NAME))

    def predict(self, image):
        vec = np.zeros([1, IMAGE_HEIGHT, IMAGE_WIDTH])
        vec[0, :] = convert2gray(np.array(image))
        vec = vec.reshape([-1, IMAGE_HEIGHT, IMAGE_WIDTH, 1])
        result = self.cnn.predict(vec)[0]
        result = vec2text(result)
        return result

if __name__ == '__main__':
    engine = JWCCaptchaCrack()
    print('loaded')
    while True:
        try:
            imagePath = input()
            print(imagePath)
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
