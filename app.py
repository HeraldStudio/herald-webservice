from tornado.web import *
from tornado.ioloop import IOLoop
from tornado.options import options, define
from handler import *
from motor.motor_tornado import MotorClient
from repository.Repository import Repository
from cache.Cache import Cache
from model.Model import Model
import redis
handlers = [
    (r'/', IndexHandler)
]

if __name__ == '__main__':
    define("port", default=8080, help="本地监听端口", type=int)
    define("db_name", default="herald", help="mongodb数据库名称", type=str)
    tornado.options.parse_command_line()
    # Repository
    mongodb_client = MotorClient('127.0.0.1:27017')
    mongodb_database = mongodb_client[options.db_name]
    repo = Repository(db=mongodb_database)
    # Cache
    redis_pool = redis.ConnectionPool(host='localhost', port=6379, db=0)
    redis_client = redis.Redis(connection_pool=redis_pool)
    cache = Cache(redis=redis_client)
    # Model
    model = Model(repo=repo, cache=cache)
    app = Application(handlers=handlers,
                      db=mongodb_database,  # 此处注册Motor进tornado事件环，但handler内部不应直接访问db
                      model=model)
    app.listen(options.port)
    IOLoop.current().start()
