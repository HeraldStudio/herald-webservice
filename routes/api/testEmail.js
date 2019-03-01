const emailTransport = (require('../../sdk/email')).morningExerciseEmailTransporter
exports.route = {
    async get() {
        emailTransport.sendMail({
                from: '小猴偷米跑操预报 <morning-exercise@myseu.cn>', // sender address
                to: 'gaoruihao@wolf-tungsten.com', // list of receivers
                subject: 'Hello world', // Subject line
                text: 'Hello world ?', // plain text body
                html: 'Hello world ?' // html body    
                },(error, info) => {
                if (error) {
                    return console.log(error);
                }
                console.log('Message %s sent: %s', info.messageId, info.response);
            })

    }
}
