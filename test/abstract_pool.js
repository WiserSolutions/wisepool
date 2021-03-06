const Pool = require('./../lib/pool')
const InMemoryStorage = require('./../lib/in_memory_storage')
const InMemoryRepository = require('./../lib/in_memory_repository')
const Bluebird = require('bluebird')

describe('AbstractPool', function() {
  var resource
  beforeEach(function*() {
    resource = newResource()
  })

  describe('register', function() {
    it ('initializes __registeredAt', function*() {
      var pool = new Pool()
      var start = Date.now()

      yield pool.register(resource)

      expect(resource.__registeredAt).to.be.within(start, Date.now())
    })
  })

  describe('acquire', function() {
    it ('acquires available resource', function*() {
      var pool = new Pool()
      yield pool.register(resource)
      expect(yield pool.acquire()).to.equal(resource)
    })

    it ('returns null when no resources', function*() {
      var pool = new Pool()
      expect(yield pool.acquire()).to.be.null
    })

    describe('repository', function() {
      var repository

      beforeEach(function*() {
        repository = new InMemoryRepository()
      })

      it ('creates a new resource', function*() {
        repository.create = function*() { return resource }
        var pool = new Pool({repository})
        yield pool.initialize()
        expect(yield pool.acquire()).to.equal(resource)
      })

      describe('max', function() {
        it ('returns null if current >= max', function*() {
          repository.create = function*() { return resource }
          var pool = new Pool({repository, max: 1})
          yield pool.register({content: faker.random.uuid()})
          yield pool.initialize()
          yield pool.acquire()
          expect(yield pool.acquire()).to.be.null
        })

        it('creates a resource if current < max', function*() {
          repository.create = function*() { return resource}
          var pool = new Pool({repository, max: 1})
          expect(yield pool.acquire()).to.equal(resource)
        })
      })

      it ('returns null if resource can not be created', function*() {
        repository.create = function*() { return null }
        var pool = new Pool({repository})
        yield pool.initialize()
        expect(yield pool.acquire()).to.be.null
      })

      it ('handles exceptions in .create', function*() {
        repository.create = function*() { throw new Error() }
        var pool = new Pool({repository})
        yield pool.initialize()
        expect(yield pool.acquire()).to.be.null
      })
    })
  })

  describe('destroy', function() {
    it ('removes the resource from pool', function*() {
      var pool = new Pool()
      yield pool.register(resource)
      yield pool.destroy(resource.id)
      expect(yield pool.acquire()).to.be.null
    })

    it ('handles acquired resources', function*() {
      var pool = new Pool()
      yield pool.register(resource)
      yield pool.acquire()
      yield pool.destroy(resource.id)
      yield pool.release(resource.id)
      expect(yield pool.acquire()).to.be.null
    })

    describe('repository', function() {
      it ('destroys the resource in repository', function*() {
        var repository = new InMemoryRepository()
        var spy = sinon.spy()
        repository.destroy = function*(id) { spy(id) }

        yield repository.add(resource)
        var pool = new Pool({repository})
        yield pool.initialize()
        yield pool.destroy(resource.id)

        expect(spy).to.have.been.calledWith(resource.id)
      })
    })
  })

  describe('release', function() {
    it ('returns the resource back to pool', function*() {
      var pool = new Pool()
      yield pool.register(resource)
      var r = yield pool.acquire()
      yield pool.release(r.id)
      expect(yield pool.acquire()).to.equal(resource)
    })
  })

  describe('storage', function() {
    it ('is shared', function*() {
      var storage = new InMemoryStorage()
      var pool1 = new Pool({storage})
      var pool2 = new Pool({storage})
      var resource = {id: faker.random.uuid()}
      yield pool1.register(resource)
      expect(yield pool2.acquire()).to.equal(resource)
    })
  })

  describe('repository', function() {
    var repository

    beforeEach(function*() {
      repository = new InMemoryRepository()
    })

    it ('used to initialize pool', function*() {
      yield repository.add([resource])
      var pool = new Pool({repository})
      yield pool.initialize()
      expect(yield pool.acquire()).to.equal(resource)
    })

    describe ('garbageCollect', function() {
      it ('removes items not existing in the repository', function*() {
        var pool = new Pool({repository})
        yield pool.initialize()
        yield pool.register(resource)
        yield pool.garbageCollect()
        expect(yield pool.acquire()).to.be.null
      })

      it ('does not remove items that exist in the repository', function*() {
        yield repository.add([resource])
        var pool = new Pool({repository})
        yield pool.initialize()
        yield pool.garbageCollect()
        expect(yield pool.acquire()).to.equal(resource)
      })
    })

    it ('can be null', function*() {
      var pool = new Pool({repository: null})
      yield pool.initialize()
    })
  })

  describe('validation', function() {
    describe('register', function() {
      it ('does not add invalid resources', function*() {
        var pool = new Pool({ validate: function*() { return false } })
        yield pool.register(resource)
        expect(yield pool.acquire()).to.be.null
      })
    })

    describe('garbageCollect', function() {
      it ('removes items not passing validation', function*() {
        var pool = new Pool({validate: function*() { return false }})
        yield pool.register(resource)
        yield pool.garbageCollect()
        expect(yield pool.acquire()).to.be.null
      })

      it ('does not remove items passing validation', function*() {
        var pool = new Pool({validate: function*() { return true }})
        yield pool.register(resource)
        yield pool.garbageCollect()
        expect(yield pool.acquire()).to.equal(resource)
      })
    })
  })

  describe('getIdleResources', function() {

    var pool

    beforeEach(function*() {
      pool = new Pool({ resourceIdleTimeoutMillis: 100 })
      yield pool.register(resource)
    })

    it ('does not return acquired resources', function*() {
      yield pool.acquire()
      expect(yield pool.getIdleResources()).to.have.lengthOf(0)
    })

    it ('does not return resources released less than resourceIdleTimeoutMillis ago', function*() {
      resource.__lastReleasedAt = Date.now()
      expect(yield pool.getIdleResources()).to.have.lengthOf(0)
    })

    it ('returns resources released before resourceIdleTimeoutMillis', function*() {
      resource.__lastReleasedAt = Date.now() - 101
      expect(yield pool.getIdleResources()).to.have.lengthOf(1)
    })

    it ('does not return resources without __lastReleasedAt and __registeredAt', function*() {
      delete resource.__lastReleasedAt
      delete resource.__registeredAt
      expect(yield pool.getIdleResources()).to.have.lengthOf(0)
    })

    it ('does not return resources registered within resourceIdleTimeoutMillis', function*() {
      delete resource.__lastReleasedAt
      expect(yield pool.getIdleResources()).to.have.lengthOf(0)
    })

    it ('returns resources with lastReleased undefined and created', function*() {
      delete resource.__lastReleasedAt
      resource.__registeredAt = Date.now() - 101
      expect(yield pool.getIdleResources()).to.have.lengthOf(1)
    })
  })

  describe('.initialize', function() {
    it ('does not initialize the pool with duplicate resources', function*() {
      var repository = new InMemoryRepository()
      yield repository.add([resource])

      var storage = new InMemoryStorage()

      var pool1 = new Pool({repository, storage})
      yield pool1.initialize()
      var pool2 = new Pool({repository, storage})
      yield pool2.initialize()

      expect(yield pool1.storage.getAll()).to.deep.equal([resource])
    })
  })
})
