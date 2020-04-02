const { authenticate } = require('ldap-authentication')
const ldapConfig = require('../../../sdk/sdk.json').ldap
exports.route = {
  async post({ cardnum, password }) {
    console.log(cardnum, password)
    let authenticated = await authenticate({
      ldapOpts: { url: ldapConfig.ldapUrl },
      adminDn: ldapConfig.adminDn,
      adminPassword: ldapConfig.adminPassword,
      userSearchBase: ldapConfig.userSearchBase,
      username: cardnum,
      userPassword: password,
      usernameAttribute: 'uid',
    })
    console.log(authenticated)
    return authenticated
  }
}