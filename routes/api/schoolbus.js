
const timetable = {
  "双休节假日": [
    { "time":"8:00-9:30", "bus":"每 30min 一班"},
    { "time":"9:30-11:30", "bus":"每 1h 一班"},
    { "time":"11:30-13:30", "bus":"每 30min 一班"},
    { "time":"13:30-16:30", "bus":"每 1h 一班"},
    { "time":"16:30-19:00", "bus":"每 30min 一班"},
    { "time":"19:00-22:00", "bus":"每 1h 一班"}
  ],
  "工作日": [
    { "time":"7:10-10:00", "bus":"每 10min 一班"},
    { "time":"10:00-11:30", "bus":"每 30min 一班"},
    { "time":"11:30-13:30", "bus":"每 10min 一班"},
    { "time":"14:00-15:00", "bus":"每 1h 一班"},
    { "time":"15:00-16:00", "bus":"每 10min 一班"},
    { "time":"17:00-18:30", "bus":"每 10min 一班"},
    { "time":"18:30-22:00", "bus":"每 30min 一班"}
  ]
}

const transformPosition = (obj) => {
  obj.longitude += 0.0051
  obj.latitude -= 0.00205
}

exports.route = {
  async get () {
    return await this.publicCache('5s', async () => {
      let buses = (await this.get('http://121.248.63.119/busservice/lines')).data.data.lines
      let instant = await Promise.all(buses.map(async k => {
        k.startTime = +moment(k.startTime)
        k.endTime = +moment(k.endTime)
        k.detail = (await this.get('http://121.248.63.119/busservice/lineDetail?lineId=' + k.id)).data.data.line
        k.detail.linePoints.map(k => {
          transformPosition(k.station)
          delete k.longitude
          delete k.latitude
        })
        k.buses = (await this.get('http://121.248.63.119/busservice/queryBus?lineId=' + k.id)).data.data.buses
        k.buses.map(k => transformPosition(k.location))
        return k
      }))

      return { timetable, instant }
    })
  }
}
