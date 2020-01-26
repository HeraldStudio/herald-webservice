
function laterThan(time1, time2) {
  return +moment(time1, 'HH:mm') >= +moment(time2, 'HH:mm')
}

const weekdayMap = {
  '1': '星期一',
  '2': '星期二',
  '3': '星期三',
  '4': '星期四',
  '5': '星期五',
  '6': '星期六',
  '7': '星期日'
}
const sequenceTimeMap = [
  { sequence: 1, start: '00:00', end: '08:45' },
  { sequence: 2, start: '08:46', end: '09:35' },
  { sequence: 3, start: '09:36', end: '10:35' },
  { sequence: 4, start: '10:36', end: '11:25' },
  { sequence: 5, start: '11:26', end: '12:15' },
  { sequence: 6, start: '12:16', end: '14:45' },
  { sequence: 7, start: '14:46', end: '15:35' },
  { sequence: 8, start: '15:36', end: '16:45' },
  { sequence: 9, start: '16:36', end: '17:25' },
  { sequence: 10, start: '17:26', end: '18:15' },
  { sequence: 11, start: '18:16', end: '19:15' },
  { sequence: 12, start: '19:16', end: '20:05' },
  { sequence: 13, start: '20:06', end: '23:59' }
]
exports.route = {
  // 获取当前时段所有可以用的空教室
  async get() {

    let term = await this.get('https://myseu.cn/ws3/api/classroom/term')
    let myTerm = this.term
    let termName = myTerm['currentTerm']['name']

    // //转换一下termName的格式
    // let termNameStr = termName.split('-')
    // for (let i = 0; i < termNameStr.length - 1; i++) {
    //   termNameStr[i] = '20'.concat(termNameStr[i])
    // }
    // termName = termNameStr.join('-')
    console.log(termName)
    //查询termId
    let termId
    for (let i = 0; i < term.data.result.length; i++) {
      if (term.data.result[i]['name'] === termName) {
        termId = term.data.result[i]['id']
        break
      }
    }
    let nowDate = new Date().getTime()
    let startDate = myTerm.current['startDate']
    let aWeekInSecond = 7 * 24 * 3600 * 1000
    //获取第几周
    let startWeek = Math.ceil((nowDate - startDate) / aWeekInSecond)
    let endWeek = startWeek
    //获取一星期的第几天
    let dayOfWeek = new Date().getDay()
    if (dayOfWeek === 0) {
      dayOfWeek = 7
    }
    //设置现在是第几节课
    let currentSequence
    let nextSequence
    let nowTime = moment().format('HH:mm')
    
    for (let i = 0; i < 13; i++) {
      if (laterThan(nowTime, sequenceTimeMap[i]['start']) && laterThan(sequenceTimeMap[i]['end'], nowTime)) {
        currentSequence = sequenceTimeMap[i]['sequence']
        break
      }
    }
    if (currentSequence <= 12) {
      nextSequence = currentSequence + 1
    } else {
      nextSequence = 13
    }

    let cacheKey = [ startWeek, endWeek, dayOfWeek, currentSequence, nextSequence, termId]
    cacheKey = cacheKey.join('-')
    return await this.publicCache(cacheKey, '2h+', async () => {
      //现在的空教室
      let forCurrent = (await this.get(`https://myseu.cn/ws3/api/classroom/index?startWeek=${startWeek}&endWeek=${endWeek}&dayOfWeek=${dayOfWeek}&startSequence=${currentSequence}&endSequence=${currentSequence}&termId=${termId}`)).data.result
      //下一节课的空教室
      let forNext = (await this.get(`https://myseu.cn/ws3/api/classroom/index?startWeek=${startWeek}&endWeek=${endWeek}&dayOfWeek=${dayOfWeek}&startSequence=${nextSequence}&endSequence=${nextSequence}&termId=${termId}`)).data.result

      forCurrent = forCurrent.map(k => k.name)
      forNext = forNext.map(k => k.name)

      let currentTimeDesc = `${termName}学期 - 第${startWeek}周 - ${weekdayMap['' + dayOfWeek]} - 第${currentSequence}节`
      let nextTimeDesc = `${termName}学期 - 第${startWeek}周 - ${weekdayMap['' + dayOfWeek]} - 第${nextSequence}节`
      if (currentSequence === nextSequence) {
        return { forCurrent, currentTimeDesc }
      }

      return { forCurrent, forNext, currentTimeDesc, nextTimeDesc }
            
    })
  }

}