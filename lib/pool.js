'use strict'

const InMemoryStorage = require('./in_memory_storage')
const _ = require('lodash')
const Log = require('./log')
const shortid = require('shortid')
const co = require('co')
const Bluebird = require('bluebird')

class Pool {
  constructor(options) {
    options = options || Log()

    this.stats = options.stats
    this.name = options.name || 'default'
    this.metricBaseName = `pool.${this.name}`

    this.log = options.log || new Log()
    this.storage = options.storage || new InMemoryStorage()
    this.repository = options.repository
    this.validate = options.validate
    this.max = options.max || null
  }

  *initialize() {
    yield this.loadResourcesFromRepository()
  }

  *loadResourcesFromRepository() {
    if (!this.repository) return
    var storageIsEmpty = yield this.storage.isEmpty()
    if (!storageIsEmpty) return

    var resources = yield this.repository.getAll()
    for (var res of resources || []) {
      this.log.debug(res, 'Init: Adding from repository')
      yield this.register(res)
    }
  }

  *removeStaleResources() {
    var poolResources = yield this.storage.getAll()
    var repositoryResources = yield this.repository.getAll()
    this.log.debug({
      res,
      inPool: poolResources.length,
      inRepo: repositoryResources.length
    }, 'GC: ')
    var stale = _.differenceBy(poolResources, repositoryResources, _ => _.id)
    for (var res of stale) {
      this.log.trace(res, 'GC: Evicting stale resource')
      yield this.storage.remove(res)
      if (this.stats) this.stats.increment(`${this.metricBaseName}.removed.stale`)
    }
  }

  *removeInvalidResources() {
    var poolResources = yield this.storage.getAll()
    if (this.repository) {
      (yield this.repository.getAll()).forEach(_ => poolResources.push(_))
    }
    for (var res of poolResources) {
      var isValid = yield this.validate(res)
      if (isValid) continue

      this.log.trace(res, 'GC: Evicting invalid resource')
      yield this.destroy(res.id)
      if (this.stats) this.stats.increment(`${this.metricBaseName}.removed.invalid`)
    }
  }

  *garbageCollect() {
    if (this.repository) {
      yield this.removeStaleResources()
    }

    if (this.validate) {
      yield this.removeInvalidResources()
    }
  }

  *register(resource) {
    if (!resource.id) resource.id = shortid.generate()

    if (!this.validate || (yield this.validate(resource))) {
      yield this.storage.add(resource)
    }
  }

  *acquire() {
    var resource = yield this.storage.acquire()
    if (!resource) {
      if (this.max) {
        var currentCount = yield this.storage.getCount()
        if (currentCount >= this.max) return null
      }
      resource = yield this.tryCreate()
      if (!resource) return null
      yield this.register(resource)
      resource = yield this.storage.acquire()
    }
    if (this.stats) {
      if (resource)
        this.stats.increment(`${this.metricBaseName}.acquire.success`)
      else
        this.stats.increment(`${this.metricBaseName}.acquire.miss`)
    }
    return resource || null
  }

  *release(id) {
    if (!id) return

    yield this.storage.release(id)
    this.log.trace({id}, "Resource released")
    if (this.stats) this.stats.increment(`${this.metricBaseName}.released`)
  }

  *destroy(id) {
    if (!id) return

    try {
      yield this.storage.remove(id)
    }
    catch (err) {
      this.log.debug(err, 'Error removing resource from storage')
    }
    try {
      if (this.repository) yield this.repository.destroy(id)
    }
    catch (err) {
      this.log.error(err, 'Error removing resource from repository')
    }

    if (this.stats) this.stats.increment(`${this.metricBaseName}.destroyed`)
  }

  *tryCreate() {
    if (!this.repository || !this.repository.create) return null

    var resource

    try {
      resource = yield this.repository.create()
      this.log.trace({resource}, "Resource created")
      yield this.waitForInService(resource)
      if (this.stats) {
        if (resource) {
          this.stats.increment(`${this.metricBaseName}.create.success`)
        }
        else {
          this.stats.increment(`${this.metricBaseName}.create.fail`)
        }
      }
      return resource
    }
    catch (ex) {
      if (resource) yield this.destroy(resource)

      this.log.debug(ex, "Unable to create resource")
      return null
    }
  }

  *waitForInService(resource) {
    if (!this.validate) return true
    var timeout = this.inServiceWaitTimeoutMillis || 2000

    var start = Date.now()
    while (Date.now() - start < timeout) {
      var inService = yield this.validate(resource)
      if (inService) return true
      yield Bluebird.delay(200)
    }
    return false
  }
}

module.exports = Pool
