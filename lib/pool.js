'use strict'

const InMemoryStorage = require('./in_memory_storage')
const _ = require('lodash')
const Log = require('./log')
const shortid = require('shortid')

class Pool {
  constructor(options) {
    options = options || Log()
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
    for (var res of resources) {
     this.log.trace(res, 'Init: Adding from repository')
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
    }
  }

  *removeInvalidResources() {
    var poolResources = yield this.storage.getAll()
    for (var res of poolResources) {
      var isValid = yield this.validate(res)
      if (isValid) continue

      this.log.trace(res, 'GC: Evicting invalid resource')
      yield this.storage.remove(res)
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
    }
    return resource || null
  }

  *release(id) {
    yield this.storage.release(id)
    this.log.trace({id}, "Resource released")
  }

  *tryCreate() {
    if (!this.repository || !this.repository.create) return null

    try {
      var resource = yield this.repository.create()
      this.log.trace({resource}, "Resource created")
      return resource
    }
    catch (ex) {
      this.log.error(ex, "Unable to create resource")
      return null
    }
  }
}

module.exports = Pool
