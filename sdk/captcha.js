const showapiSdk = require('showapi-sdk');
const fs = require('fs')
const { captcha } = require('./sdk.json')

showapiSdk.setting({
    url:"http://route.showapi.com/184-4",
    appId:captcha.appId,
    secret:captcha.secret,
    timeout:5000
})

exports.recognizeCaptcha = async (imageData, vtoken) => {
    let tmpPath = `/tmp/newxk-${vtoken}.jpg`
    // 出于不可描述的原因要先写入磁盘
    return new Promise((resolve, reject) => {
        fs.writeFileSync(tmpPath, Buffer.from(imageData))
        let request=showapiSdk.request();
        request.appendFile('image', tmpPath)
        request.appendText('typeId','34');
        request.appendText('convert_to_jpg','0');
        request.appendText('needMorePrecise','0');
        request.post(function(data){
            if (data.showapi_res_body.ret_code == 0) {
                // 业务成功
                resolve(data.showapi_res_body.Result)
                // 珍贵的数据集要保存下来
                fs.writeFileSync(`${captcha.savePath}${data.showapi_res_body.Result}-${vtoken}.jpg`,Buffer.from(imageData))
            } else {
                resolve(false)
            }
        })
    })
    
}