const Pool = require('./../lib/pool')
const InMemoryStorage = require('./../lib/in_memory_storage')
const InMemoryRepository = require('./../lib/in_memory_repository')

describe('AbstractPool', function() {
  var resource
  beforeEach(function*() {
    resource = { content: faker.random.uuid() }
  })

  describe('acquire', function() {
    it ('acquires available resource', function*() {
      var pool = new Pool()
      var resource = { id: faker.random.uuid() }
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
