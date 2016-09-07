'use strict'

const _ = require('lodash')
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
    yield this.redis.multi()
      .del('resources:pool')
      .del('resources:acquired')
      .del('resources:ids')
      .execAsync()
  }

  *getAll(options) {
    var ids = yield this.redis.lrangeAsync('resources:pool', 0, -1)
    if (options && options.acquired) {
      ids = ids.concat(yield this.redis.zrangeAsync('resources:acquired', 0, -1))
    }
    var resources = yield _.uniq(ids)
      .map(id => this.redis.hgetAsync('resources:ids', id))
    return resources.map(JSON.parse)
  }

  *add(resource) {
    if (!resource.id) {
      this.log.error({resource}, 'Has no id')
      throw new Error('Resource contains no id')
    }
    var json = JSON.stringify(resource)
    yield this.redis.multi()
      .rpush('resources:pool', resource.id)
      .hset('resources:ids', resource.id, json)
      .execAsync()
  }

  *remove(resourceOrId) {
    var resourceId = (typeof resourceOrId === 'string') ? resourceOrId : resourceOrId.id
    yield this.redis.multi()
      .hdel('resources:ids', resourceId)
      .zrem('resources:acquired', resourceId)
      .lrem('resources:pool', 0, resourceId)
      .execAsync()
  }

  *acquire() {
    var id = yield this.redis.lpopAsync('resources:pool')
    if (!id) return null
    yield this.redis.zaddAsync('resources:acquired', Date.now(), id)
    var resource = yield this.getResource(id)
    resource.__lastAcquiredAt = Date.now()
    yield this.setResource(resource)
    return resource
  }

  *getResource(id) {
    var json = yield this.redis.hgetAsync('resources:ids', id)
    if (!json) return null
    var resource = JSON.parse(json)
    return resource
  }

  *setResource(resource) {
    var id = resource.id
    yield this.redis.hsetAsync('resources:ids', id, JSON.stringify(resource))
  }

  *release(id) {
    if (!id) return

    let resource = yield this.getResource(id)
    if (!resource) return
    resource.__lastReleasedAt = Date.now()
    yield this.setResource(resource)

    let acquiredAt = yield this.redis.zscoreAsync('resources:acquired', id)
    if (acquiredAt) {
      yield this.redis.multi()
        .zrem('resources:acquired', id)
        .rpush('resources:pool', id)
        .execAsync()
      return { acquiredAt, releasedAt: Date.now() }
    }
  }

  *isEmpty() {
    var count = yield this.redis.llenAsync('resources:pool')
    return count === 0
  }

  *getCount() {
    var available = yield this.getPoolCount()
    var acquired = yield this.getAcquiredCount()
    return acquired + available
  }

  *getPoolCount() {
    return yield this.redis.llenAsync('resources:pool')
  }

  *getAcquiredCount() {
    return yield this.redis.zcardAsync('resources:acquired')
  }

  *getAcquiredForMillis(millis) {
    let toTime = Date.now() - millis
    let ids = yield this.redis.zrangebyscoreAsync('resources:acquired', 0, toTime)
    let resources = []
    for (let id of ids || []) {
      resources.push(yield this.redis.hgetAsync('resources:ids', id))
    }
    return resources.map(JSON.parse)
  }
}

module.exports = RedisStorage
