'use strict'

class InMemoryRepository {
  constructor() {
    this.storage = []
  }

  *add(resource) {
    if (resource instanceof Array) {
      this.addAll(resource)
    }
    else {
      this.storage.push(resource)
    }
  }

  addAll(resources) {
    for (var res of resources) {
      this.storage.push(res)
    }
  }

  *getAll() {
    return this.storage.map(_ => _)
  }
}

module.exports = InMemoryRepository
