from tornado.web import *
from tornado.ioloop import IOLoop
from tornado.options import options, define
from handler import *

handlers = [
    (r'/', IndexHandler)
]

if __name__ == '__main__':
    define("port", default=8080, help="本地监听端口", type=int)
    tornado.options.parse_command_line()
    app = Application(handlers)
    app.listen(options.port)
    IOLoop.current().start()
