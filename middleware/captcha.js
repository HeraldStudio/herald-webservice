/**
 * Created by WolfTungsten on 2018/3/15.
 */
/**
 * Created by WolfTungsten on 2018/2/16.
 */
const { spawn } = require('child_process');

const captchaJobPool = {};
const captchaJobQueue = [];

let library_active = false;
let jwc_active = false;

const library_process = spawn('python3', [process.cwd() + '/middleware/captcha_childprocess/libcaptcha.py']);
const jwc_process = spawn('python3', [process.cwd() + '/middleware/captcha_childprocess/jwccaptcha.py']);

jwc_process.stdout.on('data', (chunk) => {
  "use strict";
  let message = chunk.toString();
  message = message.substr(0, message.length-1);
  console.log(message);
  if (message === 'loaded') {
     console.log('教务处验证码模型加载成功');
    jwc_active = true;
  }
});

library_process.stdout.on('data', (chunk) => {
  "use strict";
  let message = chunk.toString();
  message = message.substr(0, message.length-1);
  console.log(message);
  if (message === 'loaded') {
    console.log('图书馆验证码模型加载成功');
    library_active = false;
  }
});


jwc_process.stdin.on('error', (err) => {
  "use strict";
  console.log(err);
});

const libcaptcha = (cookie=null) => {
  // 发起请求
  // 保存图片
  // 构造Promise
};

setInterval(()=>{
  "use strict";
  if (jwc_active) {
    jwc_process.stdin.write('/Users/WolfTungsten/Development/tflearn_captcha_crack/example/0345.jpg\n');
    jwc_process.stdin.write('/Users/WolfTungsten/Development/tflearn_captcha_crack/example/0345.jpg\n');
    jwc_process.stdin.write('/Users/WolfTungsten/Development/tflearn_captcha_crack/example/0345.jpg\n');
    jwc_process.stdin.write('/Users/WolfTungsten/Development/tflearn_captcha_crack/example/0345.jpg\n');
    jwc_process.stdin.write('/Users/WolfTungsten/Development/tflearn_captcha_crack/example/0345.jpg\n');
    jwc_process.stdin.write('/Users/WolfTungsten/Development/tflearn_captcha_crack/example/0345.jpg\n');
    jwc_process.stdin.write('/Users/WolfTungsten/Development/tflearn_captcha_crack/example/0345.jpg\n');
    jwc_process.stdin.write('/Users/WolfTungsten/Development/tflearn_captcha_crack/example/0345.jpg\n');
    jwc_process.stdin.write('/Users/WolfTungsten/Development/tflearn_captcha_crack/example/0345.jpg\n');
    jwc_process.stdin.write('/Users/WolfTungsten/Development/tflearn_captcha_crack/example/0345.jpg\n');
    jwc_process.stdin.write('/Users/WolfTungsten/Development/tflearn_captcha_crack/example/0345.jpg\n');
    jwc_process.stdin.write('/Users/WolfTungsten/Development/tflearn_captcha_crack/example/0345.jpg\n');
  }
}, 5000);



