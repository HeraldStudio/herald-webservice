const { config } = require('../../app')

exports.route = {
    get () {
      return config.version
    }
  }