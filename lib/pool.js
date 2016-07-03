'use strict'

const InMemoryStorage = require('./in_memory_storage')
const _ = require('lodash')
const Log = require('./log')

class Pool {
  constructor(options) {
    options = options || Log()
    this.log = options.log || new Log()
    this.storage = options.storage || new InMemoryStorage()
    this.repository = options.repository
    this.validate = options.validate
  }

  *initialize() {
    if (this.repository) {
      var resources = yield this.repository.getAll()
      for (var res of resources) {
        this.log.trace(res, 'Init: Adding from repository')
        yield this.register(res)
      }
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
      if (!isValid) {
        this.log.trace(res, 'GC: Evicting invalid resource')
        yield this.storage.remove(res)
      }
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
    yield this.storage.add(resource)
  }

  *acquire() {
    var resource = yield this.storage.pop()
    return resource || null
  }
}

module.exports = Pool