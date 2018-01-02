import { ClassRecord } from "./models";


exports.route = {

  /**
  * POST /api/spare-classrom/update
  **/
  async post() {
    let curriculumsURL = "http://121.248.63.139/nstudent/pygl/kbcx_yx.aspx";
    let rawData = (await this.axios.get(curriculumsURL)).data;

    let reg = /<td>(.+)<\/td><td>(.+)<\/td><td>([^\s]+)\s*<\/td><td>第(\d+)-(\d+)周; (.+)-(.+)<\/td><td>(.+)<\/td><td>([^\w]+)([0-9a-zA-Z]+)<\/td><td>(\d+)<\/td><td>(\d+)<\/td>/;
    //let reg = /<td>学位英语72班<\/td><td>S000151<\/td><td>学位英语\s*<\/td><td>第1-18周; 星期五-上午3,上午4<\/td><td>王学华<\/td><td>九龙湖纪忠楼Y308<\/td><td>45<\/td><td>37<\/td>/;
    let classRecords = [];
    let entry;
    do {
      entry = reg.exec(rawData);
      if (entry) {
        classRecords.push(new ClassRecord(entry));
      }
    } while (entry);


  }
}
