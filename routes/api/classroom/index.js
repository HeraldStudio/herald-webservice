exports.route = {
    // 获取所有的可以查询的校区
    async get ({campusId, buildingId, startWeek, endWeek, dayOfWeek, startSequence, endSequence, termId}) {
        let res = await this.post('http://58.192.114.179/classroom/show/getemptyclassroomlist',{
            pageNo: 1,
            pageSize: 500,
            campusId,
            buildingId,
            dayOfWeek,
            startWeek,
            endWeek,
            startSequence,
            endSequence,
            termId
        })
        return res.data.rows
    }
}