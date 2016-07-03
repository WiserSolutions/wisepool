### Use cases

#### Async pool

```js
const WisePool = require('wisepool')

var storage = new WisePool.Storage({
  register: function(resource) {

  },

  getRegistered: function() {

  },

  unregister: function(resource) {

  }
})

var repository = new WisePool.Repository({
  create: function(options) {
  },

  get: function(options) {
  },

  getAll: function() {
  },

  destroy: function(id) {
  }
})

var pool = new WisePool.Pool({
  // Should a resource be created on acquire
  createOnAcquire: false,
  // Destroy the resource after this number of acquires (and releases)
  acquiresToDestroy: false,
  // New resource will not be put into the pool until this function returns true
  resourceReady: function(resource) {

  },
  repository: repository
  storage: storage
})
```
