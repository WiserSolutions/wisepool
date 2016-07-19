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

  *add(resource) {
    if (!resource.id) {
      this.log.error({resource}, 'Has no id')
      throw new Error('Resource contains no id')
    }
    var json = JSON.stringify(resource)
    yield this.redis.multi()
      .lpush('resources:pool', json)
      .hset('resources:ids', resource.id, json)
      .execAsync()
  }

  *remove(resourceOrId) {
    var resourceId = (typeof resourceOrId === 'string') ? resourceOrId : resourceOrId.id
    var resource = yield this.redis.hgetAsync('resources:ids', resourceId)
    if (!resource) {
      var err = new Error("Can't remove not-existing resource")
      err.resource = resource
      throw err
    }
    yield this.redis.multi()
      .hdel('resources:ids', resourceId)
      .hdel('resources:acquired', resourceId)
      .lrem('resources:pool', 0, resource)
      .execAsync()
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
    yield this.redis.hdelAsync('resources:acquired', id)
    if (!json) return
    yield this.redis.lpushAsync('resources:pool', json)
  }

  *isEmpty() {
    var count = yield this.redis.llenAsync('resources:pool')
    return count === 0
  }

  *getCount() {
    var available = yield this.redis.llenAsync('resources:pool')
    var acquired = yield this.redis.hlenAsync('resources:acquired')
    return acquired + available
  }
}

module.exports = RedisStorage
