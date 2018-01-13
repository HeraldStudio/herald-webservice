import bson
import pymongo
import time
import datetime


def object_id(doc_id):
    return bson.objectid.ObjectId(doc_id)


def timestamp():
    now = datetime.datetime.now()
    return time.mktime(now.timetuple())


class CollectionBase(object):
    def __init__(self, db, collection_name):
        self.collection = db[collection_name]
        self.ASCENDING = pymongo.ASCENDING
        self.DESCENDING = pymongo.DESCENDING
        self.default = {}

    def get_default(self):
        default = {}
        for k in self.default:
            default[k] = self.default[k]
        return default

    # <====== 查 ======>
    async def exist(self, condition):
        if await self.get_count_by_condition(condition) > 0:
            return True
        else:
            return False

    async def get_count_by_condition(self, condition):
        return await self.collection.count(condition)

    async def find_one_by_id(self, doc_id):
        condition = {'_id': object_id(doc_id)}
        doc = await self.collection.find_one(condition)
        if doc is not None:
            doc['_id'] = str(doc['_id'])
        return doc

    async def find_all(self):
        cursor = self.collection.find({})
        result = []
        async for doc in cursor:
            doc['_id'] = str(doc['_id'])
            result.append(doc)
        return result

    async def find_by_condition(self, condition):
        cursor = self.collection.find(condition)
        result = []
        async for doc in cursor:
            doc['_id'] = str(doc['_id'])
            result.append(doc)
        return result

    async def find_pages_by_condition(self, condition, sort, page, pagesize):
        page = int(page)
        pagesize = int(pagesize)
        limit = pagesize
        skip = (page - 1) * pagesize
        cursor = self.collection.find(condition, limit=limit, skip=skip, sort=sort)
        result = []
        async for doc in cursor:
            doc['_id'] = str(doc['_id'])
            result.append(doc)
        return result
    # <！====== 查 ======>

    # <====== 增 ======>
    async def insert_one(self, doc):
        await self.collection.insert(doc)
    # <！====== 增 ======>

    # <====== 改 ======>
    async def update_one_by_id(self, doc_id, doc):
        condition = {'_id': object_id(doc_id)}
        if '_id' in doc:
            doc.pop('_id') #  !!存在隐患
        doc = {'$set': doc}
        await self.collection.update_one(condition, doc)
    # <！====== 改 ======>

    # <====== 删 ======>
    async def delete_one_by_id(self, doc_id):
        condition = {'_id': object_id(doc_id)}
        await self.collection.delete_one(condition)

    async def delete_by_condition(self, condition):
        await self.collection.delete_many(condition)
    # <！====== 删 ======>



