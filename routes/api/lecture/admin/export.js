const fs = require('fs')

exports.route = {
    /**
    * @api {GET} /api/lecture/admin/cardRecord 查询讲座打卡纪录
    * @apiGroup lecture
    * @apiParam {String} lectureID 讲座ID
    * @returns [{id, cardnum, name, location, timestamp}]
    */
    async get({lectureID}) {
      // if (!(await this.hasPermission('lecturerecord'))) {
      //   throw 403
      // }
      if (!lectureID) {
        throw '参数不全'
      }
      // 查找此讲座的打卡记录
      let rawResult = await this.db.execute(`
        SELECT ID, CARDNUM, NAME, LOCATION, DATESTR, TIMESTAMP
        FROM H_LECTURE_CARDRECORD 
        WHERE LECTURE_ID = :lectureID AND DELETED = 0
        ORDER BY TIMESTAMP
      `, {
        lectureID
      })
      let result = "id,cardnum,name,location,time\n"
      rawResult.rows.forEach(r => {
        result += r[0] + ',';//id
        result += r[1] + ',';//cardnum
        result += r[2] + ',';//name
        result += r[3] + ',';//location
        result += (new Date(r[5])).toLocaleDateString().replace(/\//g, "-") + ' ';//date
        result += (new Date(r[5])).toTimeString().substr(0, 8) + '\n';//time
      })
      fs.writeFileSync('routes\\api\\lecture\\admin\\export.csv', decodeURI(result.replace(/\\u/gi, '%u')));
      return result;
    }
  }