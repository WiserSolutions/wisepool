module.exports = {
  Pool: require('./lib/pool'),
  Storage: {
    Redis: require('./lib/redis_storage'),
    InMemory: require('./lib/in_memory_storage')
  },
  Repository: {
    InMemory: require('./lib/in_memory_repository')
  }
}
