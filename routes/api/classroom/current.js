
function laterThan(time1, time2){
    return +moment(time1, "HH:mm") > +moment(time2,"HH:mm")
}

const sequenceTimeMap = [
    {sequence:1, start:"8:00", end:"8:45"},
    {sequence:2, start:"8:46", end:"9:35"},
    {sequence:3, start:"9:36"}
]
exports.route = {
    // 获取当前时段所有可以用的空教室
    async get () {
        return {laterThan:laterThan("19:30", "10:30")}
    }
}