const pool = {}

module.exports = {
  set(key, value, ttl = 0) {
    if (!ttl && pool.hasOwnProperty(key)) {
      ttl = pool[key]
    }
    pool[key] = { value, expires: ttl ? new Date().getTime() + ttl * 1000 : 0 }
  },
  get(key) {
    let got = pool[key]
    return got && got.expires > new Date().getTime() ? got.value : null
  },
  delete(key) {
    pool[key] = null
  }
}