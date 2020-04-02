const { authenticate } = require('ldap-authentication')
const ldapConfig = require('../../../sdk/sdk.json').ldap
exports.route = {
  async post({ cardnum, password }) {
    let authenticated
    try {
      authenticated = await authenticate({
        ldapOpts: { url: ldapConfig.ldapUrl },
        adminDn: ldapConfig.adminDn,
        adminPassword: ldapConfig.adminPassword,
        userSearchBase: ldapConfig.userSearchBase,
        username: cardnum,
        userPassword: password,
        usernameAttribute: 'uid',
      })
    } catch (err) {
      if(err.lde_message === 'Invalid Credentials'){
        throw '密码错误'
      }else if(err.name === 'LdapAuthenticationError'){
        throw '一卡通不存在'
      }else{
        throw err
      }
    }
    return authenticated
  }
}