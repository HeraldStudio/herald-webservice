const models = require("./models");

exports.route = {

  /**
   * GET /api/classroom/spare
   * @apiParam pageNo        要查看的查询记录的页数
   * @apiParam pageSize      一页包含的查询记录数目
   * @apiParam campusId?     校区ID，留空则查询所有校区
   * @apiParam buildingId?   教学楼宇ID，留空则查询所有楼宇
   * @apiParam startWeek     一学期中起始周次
   * @apiParam endWeek       一学期中结束周次
   * @apiParam dayOfWeek     查询一星期中的哪一天
   * @apiParam startSequence 一天中起始节次
   * @apiParam endSequence   一天中结束周次
   * @apiParam termId        查询的学期
   * @remarks 查询空教室
   * @note 若查询教一~教七则调用学校接口，其余则通过服务器自己获取课表信息后计算而得。
   **/
  async get() {
    if (this.params.campusID === 22) { // 教一~教七
      let result = (await this.post(
        "http://58.192.114.179/classroom/show/getemptyclassroomlist",
        this.querystring
      )).data
  
      // 利用Classroom类剔除多余属性，统一返回的JSON格式
      result.rows.forEach((classroom, index) => {
        try {
          result.rows[index] = new models.Classroom(classroom);
        } catch (ex) {
          console.log(ex)
        }
      })
  
      return result
    } else { 
      // 查询纪忠楼 & 四牌楼 & 无线谷 & 无锡分校
      // 由于学校空教室接口暂未提供服务，因此目前从web service内置数据库中查询
      
      let spareClassrooms = this.cache.get(this.querystring, )
      
      

      let params = this.params
      Object.keys(params).forEach(key => params[key] = (params[key] ? parseInt(params[key]) : null)); // 转换字符串属性至对应整数
  
      // 利用课表筛选出该条件下有课的教室ID
      let occupiedClassroomIds = models.classRecords.filter(record =>
        (params.campusId == null || record.campusId == params.campusId)
        &&
        (params.buildingId == null || record.buildingId == params.buildingId)
        &&
        (params.startWeek <= record.endWeek && record.startWeek <= params.endWeek)
        &&
        (params.dayOfWeek == record.dayOfWeek)
        &&
        record.sequences.some(value => value >= params.startSequence && value <= params.endSequence)
      ).map(record => record.classroomId)
  
      // 筛选出所有无课的教室
      let spareClassrooms = Object.values(models.classrooms).map(c => new models.Classroom(c)).filter(classroom =>
        (params.campusId == null || classroom.building.campusId == params.campusId)
        &&
        (params.buildingId == null || classroom.buildingId == params.buildingId)
        &&
        !occupiedClassroomIds.includes(classroom.Id)
      )
  
      return {
        "pager.pageNo": params.pageNo,
        "pager.totalRows": spareClassrooms.length,
        "rows": spareClassrooms.slice(params.pageSize * (params.pageNo - 1), params.pageSize * params.pageNo)
      }
    }
  }
}
