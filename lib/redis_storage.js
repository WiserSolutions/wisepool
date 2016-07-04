'use strict'

const url = require('url')
const Log = require('./log')
const Bluebird = require('bluebird')
const redis = Bluebird.promisifyAll(require('redis'))

class RedisStorage {
  constructor(options) {
    options = options || {}
    var storage_url = url.parse(options.url || "http://localhost/0")
    this.log = options.log || new Log()
    this.redis = redis.createClient({
      host: storage_url.hostname,
      port: storage_url.port || 6379
    })
    this.redis_db = parseInt(/\d+/.exec(storage_url.path)) || 0
  }

  *initialize() {
    yield this.redis.selectAsync(this.redis_db)
  }

  *reset() {
    yield this.redis.delAsync('resources:pool')
    yield this.redis.delAsync('resources:acquired')
  }

  *getAll() {
    var resources = yield this.redis.lrangeAsync('resources:pool', 0, -1)
    return resources.map(JSON.parse)
  }

  *push(resource) {
    if (!resource.id) {
      this.log.error({resource}, 'Has no id')
      throw new Error('Resource contains no id')
    }
    yield this.redis.lpushAsync('resources:pool', JSON.stringify(resource))
  }

  *acquire() {
    var json = yield this.redis.lpopAsync('resources:pool')
    if (!json) return null
    var resource = JSON.parse(json)
    yield this.redis.hsetAsync('resources:acquired', resource.id, json)
    return resource
  }

  *release(id) {
    var json = yield this.redis.hgetAsync('resources:acquired', id)
    yield this.redis.lpushAsync('resources:pool', json)
  }
}

module.exports = RedisStorage
