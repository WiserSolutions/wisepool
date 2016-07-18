'use strict'

const _ = require('lodash')
const shortid = require('shortid')

class InMemoryStorage {
  constructor() {
    this.storage = []
    this.acquired = {}
  }

  *isEmpty() {
    return this.storage.length === 0
  }

  *getCount() {
    return this.storage.length + Object.keys(this.acquired).length
  }

  *add(resource) {
    if (!resource.id) resource.id = shortid.generate()
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

  *remove(resourceOrId) {
    if (!resourceOrId) return
    var resourceId = (typeof resourceOrId === 'string') ? resourceOrId : resourceOrId.id
    _.remove(this.storage, _ => _.id == resourceId)
    delete this.acquired[resourceId]
  }

  *getAll() {
    return this.storage.map(_ => _)
  }
}

module.exports = InMemoryStorage
