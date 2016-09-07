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
      expect(resources).to.deep.equal([])
    })

    it ('returns all resources', function*() {
      yield storage.add(resource)
      var resources = yield storage.getAll()
      expect(resources).to.deep.equal([resource])
    })
  })

  describe('add', function() {
    it ('fails if resource has no id', function*() {
      delete resource.id
      var add = co.wrap(storage.add).bind(storage)
      yield expect(add(resource))
        .to.be.rejectedWith(Error, 'Resource contains no id')
    })

    it ('adds the resource to the pool', function*() {
      yield storage.add(resource)
      expect(yield storage.getAll())
        .to.deep.equal([resource])
    })
  })

  describe('remove', function() {
    beforeEach(function*() {
      yield storage.add(resource)
    })

    it ('removes the resource from the pool', function*() {
      yield storage.remove(resource)
      expect(yield storage.getAll())
        .to.deep.equal([])
    })

    it ('removes the resource from the pool (by id)', function*() {
      yield storage.remove(resource.id)
      expect(yield storage.getAll())
        .to.deep.equal([])
    })

    it ('handles acquired resources', function*() {
      yield storage.acquire()
      yield storage.remove(resource)
      yield storage.release(resource.id)
      expect(yield storage.getCount()).to.equal(0)
    })

    it ('handles acquired resources (by id)', function*() {
      yield storage.acquire()
      yield storage.remove(resource.id)
      yield storage.release(resource.id)
      expect(yield storage.getCount()).to.equal(0)
    })
  })

  describe('acquire', function() {
    it ('returns a resource', function*() {
      yield storage.add(resource)
      var r = yield storage.acquire()
      expect(r).to.matchPattern({
        id: r.id,
        __lastAcquiredAt: _.isNumber
      })
    })

    it ('removes the resource from the pool', function*() {
      yield storage.add(resource)
      yield storage.acquire()
      expect(yield storage.getAll()).to.deep.equal([])
    })

    it ('sets lastAcquired', function*() {
      yield storage.add(resource)
      let start = Date.now()
      yield storage.acquire()
      let res = yield storage.getResource(resource.id)
      expect(res.__lastAcquiredAt).to.be.within(start, Date.now())
    })
  })

  describe('release', function() {
    it ('returns the resource to the pool', function*() {
      yield storage.add(resource)
      var res = yield storage.acquire()
      yield storage.release(res.id)
      expect(yield storage.getAll()).to.matchPattern([{
        id: resource.id,
        __lastAcquiredAt: _.isNumber,
        __lastReleasedAt: _.isNumber
      }])
    })

    it ('sets lastReleased', function*() {
      yield storage.add(resource)
      let res = yield storage.acquire()
      let start = Date.now()
      yield storage.release(res.id)
      res = yield storage.getResource(res.id)
      expect(res.__lastReleasedAt).to.be.within(start, Date.now())
    })
  })

  describe('isEmpty', function() {
    it ('returns true for absent :pool key', function*() {
      yield storage.redis.delAsync('resources:pool')
      expect(yield storage.isEmpty()).to.be.true
    })

    it ('returns false for non-empty :pool key', function*() {
      yield storage.redis.lpushAsync('resources:pool', 1)
      expect(yield storage.isEmpty()).to.be.false
    })
  })

  describe('getAcquiredForMillis', function() {
    beforeEach(function() {
      this.clock = sinon.useFakeTimers()
    })

    afterEach(function() {
      this.clock.restore()
    })

    it ('returns resources that are acquired for more than millis', function*() {
      yield storage.add({id: 1, content: 'a'})
      yield storage.add({id: 2, content: 'b'})

      yield storage.acquire()

      this.clock.tick(100)

      yield storage.acquire()

      expect(yield storage.getAcquiredForMillis(100)).to.have.lengthOf(1)
    })
  })

  describe('getCount', function() {
    it ('returns number of acquired and pooled resources', function*() {
      yield storage.add({id: 1, content: 2})
      yield storage.add({id: 2, content: 3})
      yield storage.acquire()
      expect(yield storage.getCount()).to.equal(2)
    })
  })
})
