module.exports = timeout => {
  const _Promise = Promise
  Promise = function (...args) {
    const originalPromise = new _Promise(...args)
    const timeoutError = new Error('Promise timed out.')
    const timeoutPromise = new _Promise((resolve, reject) => {
      setTimeout(() => reject(timeoutError), timeout)
    })
    return _Promise.race([timeoutPromise, originalPromise]).catch(e => {
      if (e === timeoutError) {
        console.error('[Promise Timeout]', e.stack.split('\n').map(k => k.trim()).filter(k => /:\d+:\d+\)$/.test(k))[1] || 'at unknown source')
      } else {
        throw e
      }
    })
  }
  Promise.all = _Promise.all
  Promise.race = _Promise.race
  Promise.reject = _Promise.reject
  Promise.resolve = _Promise.resolve
  Promise.prototype = Object.create(_Promise.prototype)
}