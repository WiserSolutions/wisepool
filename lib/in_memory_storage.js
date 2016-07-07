'use strict'

var _ = require('lodash')

class InMemoryStorage {
  constructor() {
    this.storage = []
    this.acquired = {}
  }

  *isEmpty() {
    return this.storage.length === 0
  }

  *add(resource) {
    this.storage.push(resource)
  }

  *acquire() {
    var resource = this.storage.pop()
    if (resource && resource.id) {
      this.acquired[resource.id] = resource
    }
    return resource
  }

  *release(id) {
    if (!id) return
    var resource = this.acquired[id]
    delete this.acquired[id]
    this.storage.push(resource)
  }

  *remove(resource) {
    this.storage = _.without(this.storage, resource)
  }

  *getAll() {
    return this.storage.map(_ => _)
  }
}

module.exports = InMemoryStorage
