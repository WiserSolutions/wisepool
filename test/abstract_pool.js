const Pool = require('./../lib/pool')
const InMemoryStorage = require('./../lib/in_memory_storage')
const InMemoryRepository = require('./../lib/in_memory_repository')

describe('AbstractPool', function() {
  var resource
  beforeEach(function*() {
    resource = {id: faker.random.uuid()}
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
      expect(yield pool.acquire()).to.equal(null)
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
        expect(yield pool.acquire()).to.equal(null)
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
    describe('garbageCollect', function() {
      it ('removes items not passing validation', function*() {
        var pool = new Pool({validate: function*() { return false }})
        yield pool.register(resource)
        yield pool.garbageCollect()
        expect(yield pool.acquire()).to.equal(null)
      })

      it ('does not remove items passing validation', function*() {
        var pool = new Pool({validate: function*() { return true }})
        yield pool.register(resource)
        yield pool.garbageCollect()
        expect(yield pool.acquire()).to.equal(resource)
      })
    })
  })
})
