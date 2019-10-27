const imaps = require('imap-simple')
exports.route = {
  async get(){
    let config = {
      imap: {
        user: this.user['cardnum']+'@seu.edu.cn',
        password: this.user['password'],
        host: 'imap.seu.edu.cn',
        port: 993,
        tls: true,
        authTimeout: 3000,
        tlsOptions: {
          rejectUnauthorized: false
        }
      }
    }

    let connection = await imaps.connect(config)
    await connection.openBox('INBOX')
        
    //搜索条件
    var searchCriteria = [
      'UNSEEN'
    ]
    var fetchOptions = {
      bodies: ['HEADER', 'TEXT'],
      markSeen: false
    }

    let results = await connection.search(searchCriteria, fetchOptions)

    let subjects = results.map(function (res) {
      return res.parts.filter(function (part) {
        return part.which === 'HEADER'
      })[0].body.subject[0]
    })
    subjects = subjects.map(subject => {

      return (subject === '') ? '无主题邮件' : subject

    })

    return subjects

  }
}