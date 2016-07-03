global.sinon = require('sinon')

var chai = require('chai')
chai.use(require('sinon-chai'))

global.expect = chai.expect

global.faker = require('faker')
