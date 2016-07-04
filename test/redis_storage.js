const RedisStorage = require('./../lib/redis_storage')
const co = require('co')

describe("RedisStorage", function() {
  var storage, resource
  beforeEach(function*() {
    resource = { id: faker.random.uuid() }
    storage = new RedisStorage()
    yield storage.reset()
  })

  describe("add", function() {
    it ('returns empty array when no resources', function*() {
      var resources = yield storage.getAll()
      // expect(resources).to.be.empty
      expect(resources).to.deep.equal([])
    })

    it ('returns all resources', function*() {
      yield storage.push(resource)
      var resources = yield storage.getAll()
      expect(resources).to.deep.equal([resource])
    })
  })

  describe('push', function() {
    it ('fails if resource has no id', function*() {
      delete resource.id
      var push = co.wrap(storage.push).bind(storage)
      yield expect(push(resource))
        .to.be.rejectedWith(Error, 'Resource contains no id')
    })

    it ('adds the resource to the pool', function*() {
      yield storage.push(resource)
      expect(yield storage.getAll())
        .to.deep.equal([resource])
    })
  })

  describe('acquire', function() {
    it ('returns a resource', function*() {
      yield storage.push(resource)
      var r = yield storage.acquire()
      expect(r).to.deep.equal(resource)
    })

    it ('removes the resource from the pool', function*() {
      yield storage.push(resource)
      yield storage.acquire()
      expect(yield storage.getAll()).to.deep.equal([])
    })
  })

  describe('release', function() {
    it ('returns the resource to the pool', function*() {
      yield storage.push(resource)
      var res = yield storage.acquire()
      yield storage.release(res.id)
      expect(yield storage.getAll()).to.deep.equal([resource])
    })
  })
})
