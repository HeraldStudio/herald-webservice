const db = require('../../database/sign')
const { Mutex } = require('await-semaphore')
const mutex = new Mutex()

/**
 * 阅读此文件请用 WebStorm 或 VSCode
 * 善用 cmd/option+点击进行查找，找不到的函数都在最下面
 */
exports.route = {

  /**
   * GET /api/sign
   * { page = 1, pagesize = 10 }: 获取所有公开报名列表
   * { sid: number }: 获取报名详细信息和表单内容
   */
  async get({ sid, page = 1, pagesize = 10 }) {

    // 获取所有公开报名列表
    // 只保留公开已审核的报名，按创建时间倒序
    // 每一项都使用下面的 fill() 工具函数来填充是否进行中、是否已参与等附加属性
    if (sid == null) {
      return Promise.all((await db.sign.find(
        { public: 1, admittedBy: { $ne: '' }},
        pagesize, (page - 1) * pagesize, 'createTime-'
      )).map(k => this.fill(k)))
    }
    
    // 获取报名详细信息和表单内容
    // 使用 fill() 工具函数来填充是否进行中、是否已参与等附加属性
    // 使用 fillChildren() 工具函数来填充报名表单中的所有选项、组和组内选项
    else {
      return await this.fill(await this.fillChildren(await db.sign.find({ sid }, 1)))
    }
  },

  /**
   * PUT /api/sign
   * { sid: number, input: string[] }: 填写报名表单的输入框
   * 为了保证用户留下正确的信息，对于有输入框的报名表单，需要先填写输入框，发起本请求，
   * 才能继续执行选择和取消选择选项的操作；对于无输入框的报名表单则无需进行此操作
   * 
   * 之所以用 PUT 是因为 POST/DELETE 是对称操作，它们分别给了选择选项和取消选择选项
   */
  async put({ sid, input }) {

    // 需要登录
    let { cardnum } = this.user

    // 根据 sid 获得报名表单数据项，检查有效性
    let sign = await db.sign.find({ sid }, 1)
    if (!sign || !sign.admittedBy) throw '报名不存在或审核中'
    if (!await this.validateUser(sign)) throw '根据管理者的设置，你没有权限参加此报名'

    // 使用下面的 fill() 工具函数来填充是否进行中、是否已参与等附加属性，并利用其进行时间判断
    sign = this.fill(sign)
    if (!sign.isOngoing) throw '报名未开始或已结束'

    // 解析输入的数组，进行清理，检查非空字符串数量是否等于字段数，进行完整性判断
    input = input.map(k => k.trim()).filter(k => k)
    if (input.length !== sign.input.length) throw '请将信息填写完整'

    // 输入值转为字符串，插入数据库
    input = JSON.stringify(input)
    let now = new Date().getTime()
    await db.signForm.insert({ sid, cardnum, input, submitTime: now })
    return 'OK'
  },

  /**
   * POST /api/sign
   * { oid }: 选择选项
   */
  async post({ oid }) {

    // 需要登录
    let { cardnum } = this.user
    let now = new Date().getTime()
    
    // 根据 oid 获得选项数据项，检查有效性
    let option = await db.signOption.find({ oid }, 1)
    if (!option) throw '选项不存在'

    // 取出选项所在的组、报名表单、名额数
    let { gid, sid, capacity } = option

    // 根据选项所在的表单检查有效性
    let sign = await db.sign.find({ sid }, 1)
    if (!sign || !sign.admittedBy) throw '报名不存在或审核中'
    if (!await this.validateUser(sign)) throw '根据管理者的设置，你没有权限参加此报名'

    // 使用下面的 fill() 工具函数来填充是否进行中、是否已参与等附加属性，并利用其进行时间判断
    sign = this.fill(sign)
    if (!sign.isOngoing) throw '报名未开始或已结束'

    // 检查表单中的输入框信息是否已用 PUT 请求添加过
    if (!await db.signForm.find({ sid, cardnum })) {

      // 若表单有输入框，要求填写
      if (sign.input.length) {
         throw '请先填写并提交基本信息'
      }

      // 否则自动对输入框插入空数据
      // 该空数据一定要插入，将用于判断表单是否已参与以及记录参与时间
      else {
        await db.signForm.insert({ sid, cardnum, input: '[]', submitTime: now })
      }
    }

    // 关键过程加锁逻辑
    // FIXME: 这里用了全局大锁，若性能较差，可分裂成每个 oid 一个锁
    // FIXME: 对于不限名额 (capacity == 0) 的情况，用户间无竞争，甚至可分裂成一个用户一个锁
    await mutex.use(async () => {

      // 判断选项选中情况，已选中不能重复选
      let selected = await db.signOptionResult.find({ oid, cardnum }, 1)
      if (selected) throw '该选项已经选择'

      // 判断名额已满
      // 注意用户体验，一定要优先判断名额已满、然后再判断超过最大可选数限制
      // 否则在名额已满且超过限制的情况下优先提示超过限制，将出现引导用户意外退选的情况
      if (capacity > 0) {
        let count = await db.signOptionResult.count('*', { oid })
        if (count >= capacity) throw '该选项名额已满'
      }

      // 若选项属于某个选项组
      if (gid != null) {

        // 根据 gid 获取所在的选项组，判断有效性
        let group = await db.signGroup.find({ gid }, 1)
        if (group == null) throw `找不到选项所在组 ${group}`

        // 取选项组的最大可选限制数，若有限制，判断是否已达到限制
        let { maxSelection } = group
        if (maxSelection > 0) {
          let { count } = (await db`
            select count(oid) count from signOptionResult inner join signOption
            on signOptionResult.oid = signOption.oid
            where signOptionResult.cardnum = ${ cardnum } and signOption.gid = ${ gid }
          `)[0]
          if (count >= maxSelection) throw `该组最多可选 ${maxSelection} 个选项`
        }
      }

      // 所有判断结束，迅速插入数据，扔掉锁
      await db.signOptionResult.insert({ oid, cardnum, selectTime: now })
    })

    return 'OK'
  },

  /**
   * DELETE /api/sign
   * { oid }: 取消选择选项
   */
  async delete({ oid }) {

    // 需要登录
    let { cardnum } = this.user

    // 根据 oid 获得选项数据项，检查有效性
    let option = await db.signOption.find({ oid }, 1)
    if (!option) throw '选项不存在'

    // 取出选项所在的组、报名表单、名额数
    let { gid, sid, capacity } = option

    // 根据选项所在的表单检查有效性
    let sign = await db.sign.find({ sid }, 1)
    if (!sign || !sign.admittedBy) throw '报名不存在或审核中'
    if (!await this.validateUser(sign)) throw '根据管理者的设置，你没有权限参加此报名'

    // 使用下面的 fill() 工具函数来填充是否进行中、是否已参与等附加属性，并利用其进行时间判断
    sign = this.fill(sign)
    if (!sign.isOngoing) throw '报名未开始或已结束'

    // 检查表单中的输入框信息是否已用 PUT 请求添加过
    if (!await db.signForm.find({ sid, cardnum })) {

      // 若表单有输入框，要求填写
      if (sign.input.length) {
        throw '请先填写并提交基本信息'
      }

      // 否则自动对输入框插入空数据
      // 该空数据一定要插入，将用于判断表单是否已参与以及记录参与时间
      else {
        await db.signForm.insert({ sid, cardnum, input: '[]', submitTime: now })
      }
    }

    // 删就一个字，我只说一次
    await db.signOptionResult.remove({ oid, cardnum })
    return 'OK'
  },

  // 工具函数：给报名信息增加相关字段用于判断
  async fill(sign) {
    let now = new Date().getTime()

    // 增加 isOngoing 字段表示当前是否进行中
    sign.isOngoing = sign.mode === 'on'
      || sign.mode === 'timer' && sign.startTime <= now && sign.endTime <= now

    // 增加 isJoined 字段表示是否已参与
    sign.isJoined = false

    // 解析 input 字段为数组
    sign.input = JSON.parse(sign.input).map(k => ({ caption: k }))

    // 已登录用户对 isJoined 和 input 的后续处理
    if (this.user.isLogin) {
      let { cardnum } = this.user
      let { sid } = sign
      let result = await db.signForm.find({ sid, cardnum }, 1)
      if (result) {
        sign.isJoined = true
        let { input } = result
        input = JSON.parse(input)

        // 给 input 添加 value，表示上次已填的内容
        sign.input = sign.input.map((k, i) => {
          k.value = input[i]
          return k
        })
      }
    }
    return sign
  },

  // 工具函数：给报名信息增加表单内容详情
  // 这是个递归函数，只多递归一层，
  // 外层是给报名信息加入表单中的选项组和选项，内层是给选项组中增加组内的选项
  // 增加选项时，都要用 fillSelection 工具函数增加用户的当前所选情况
  async fillChildren(signOrGroup) {
    let { sid, gid } = signOrGroup

    // 给报名信息表单增加选项组和选项
    if (sid != null) {
      let sign = signOrGroup
      let groups = (await db.signGroup.find({ sid })).map(g => this.fillChildren(g))
      let options = await db.signOption.find({ sid }).map(o => this.fillSelection(o))
      sign.children = [...groups, ...options]
      return sign
    }
    
    // 给选项组增加组内选项
    else {
      let group = signOrGroup
      let options = await db.signOption.find({ gid }).map(o => this.fillSelection(o))
      group.children = options
      return group
    }
  },

  // 工具函数：给选项增加用户的当前所选情况
  async fillSelection(option) {
    let { oid } = option
    let { cardnum } = this.user
    option.isSelected = !!await db.signOptionResult.find({ oid, cardnum })
    return option
  },

  // 工具函数：判断用户是否处于报名表单允许参与的用户范围内
  async validateUser({ sid, userType, userGlob }) {

    // 需要登录
    let { cardnum, schoolnum } = this.user

    // 所有用户
    if (userType === 'all') return true

    // 白名单用户
    if (userType === 'whitelist') {
      return !!await db.signWhitelist.find({ sid, cardnum }, 1)
    }

    // 通配符情况下，直接利用 SQLite 做通配判断
    if (userType === 'glob') {
      return !!(await db`select ${ schoolnum } glob ${ userGlob }`)[0]
    }
  }
}