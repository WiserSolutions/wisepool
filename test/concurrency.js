const Pool = require('./../lib/pool')
const RedisStorage = require('./../lib/redis_storage')
const InMemoryStorage = require('./../lib/in_memory_storage')
const _ = require('lodash')

describe.only('concurrency', function() {
  [RedisStorage, InMemoryStorage].forEach(function(Storage) {
    describe(Storage.name, function() {
      var storage = new Storage()
      beforeEach(function*() {
        yield storage.initialize()
        yield storage.reset()
      })

      it ('handled correctly', function*() {
        var pool = new Pool({ storage })
        yield _.times(100, newResource).map(r => pool.register(r))
        expect(yield pool.storage.getAll()).to.have.lengthOf(100)

        // Check we acquired all 100 resources
        var result = yield _.times(100, _ => pool.acquire())
        expect(_.uniq(result).length).to.equal(100)
        // And the pool has no resources left
        expect(yield pool.storage.getAll()).to.have.lengthOf(0)

        yield result.map(_ => pool.release(_.id))
        expect(_.uniq(yield pool.storage.getAll()).length).to.equal(100)
      })
    })
  })
})
