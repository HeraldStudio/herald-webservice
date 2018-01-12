import json

from .exception import *

class BaseHandler(RequestHandler):
    def set_default_headers(self):
        self.set_header('Access-Control-Allow-Origin', '*')
        self.set_header('Access-Control-Allow-Headers', 'Access-Token, Content-Type')
        self.set_header('Access-Control-Allow-Methods', 'POST, GET, OPTIONS, PUT, DELETE')

    def finish(self, chunk=None):
        super(BaseHandler, self).finish(chunk)

    def finish_success(self, result='OK', code=200):
        self.finish(json.dumps({
            'success': True,
            'code': int(code),
            'result': result
        }))

    def finish_err(self, reason, code=400):
        self.finish(json.dumps({
            'success': False,
            'code': int(code),
            'reason': reason
        }))

    def options(self):
        self.finish()

    @property
    def json_body(self):
        if not hasattr(self, '_json_body'):
            if hasattr(self.request, 'body'):
                try:
                    if not self.request.body:
                        self._json_body = {}
                    else:
                        self._json_body = json.loads(self.request.body.decode('utf-8'))
                except ValueError:
                    raise ArgsError('参数不是json格式！')
        return self._json_body
