'use strict'

var _ = require('lodash')

class InMemoryStorage {
  constructor() {
    this.storage = []
  }

  *add(resource) {
    this.storage.push(resource)
  }

  *pop() {
    return this.storage.pop()
  }

  *remove(resource) {
    this.storage = _.without(this.storage, resource)
  }

  *getAll() {
    return this.storage.map(_ => _)
  }
}

module.exports = InMemoryStorage
