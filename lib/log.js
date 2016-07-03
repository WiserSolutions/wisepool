var bunyan = require('bunyan')
var mkdirp = require('mkdirp')
var process = require('process')


module.exports = function() {
  var logsDir = `${__dirname}/../logs`
  mkdirp.sync(logsDir)

  var bunyanStreams = [
    { path: `${logsDir}/svc.log` },
    { stream: process.stdout }
  ]

  return bunyan.createLogger({
    name: 'docker_pool_service',
    level: 'trace',
    serializers: bunyan.stdSerializers,
    streams: bunyanStreams
  })
}
