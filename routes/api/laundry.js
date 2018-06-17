const shops = {
  '梅园': '7122b5ce-14b3-4b68-b122-83b10716e1dd',
  '桃园': '892685dd-6168-40dc-9f84-0ddc51be0176',
  '橘园': '85beb7dc-b0d4-4222-aae9-73d19d45e9a8'
}

const states = [
  '空闲', '使用中', '暂停', '故障', '维护中', '自检中', '预约中', '离线', '删除', '未知'
]

exports.route = {
  async get() {
    return await this.publicCache('1m', async () => {
      return await Promise.all(Object.keys(shops).map(async area => {
        let machines = (await this.get(`http://haiyaxiyi.cn/Wash/GetMachineByShopId?shopId=${shops[area]}&machineTypeId=&page=1&pagesize=1000`)).data
        machines = machines.Data.map(k => {
          let { MachineId: id, MachineName: name, SubTypeName: type, MachineState: state, remainMinutes, payType } = k

          // 此 URL 不能只带 machineId，必须带后面其它参数，而且 && 不能改成 &，否则打开的网页显示数据不对
          let url = `http://haiyaxiyi.cn/MachineFunction/Index?machineId=${id}&&state=${state}&&payType=${payType}&confirmOrderType=2`
          type = type.match(/洗衣机|烘干机|洗鞋机/)[0]
          state = states[state - 1]
          return { id, name, type, state, remainMinutes, url }
        }).filter(k => k.type).sort((a, b) => a.name < b.name ? -1 : 1)
        return { area, machines }
      }))
    })
  }
}