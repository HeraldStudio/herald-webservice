const jquery = require('jquery')
const { JSDOM } = require('jsdom')

module.exports = (html) => jquery(new JSDOM(html).window)