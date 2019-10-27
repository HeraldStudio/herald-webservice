const mongodb = require('../../../database/mongodb')

exports.route = {
  async get({key, type}){
    let lostAndFoundCollection = await mongodb('herald_lost_and_found')
    return await lostAndFoundCollection.find({
      title:{$regex:'.*'+key+'.*'}, 
      type, 
      isAudit:true, 
      isFinished:false}, 
    {sort:[['lastModifiedTime', -1]]}).toArray()
  }
}